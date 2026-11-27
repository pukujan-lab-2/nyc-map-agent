/**
 * Station dwell and motion along a trip: trains stop at stations, ease in and
 * out, sit at their origin until departure and stop at the terminal.
 *
 * Hold times are estimates; GTFS has no official "hold" flag. Realtime
 * arrival + departure pairs always win over these defaults.
 *
 * The gap between two arrivals is split run first: the run to the next stop
 * gets the time a train needs for that distance, and the stop gets what is
 * left, up to the default. A long default can no longer squeeze the run until
 * the train races.
 */
import holds from "./holds.json";

/** Seconds a train sits at an ordinary stop. */
export const DWELL_DEFAULT = 30;
/** Major transfer complexes (crowded platforms). */
export const DWELL_COMPLEX = 50;
/** Express/local transfer points where trains wait for cross-platform transfers. */
export const DWELL_EXPRESS_LOCAL = 60;
/** How long a train stays visible at its terminal before it leaves the map. */
export const DWELL_TERMINAL = 60;
/** Never let a default dwell take more than this share of the gap to the next arrival. */
const MAX_DWELL_SHARE = 0.5;
/** The shortest stop drawn when the gap leaves no room for more: doors open and close. */
export const DWELL_MIN = 10;

/** Subway car performance: acceleration and service braking (m/s²) and top speed (m/s, 55 mph). */
const ACCEL = 1.1, BRAKE = 1.3, TOP_SPEED = 24.6;
/**
 * How much longer a real run takes than the fastest one the car could make. Measured on 1,755 station
 * pairs over seven days (13 to 19 November 2026, subwaydata.nyc): the median time from one arrival to
 * the next is 2.04 times the fastest possible run, and taking 1.5 times as the run leaves a median stop
 * of 28 s (19 to 44 s for the middle half), which matches what the feed shows for stops.
 */
const RUN_FACTOR = 1.5;

/** The fastest a train can cover `metres` from a standstill to a standstill (s). */
export function fastestRun(metres: number): number {
  const d = Math.max(0, metres);
  const reachesTop = TOP_SPEED * TOP_SPEED / (2 * ACCEL) + TOP_SPEED * TOP_SPEED / (2 * BRAKE);
  return d >= reachesTop
    ? d / TOP_SPEED + TOP_SPEED / (2 * ACCEL) + TOP_SPEED / (2 * BRAKE)
    : Math.sqrt(2 * d * (ACCEL + BRAKE) / (ACCEL * BRAKE));
}
/** The time a subway run of `metres` normally takes (s). */
export const typicalRun = (metres: number) => RUN_FACTOR * fastestRun(metres);

/** Curated major complexes, matched by station name (any parent id with this name). */
export const MAJOR_COMPLEXES = [
  "Times Sq-42 St",
  "Grand Central-42 St",
  "14 St-Union Sq",
  "Atlantic Av-Barclays Ctr",
  "Fulton St",
  "34 St-Herald Sq",
  "59 St-Columbus Circle",
  "Jackson Hts-Roosevelt Av",
  "74 St-Broadway",
];

/** Parent station ids derived from GTFS (scripts/build-transit-holds.ts) plus overrides. */
export const EXPRESS_LOCAL_STATIONS: ReadonlySet<string> = new Set([...holds.derived, ...holds.add].filter((s) => !holds.remove.includes(s)));

/** Default dwell in seconds for a parent station id / name. */
export function defaultDwell(stationId: string, name?: string): number {
  if (EXPRESS_LOCAL_STATIONS.has(stationId)) return DWELL_EXPRESS_LOCAL;
  if (name && MAJOR_COMPLEXES.includes(name)) return DWELL_COMPLEX;
  return DWELL_DEFAULT;
}

/** Smooth start and stop (cosine ease-in-out): zero speed at both ends. */
export const ease = (f: number) => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, f)))) / 2;

/** One stop on a trip: arrival, optional realtime departure, distance along shape. */
export type MotionStop = { id: string; arr: number; dep?: number; m: number };
export type Motion =
  | { phase: "origin"; i: number; m: number; departs: number }
  | { phase: "dwell"; i: number; m: number; departs: number }
  | { phase: "moving"; i: number; m: number; f: number }
  | { phase: "terminal"; i: number; m: number; arrived: number };

/**
 * When the drawn train leaves stop `i`: the feed's departure when it gives one, else the arrival plus
 * the stop the gap to the next arrival leaves (see `motionAt`). The last stop has no departure.
 */
