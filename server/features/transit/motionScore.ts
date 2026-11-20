/**
 * Scores how the map draws subway trains (#257's follow-up): not whether an arrival time was right
 * (score.ts does that), but whether the motion between arrivals is one a train could make.
 *
 * For each snapshot of the live feed it asks the client's own code (`estimateTrain` and `drawnLegs`,
 * imported, not copied) how every train would be drawn, and counts:
 *  - parked: trains drawn standing at a station that is neither their origin nor their terminal;
 *  - racing: stretches whose drawn run is shorter than the fastest run a subway car can make;
 *  - tight: stretches within a quarter of that.
 * Counts are kept apart for lines with a service notice in effect and lines without, because a
 * disrupted line parks trains for real.
 *
 * Only stretches the map shapes itself are counted: a stretch whose departure the feed supplies is
 * left out, as is one under 150 m (two platforms of one complex) and one that starts more than ten
 * minutes from now, which will be redrawn many times before a train is on it.
 */
import { fastestRun } from "../../../src/features/transit/dwell";
import { lookupFrom, type SegmentLookup, type SegmentRow } from "../../../src/features/transit/history";
import { drawnLegs, estimateTrain, type LiveTrip, type StaticSystem } from "../../../src/features/transit/model";
import type { TransitTrip } from "./routes";

/** A drawn run under this many times the fastest possible one is "tight". */
export const TIGHT_FACTOR = 1.25;
const MIN_LEG_M = 150;
const AHEAD_S = 600;

type MotionTally = { trains: number; parked: number; legs: number; racing: number; tight: number };
type NoticeKey = "yes" | "no" | "unknown";
export type MotionRow = MotionTally & { notice: NoticeKey; snapshots: number };

const empty = (): MotionTally => ({ trains: 0, parked: 0, legs: 0, racing: 0, tight: 0 });

/** One train in one snapshot. */
export function scoreTrip(sys: StaticSystem, trip: LiveTrip, now: number, hist?: SegmentLookup): MotionTally {
  const t = empty();
  const v = estimateTrain(sys, trip, now, undefined, hist);
  // A train waiting at its origin or standing at its terminal is meant to be still.
  if (v && v.stopped?.kind !== "departs" && v.stopped?.kind !== "arrived") {
    t.trains = 1;
    if (v.stopped?.kind === "at") t.parked = 1;
  }
  for (const leg of drawnLegs(sys, trip, now, hist)) {
    if (leg.fromFeed || leg.metres < MIN_LEG_M || leg.leaves - now > AHEAD_S || leg.leaves + leg.run < now) continue;
    const fastest = fastestRun(leg.metres);
    t.legs++;
    if (leg.run < fastest) t.racing++;
    if (leg.run < TIGHT_FACTOR * fastest) t.tight++;
  }
  return t;
}

export class MotionScorer {
  private rows = new Map<NoticeKey, MotionRow>();
  private hist: SegmentLookup;
  /** `segments` are the learned times as the app's clients get them; `notices` the lines with a notice in effect, when known. */
  constructor(private sys: StaticSystem, segments: Record<string, SegmentRow[]>, private notices?: Set<string>) {
    this.hist = lookupFrom(new Map(Object.entries(segments)));
  }

  /** Feed one snapshot (unix seconds `at`). */
  ingest(trips: TransitTrip[], at: number) {
    const seen = new Set<NoticeKey>();
    for (const trip of trips) {
      const key: NoticeKey = this.notices ? (this.notices.has(trip.route) ? "yes" : "no") : "unknown";
      const row = this.rows.get(key) ?? { notice: key, snapshots: 0, ...empty() };
      const t = scoreTrip(this.sys, trip, at, this.hist);
      for (const k of ["trains", "parked", "legs", "racing", "tight"] as const) row[k] += t[k];
      if (!seen.has(key)) { seen.add(key); row.snapshots++; }
      this.rows.set(key, row);
    }
  }

  finish(): MotionRow[] {
    return [...this.rows.values()].filter((r) => r.trains || r.legs);
  }
}
