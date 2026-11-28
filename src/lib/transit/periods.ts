/**
 * The line panel's four time buttons (docs/PLAN-notice-walks.md, step 5), in New York time:
 * Day is Mon–Fri 6 AM to 9 PM, Night is Mon–Thu 9 PM to 6 AM, Weekend day is Sat–Sun 6 AM to 9 PM,
 * and Weekend night is Fri, Sat and Sun from 9 PM to 6 AM. No React here.
 */
import type { LineDay } from "./weekend";

export const PERIODS = [["day", "Day"], ["night", "Night"], ["weekendDay", "Weekend day"], ["weekendNight", "Weekend night"]] as const;
export type PeriodKey = (typeof PERIODS)[number][0];

/** One stretch of time, epoch seconds [start, end). */
export type Span = [number, number];
/** A period's current or next occurrence: its stretches, the whole window to ask the server for, and its dates in one short line. */
export interface Occurrence { spans: Span[]; from: number; to: number; label: string }

const HOUR = 3_600_000;
// One formatter, made once: building one per call made a week of occurrences take seconds.
const PARTS = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", hourCycle: "h23" });
const parts = (ms: number) => Object.fromEntries(PARTS.formatToParts(ms).map((x) => [x.type, x.value]));

/** Which button an instant falls under. A night belongs to the evening it started on (Sunday 3 AM is Saturday's night). */
export function periodAt(ms: number): PeriodKey {
  const p = parts(ms), h = Number(p.hour), wd = "SunMonTueWedThuFriSat".indexOf(p.weekday) / 3;
  if (h >= 6 && h < 21) return wd % 6 ? "day" : "weekendDay";
  const started = (h < 6 ? wd + 6 : wd) % 7;
  return started > 4 || !started ? "weekendNight" : "night";
}

/**
 * The period's occurrence now or next, read an hour at a time in New York wall-clock hours, so a night across a
 * clock change is 8 or 10 hours long. Day and Night are one stretch; a weekend button gathers the weekend's stretches
 * still to come (on Saturday afternoon, Weekend night is Saturday's and Sunday's nights).
 */
export function occurrence(key: PeriodKey, ms = Date.now()): Occurrence {
  const spans: Span[] = [];
  for (let t = Math.floor(ms / HOUR) * HOUR, n = 0; n < 9 * 24; n++, t += HOUR) {
    if (periodAt(t) !== key) continue;
    const s = t / 1000, last = spans[spans.length - 1];
    if (last?.[1] === s) last[1] += 3600;
    else if (!last || (key[0] === "w" && s - last[1] < 86_400)) spans.push([s, s + 3600]);
    else break;
  }
  const [s0, e0] = spans[0], ls = spans[spans.length - 1][0];
  const at = (s: number) => parts(s * 1000);
  const date = (s: number) => { const p = at(s); return `${p.weekday} ${p.month} ${p.day}`; };
  const hour = (s: number) => { const h = Number(at(s).hour); return `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`; };
  // "6 AM to 9 PM", or a night's "9 PM to Fri 6 AM"; a weekend's nights end on their own mornings.
  const until = `${spans.length > 1 || at(e0).day === at(s0).day ? "" : `${at(e0).weekday} `}${hour(e0)}`;
  const label = s0 * 1000 <= ms ? `Now, until ${until}`
    : spans.length === 1 ? `${date(s0)}, ${hour(s0)} to ${until}`
    : `${date(s0)} ${spans.length === 2 ? "and" : "to"} ${date(ls)}${key === "weekendNight" ? " nights" : ""}, ${hour(s0)} to ${until}`;
  return { spans, from: s0, to: spans[spans.length - 1][1], label };
}

/**
 * Whether any window ([start, end], end 0 = open-ended) touches any stretch. A notice passes every window it carries
 * (#279), or its one start and end; an outage its from and to. All zeros reads as running all the time.
 */
export const inEffect = (windows: Array<[number, number]>, spans: Span[]): boolean =>
  windows.some(([s, e]) => spans.some(([ps, pe]) => s < pe && (!e || e > ps)));

/**
 * The button for a time an answer asked about: the period 13 hours into it. "This weekend" starts Friday 9 PM, so
 * Saturday 10 AM, Weekend day; a named day starts at midnight, so its 1 PM, Day or Weekend day.
 */
export const periodFor = (day: LineDay): PeriodKey => periodAt((day.from + 13 * 3600) * 1000);