export function departureOf(stops: MotionStop[], i: number, dwellOf: (s: MotionStop) => number, runOf?: (from: MotionStop, to: MotionStop) => number): number {
  const s = stops[i];
  if (s.dep !== undefined && s.dep >= s.arr) return s.dep;
  if (i === stops.length - 1) return s.arr;
  const gap = Math.max(0, stops[i + 1].arr - s.arr);
  const most = Math.min(dwellOf(s), gap * MAX_DWELL_SHARE);
  if (!runOf) return s.arr + most;
  return s.arr + Math.min(most, Math.max(DWELL_MIN, gap - runOf(s, stops[i + 1])));
}

/**
 * Where along the shape (metres) the train is at `now`.
 * - `dep` given by the feed wins; otherwise dep = arr + dwell, capped so the
 *   next arrival time still holds. With `runOf`, the run to the next stop is
 *   given its time first and the dwell takes the rest (never under DWELL_MIN
 *   while the gap allows it); without it, the dwell is only capped at half the gap.
 * - Between stops: eased from dep(i) to arr(i+1).
 * - `origin`: the first stop is the trip's origin; the train waits there until
 *   it departs. Otherwise, before the first known stop we extrapolate back.
 * - After the last arrival the train dwells `terminalDwell` s, then null.
 */
export function motionAt(
  stops: MotionStop[],
  now: number,
  dwellOf: (s: MotionStop) => number,
  opts: { origin?: boolean; terminal?: boolean; terminalDwell?: number; runOf?: (from: MotionStop, to: MotionStop) => number } = {},
): Motion | null {
  const n = stops.length;
  if (!n) return null;
  const depOf = (i: number) => departureOf(stops, i, dwellOf, opts.runOf);
  const first = stops[0];
  if (now < first.arr || (opts.origin && now < depOf(0))) {
    if (opts.origin) return { phase: "origin", i: 0, m: first.m, departs: n > 1 ? depOf(0) : first.arr };
    if (n < 2) return { phase: "moving", i: 0, m: first.m, f: 1 };
    // Feeds drop passed stops: run back along the first leg's speed (capped).
    const speed = (stops[1].m - first.m) / Math.max(1, stops[1].arr - depOf(0));
    const back = Math.sign(speed) * Math.min(Math.abs(speed * (first.arr - now)), 1500);
    return { phase: "moving", i: 0, m: first.m - back, f: 0 };
  }
  for (let i = 0; i < n; i++) {
    const s = stops[i];
    if (i === n - 1) {
      if (opts.terminal === false) return now <= s.arr ? { phase: "dwell", i, m: s.m, departs: s.arr } : null;
      const until = (s.dep ?? s.arr) + (s.dep !== undefined ? 0 : opts.terminalDwell ?? DWELL_TERMINAL);
      return now <= until ? { phase: "terminal", i, m: s.m, arrived: s.arr } : null;
    }
    const dep = depOf(i), next = stops[i + 1];
    if (now < dep) return { phase: "dwell", i, m: s.m, departs: dep };
    if (now < next.arr) {
      const f = (now - dep) / Math.max(1e-6, next.arr - dep);
      return { phase: "moving", i, m: s.m + (next.m - s.m) * ease(f), f };
    }
  }
  return null;
}

type Pattern = { route: string; stops: string[] };

/**
 * Express/local transfer points from static GTFS stop patterns: two patterns
 * (same or different routes) that stop at consecutive common stations A and B,
 * where one runs nonstop (or skips) between them and the other stops at every
 * station the first one does plus at least one more. Both A and B are
 * cross-platform transfer points on a shared trunk. The subset check keeps
 * routes that merely meet at two stations by different lines out.
 */
export function deriveExpressLocal(patterns: Pattern[]): string[] {
  const out = new Set<string>();
  for (let x = 0; x < patterns.length; x++) {
    for (let y = 0; y < patterns.length; y++) {
      if (x === y) continue;
      const exp = patterns[x].stops, loc = patterns[y].stops;
      const locIdx = new Map(loc.map((s, i) => [s, i]));
      for (let i = 0; i + 1 < exp.length; i++) {
        const a = locIdx.get(exp[i]), b = locIdx.get(exp[i + 1]);
        if (a === undefined || b === undefined || b - a < 2) continue;
        out.add(exp[i]);
        out.add(exp[i + 1]);
      }
    }
  }
  return [...out].sort();
}
