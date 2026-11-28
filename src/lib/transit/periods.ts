/**
 * The line panel's four time buttons (docs/PLAN-notice-walks.md, step 5), in New York time:
 * Day is Mon–Fri 6 AM to 9 PM, Night is Mon–Thu 9 PM to 6 AM, Weekend day is Sat–Sun 6 AM to 9 PM,
 * and Weekend night is Fri, Sat and Sun from 9 PM to 6 AM. No React here.
 */
import { nyEpoch, type LineDay } from "./weekend";

export type PeriodKey = "day" | "night" | "weekendDay" | "weekendNight";
export const PERIOD_KEYS: PeriodKey[] = ["day", "night", "weekendDay", "weekendNight"];
export const PERIOD_LABEL: Record<PeriodKey, string> = { day: "Day", night: "Night", weekendDay: "Weekend day", weekendNight: "Weekend night" };

/** One stretch of time, epoch seconds [start, end). */
export type Span = [number, number];
/** A period's next (or current) occurrence: its stretches, the whole window to ask the server for, and its dates in one short line. */
export interface Occurrence { key: PeriodKey; spans: Span[]; from: number; to: number; label: string }

const TZ = "America/New_York";
const DAY_H = 6, NIGHT_H = 21;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** A New York calendar date, kept as plain numbers so day arithmetic never meets a clock change. */
interface Ymd { y: number; m: number; d: number }
function nyDate(ms: number): Ymd & { wd: number; h: number } {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", weekday: "short", hourCycle: "h23" }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), h: Number(p.hour), wd: WEEKDAYS.indexOf(p.weekday) };
}
const addDays = (t: Ymd, n: number): Ymd => {
  const u = new Date(Date.UTC(t.y, t.m - 1, t.d + n));
  return { y: u.getUTCFullYear(), m: u.getUTCMonth() + 1, d: u.getUTCDate() };
};
const weekday = (t: Ymd) => new Date(Date.UTC(t.y, t.m - 1, t.d)).getUTCDay();
const at = (t: Ymd, h: number) => nyEpoch(t.y, t.m, t.d, h);
/** The day stretch of a date, 6 AM to 9 PM. */
const daySpan = (t: Ymd): Span => [at(t, DAY_H), at(t, NIGHT_H)];
/** The night that starts on a date, 9 PM to 6 AM the next morning (8 or 10 hours across a clock change). */
const nightSpan = (t: Ymd): Span => [at(t, NIGHT_H), at(addDays(t, 1), DAY_H)];

/** Which button an instant falls under. A night belongs to the evening it started on (Sunday 3 AM is Saturday's night). */
export function periodAt(ms: number): PeriodKey {
  const n = nyDate(ms);
  if (n.h >= DAY_H && n.h < NIGHT_H) return n.wd === 0 || n.wd === 6 ? "weekendDay" : "day";
  const started = n.h < DAY_H ? (n.wd + 6) % 7 : n.wd;
  return started === 5 || started === 6 || started === 0 ? "weekendNight" : "night";
}

/** The stretches of one occurrence of a period that holds `date`: one weekday or night, or a whole weekend. */
function group(key: PeriodKey, date: Ymd): Span[] | null {
  const wd = weekday(date);
  switch (key) {
    case "day": return wd >= 1 && wd <= 5 ? [daySpan(date)] : null;
    case "night": return wd >= 1 && wd <= 4 ? [nightSpan(date)] : null;
    // A weekend is named by its Saturday.
    case "weekendDay": return wd === 6 ? [daySpan(date), daySpan(addDays(date, 1))] : null;
    case "weekendNight": return wd === 6 ? [nightSpan(addDays(date, -1)), nightSpan(date), nightSpan(addDays(date, 1))] : null;
  }
}

/**
 * The period's occurrence now or next: the stretches not yet over, from the first group that still has one.
 * On a Saturday afternoon, Weekend night is Saturday's and Sunday's nights; Friday's has passed.
 */
