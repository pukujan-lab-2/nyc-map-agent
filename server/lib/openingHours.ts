import OpeningHours from "opening_hours";

/**
 * Is a restroom open right now, and until when? Read at request time in New
 * York time (never the server's or the phone's zone) with the maintained
 * OpenStreetMap `opening_hours` parser, which handles overnight hours
 * ("17:00-02:00"), weekdays and holidays. LGPL-3.0, server-only, unmodified.
 *
 * Never a guess: missing hours, hours the parser cannot read, and data we
 * fetched more than {@link STALE_DAYS} days ago are all "unknown", which the
 * card shows as "Hours may have changed".
 */
const NYC_TZ = "America/New_York";
/** Our copy is older than this: the hours may have changed since. */
const STALE_DAYS = 30;
const DAY_MS = 86_400_000;
/** Lower Manhattan, for sunset and New York's public holidays. */
const NOMINATIM = { lat: 40.71, lon: -74.0, address: { country_code: "us", state: "New York" } };

export type OpenStatus = "open" | "closed" | "unknown";
export type UnknownReason = "missing" | "stale" | "unclear";

export interface OpenState {
  status: OpenStatus;
  /** When open: the instant it closes (ISO), or null when it never does (24/7). */
  until: string | null;
  /** When closed: the next opening (ISO) within a week, or null. */
  opensAt: string | null;
  /** Why the status is unknown. */
  reason: UnknownReason | null;
}

const UNKNOWN = (reason: UnknownReason): OpenState => ({ status: "unknown", until: null, opensAt: null, reason });

