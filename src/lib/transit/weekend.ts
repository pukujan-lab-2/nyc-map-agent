/** Planned-work time windows in New York time, shared by the line panel and the agent (no React here). */
export interface LineDay { from: number; to: number; label: string }

const TZ = "America/New_York";
/** New York wall-clock parts of an instant. */
function nyParts(ms: number) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", weekday: "short", hourCycle: "h23" }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), h: Number(p.hour), wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday) };
}
/** Epoch seconds of a New York wall-clock time (DST-correct: the offset is read at that instant). */
export function nyEpoch(y: number, m: number, d: number, h: number): number {
  const wall = Date.UTC(y, m - 1, d, h);
  const offsetAt = (ms: number) => { const p = nyParts(ms); return Date.UTC(p.y, p.m - 1, p.d, p.h) - ms; };
  // Read the offset once at the wall time taken as UTC, then again at the answer: the first read can land on the
  // other side of a clock change (6 AM on the March Sunday came out as 7 AM).
  const first = wall - offsetAt(wall);
  const second = wall - offsetAt(first);
  // An hour the clocks skip (2 AM in March) has no answer: take the hour after, as the first read gives.
  return Math.round((nyParts(second).h === h ? second : first) / 1000);
}

/**
 * The weekend as the MTA schedules work: Friday 9 pm to Monday 5 am, New York time. On a weekend
 * (or Friday night) it is the one under way; otherwise the coming one.
 */
export function weekendWindow(nowMs = Date.now()): LineDay {
  const n = nyParts(nowMs);
  const back = n.wd === 6 ? 1 : n.wd === 0 ? 2 : n.wd === 1 && n.h < 5 ? 3 : n.wd - 5;
  const fri = new Date(Date.UTC(n.y, n.m - 1, n.d - back));
  const from = nyEpoch(fri.getUTCFullYear(), fri.getUTCMonth() + 1, fri.getUTCDate(), 21);
  const mon = new Date(Date.UTC(n.y, n.m - 1, n.d - back + 3));
  return { from, to: nyEpoch(mon.getUTCFullYear(), mon.getUTCMonth() + 1, mon.getUTCDate(), 5), label: "This weekend" };
}

/** The whole New York day of an instant, into the small hours after (overnight work belongs to it). */
export function dayWindow(ms: number): LineDay {
  const n = nyParts(ms);
  const from = nyEpoch(n.y, n.m, n.d, 0);
  const label = new Date(ms).toLocaleDateString("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" });
  return { from, to: from + 29 * 3600, label };
}
