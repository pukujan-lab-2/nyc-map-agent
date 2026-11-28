/**
 * The open-now state the server works out in New York time
 * (server/lib/openingHours.ts), and the short line a restroom row shows.
 * Times are shown in New York time too, whatever zone the phone is in.
 */
export interface OpenState {
  status: "open" | "closed" | "unknown";
  until: string | null;
  opensAt: string | null;
  reason: "missing" | "stale" | "unclear" | null;
}

export const UNKNOWN: OpenState = { status: "unknown", until: null, opensAt: null, reason: "missing" };

/** A response can sit in a cache for a while: past its closing time an open place is closed, and past its opening time a closed one is unknown until the next fetch. */
export function stateAt(s: OpenState | null | undefined, now: Date): OpenState {
  if (!s) return UNKNOWN;
  if (s.status === "open" && s.until && now.getTime() >= Date.parse(s.until)) return { status: "closed", until: null, opensAt: null, reason: null };
  if (s.status === "closed" && s.opensAt && now.getTime() >= Date.parse(s.opensAt)) return { ...UNKNOWN, reason: "stale" };
  return s;
}

const ny = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", ...opts });
const TIME = ny({ hour: "numeric", minute: "2-digit" });
const DAY = ny({ weekday: "short" });
const DATE = ny({ year: "numeric", month: "2-digit", day: "2-digit" });

/** "7 PM", "7:30 PM"; with the weekday ("Mon 8 AM") when it is not today in New York. */
export function clockLabel(iso: string, now: Date): string {
  const d = new Date(iso);
  const t = TIME.format(d).replace(":00", "");
  return DATE.format(d) === DATE.format(now) ? t : `${DAY.format(d)} ${t}`;
}

/** "Open until 7 PM", "Open 24 hours", "Closed · opens 8 AM", "Hours may have changed". */
export function hoursLabel(s: OpenState, now: Date): string {
  if (s.status === "open") return s.until ? `Open until ${clockLabel(s.until, now)}` : "Open 24 hours";
  if (s.status === "closed") return s.opensAt ? `Closed · opens ${clockLabel(s.opensAt, now)}` : "Closed";
  return "Hours may have changed";
}