const nyParts = new Intl.DateTimeFormat("en-US", {
  timeZone: NYC_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function wallFields(at: Date): [number, number, number, number, number, number] {
  const p = Object.fromEntries(nyParts.formatToParts(at).map((x) => [x.type, x.value]));
  return [Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute), Number(p.second)];
}

/**
 * The parser reads a Date's local fields. This Date's local fields are New
 * York's wall clock at `at`, whatever zone the server runs in.
 */
export function toNyWall(at: Date): Date {
  const [y, mo, d, h, mi, s] = wallFields(at);
  return new Date(y, mo, d, h, mi, s);
}

/** The instant whose New York wall clock is `wall`'s local fields (the inverse of {@link toNyWall}). */
export function fromNyWall(wall: Date): Date {
  const want = Date.UTC(wall.getFullYear(), wall.getMonth(), wall.getDate(), wall.getHours(), wall.getMinutes(), wall.getSeconds());
  const offsetAt = (t: number) => {
    const [y, mo, d, h, mi, s] = wallFields(new Date(t));
    return Date.UTC(y, mo, d, h, mi, s) - t;
  };
  // Two passes settle the offset on either side of a daylight-saving change.
  const first = want - offsetAt(want);
  const second = want - offsetAt(first);
  const lands = (t: number) => {
    const [y, mo, d, h, mi, s] = wallFields(new Date(t));
    return Date.UTC(y, mo, d, h, mi, s) === want;
  };
  if (lands(second)) return new Date(second);
  if (lands(first)) return new Date(first);
  // A wall time the spring change skips (02:30 on its day): the moment the clocks jump past it.
  return new Date(Math.max(first, second));
}

/** Parsed once per distinct value: about a thousand restrooms share a few hundred strings. */
const parsed = new Map<string, OpeningHours | null>();
function parse(value: string): OpeningHours | null {
  if (parsed.has(value)) return parsed.get(value) ?? null;
  let oh: OpeningHours | null = null;
  try {
    // Mode 0: time ranges only, the opening_hours tag's own mode.
    oh = new OpeningHours(value, NOMINATIM, 0);
  } catch {
    oh = null;
  }
  if (parsed.size > 5000) parsed.clear();
  parsed.set(value, oh);
  return oh;
}

/** True when the OSM value parses. */
function isReadableHours(value: string): boolean {
  return parse(value) !== null;
}

export interface OpenStateOptions {
  now: Date;
  /** When we last fetched this record from its source (ISO or Date); older than {@link STALE_DAYS} is stale. */
  fetchedAt: string | Date | null;
  /**
   * After the day's last closing the place may still be open ("8am-4pm, Open
   * later seasonally"): closed then reads as unknown, never closed.
   */
  mayOpenLater?: boolean;
}

/** No fetch date, or one more than {@link STALE_DAYS} days before `now`. */
function isStale(fetchedAt: string | Date | null, now: Date): boolean {
  const fetched = fetchedAt ? new Date(fetchedAt) : null;
  return !fetched || Number.isNaN(fetched.getTime()) || now.getTime() - fetched.getTime() > STALE_DAYS * DAY_MS;
}

/** Open, closed or unknown at `now`, from an OSM `opening_hours` value. */
export function openState(value: string | null, opts: OpenStateOptions): OpenState {
  if (isStale(opts.fetchedAt, opts.now)) return UNKNOWN("stale");
  if (!value?.trim()) return UNKNOWN("missing");
  const oh = parse(value.trim());
  if (!oh) return UNKNOWN("unclear");
  const wall = toNyWall(opts.now);
  try {
    if (oh.getUnknown(wall)) return UNKNOWN("unclear");
    const next = oh.getNextChange(wall, new Date(wall.getTime() + 7 * DAY_MS));
    const iso = next ? fromNyWall(next).toISOString() : null;
    if (oh.getState(wall)) return { status: "open", until: iso, opensAt: null, reason: null };
    if (opts.mayOpenLater && !(next && next.getDate() === wall.getDate() && next.getMonth() === wall.getMonth())) return UNKNOWN("unclear");
    return { status: "closed", until: null, opensAt: iso, reason: null };
  } catch {
    return UNKNOWN("unclear");
  }
}

// ---- The city list's free-text hours ---------------------------------------

const DAYS: Record<string, string> = { mon: "Mo", tue: "Tu", wed: "We", thu: "Th", fri: "Fr", sat: "Sa", sun: "Su" };
const TIME = String.raw`(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?`;
const RANGE = new RegExp(String.raw`^${TIME}\s*(?:-|–|to)\s*${TIME}$`, "i");

function clock(h: string, m: string | undefined, ampm: string | undefined): number | null {
  let hour = Number(h);
  const min = Number(m ?? 0);
  if (hour > 24 || min > 59) return null;
  const mer = ampm?.replace(/\./g, "").toLowerCase();
  if (mer === "pm" && hour < 12) hour += 12;
  if (mer === "am" && hour === 12) hour = 0;
  return hour * 60 + min;
}

const hhmm = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

/** "10:00 am - 6:00 pm" → "10:00-18:00". A range that ends before it starts is a typo in the city list, so null. */
function rangeToOsm(text: string): string | null {
  const m = RANGE.exec(text.trim());
  if (!m) return null;
  // "8-4pm": a missing meridian takes the other end's, then a morning start is assumed.
  const startMer = m[3] ?? (m[6] && clock(m[1], m[2], m[6])! > clock(m[4], m[5], m[6])! ? "am" : m[6]);
  const a = clock(m[1], m[2], startMer);
  const b = clock(m[4], m[5], m[6] ?? m[3]);
  if (a === null || b === null || b <= a) return null;
  return `${hhmm(a)}-${hhmm(b)}`;
}

/** Two-letter days, HH:MM times and OSM punctuation only. */
const OSM_LIKE = /^(?:Mo|Tu|We|Th|Fr|Sa|Su|PH|off|[\d:,;\- ])+$/;

export interface CityHours {
  /** The same hours in OSM syntax. */
  value: string;
  /** The text says it may stay open past these hours (seasonally). */
  mayOpenLater: boolean;
}

/**
 * The city list's hours text in OSM syntax, or null when it says something
 * this does not read (seasons, cleaning breaks, "dusk"). Null means unknown.
 */
export function cityHoursToOsm(text: string | null): CityHours | null {
  const raw = text?.trim();
  if (!raw) return null;
  if (/^(open\s*)?(24\s*hours|24\/7)$/i.test(raw)) return { value: "24/7", mayOpenLater: false };
  // Already OSM syntax ("Mo-Su 08:00-16:00"). The parser forgives a lot, so free text such as
  // "Tuesday: 10:00 pm - 7:00 pm" (a typo for 10 am) must not reach it this way.
  if (OSM_LIKE.test(raw) && /\d{2}:\d{2}/.test(raw) && isReadableHours(raw)) return { value: raw, mayOpenLater: false };

  // One line per day: "Monday: 10:00 am - 6:00 pm", "Sunday\tCLOSED".
  const lines = raw.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const dayLine = /^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\s*[:\t ]\s*(.+)$/i;
  if (lines.length > 1 && lines.every((l) => dayLine.test(l))) {
    const rules: string[] = [];
    for (const l of lines) {
      const [, day, rest] = dayLine.exec(l)!;
      const d = DAYS[day.toLowerCase()];
      if (/^closed$/i.test(rest.trim())) rules.push(`${d} off`);
      else {
        const r = rangeToOsm(rest);
        if (!r) return null;
        rules.push(`${d} ${r}`);
      }
    }
    const value = rules.join("; ");
    return isReadableHours(value) ? { value, mayOpenLater: false } : null;
  }

  // One range for every day: "8am-4pm", "6:00am-8:00pm Daily", "Everyday 8:00 am-10:00 pm",
  // optionally ", Open later seasonally".
  const later = /,?\s*open later seasonally\.?$/i;
  const mayOpenLater = later.test(raw);
  const core = raw.replace(later, "").replace(/^(every\s*day|daily)\s*/i, "").replace(/\s*(every\s*day|daily)$/i, "").trim();
  const r = rangeToOsm(core);
  if (!r) return null;
  return { value: `Mo-Su ${r}`, mayOpenLater };
}

const CLOSED_STATUS = /not operational|closed/i;
const CLOSED_HOURS = /^(temp(orarily)?\.?\s*)?closed$/i;

/** A city restroom's state: its status first (Not Operational, Closed for Construction), then its hours. */
export function cityOpenState(hours: string | null, status: string | null, opts: Omit<OpenStateOptions, "mayOpenLater">): OpenState {
  if ((status && CLOSED_STATUS.test(status)) || (hours && CLOSED_HOURS.test(hours.trim()))) return { status: "closed", until: null, opensAt: null, reason: null };
  const osm = cityHoursToOsm(hours);
  if (!osm) return isStale(opts.fetchedAt, opts.now) ? UNKNOWN("stale") : UNKNOWN(hours?.trim() ? "unclear" : "missing");
  return openState(osm.value, { ...opts, mayOpenLater: osm.mayOpenLater });
}