export function occurrence(key: PeriodKey, ms = Date.now()): Occurrence {
  const now = Math.floor(ms / 1000);
  // Start a day back so a night that began yesterday evening is still found.
  const today = nyDate(ms);
  for (let i = -1; i <= 8; i++) {
    const spans = group(key, addDays(today, i))?.filter(([, end]) => end > now);
    if (spans?.length) return { key, spans, from: spans[0][0], to: spans[spans.length - 1][1], label: spanLabel(key, spans, now) };
  }
  throw new Error(`no ${key} within a week`); // unreachable: every period comes round each week
}

const fmt = (s: number, o: Intl.DateTimeFormatOptions) => new Date(s * 1000).toLocaleString("en-US", { timeZone: TZ, ...o });
/** "Fri Nov 27" */
const dateOf = (s: number) => fmt(s, { weekday: "short", month: "short", day: "numeric" }).replace(",", "");
/** "6 AM", "9 PM" */
const hourOf = (s: number) => fmt(s, { hour: "numeric" });
const wdOf = (s: number) => fmt(s, { weekday: "short" });

/** The period's dates in one short line, as the approved preview writes them. */
function spanLabel(key: PeriodKey, spans: Span[], now: number): string {
  const [s0, e0] = spans[0];
  const last = spans[spans.length - 1];
  if (s0 <= now) {
    // Under way: the rest of this stretch. "Now, until 9 PM"; a night ending tomorrow names its morning.
    return `Now, until ${dateOf(e0) === dateOf(now) ? "" : `${wdOf(e0)} `}${hourOf(e0)}`;
  }
  const night = key === "night" || key === "weekendNight";
  if (spans.length === 1) return night ? `${dateOf(s0)}, 9 PM to ${wdOf(e0)} 6 AM` : `${dateOf(s0)}, 6 AM to 9 PM`;
  const days = spans.length === 2 ? `${dateOf(s0)} and ${dateOf(last[0])}` : `${dateOf(s0)} to ${dateOf(last[0])}`;
  return night ? `${days} nights, 9 PM to 6 AM` : `${days}, 6 AM to 9 PM`;
}

/** Whether any of a notice's windows ([start, end], end 0 = open-ended) touches any stretch. */
export function overlaps(windows: Array<[number, number]>, spans: Span[]): boolean {
  return windows.some(([s, e]) => spans.some(([ps, pe]) => s < pe && (!e || e > ps)));
}

/**
 * Whether a service notice is in effect during the period: every window it carries (#279) when it has them,
 * else its one start and end. A notice with neither is taken as running all the time.
 */
export function alertInEffect(a: { windows?: Array<[number, number]>; start?: number; end?: number }, spans: Span[]): boolean {
  if (a.windows?.length) return overlaps(a.windows, spans);
  if (!a.start && !a.end) return true;
  return overlaps([[a.start ?? 0, a.end ?? 0]], spans);
}

/** Whether an elevator or escalator is out during the period (to 0 = no return time given). */
export function outageInEffect(o: { from?: number; to?: number }, spans: Span[]): boolean {
  if (!o.from && !o.to) return true;
  return overlaps([[o.from ?? 0, o.to ?? 0]], spans);
}

/**
 * The button for a time an answer asked about (an agent's "this weekend" or a named day): the period whose
 * occurrence from that time shares the most hours with it. Ties go to the earlier button.
 */
export function periodFor(day: LineDay): PeriodKey {
  let best: PeriodKey = "day", most = -1;
  for (const key of PERIOD_KEYS) {
    const { spans } = occurrence(key, day.from * 1000);
    const shared = spans.reduce((sum, [s, e]) => sum + Math.max(0, Math.min(e, day.to) - Math.max(s, day.from)), 0);
    if (shared > most) { best = key; most = shared; }
  }
  return best;
}
