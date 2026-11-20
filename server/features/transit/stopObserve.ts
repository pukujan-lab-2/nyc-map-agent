/**
 * Measures how long subway trains are at stations, from successive snapshots of the live feed.
 *
 * The feed's own stop times are not measurements. A separate departure time appears only at
 * scheduled holds, as a constant (30 s on the 1 to 5, 60 s on the 6, 20 s on the 7, 15 s on the L),
 * and never on the lettered lines. While a train of the 1 to 6 is stopped, the feed lists its
 * "arrival" at that stop as the vehicle report's timestamp plus exactly 30 s (77% of 1,619 stopped
 * reports in a live sample; the rest are holds). So timing a stop from the feed's arrival only
 * gives back the timing below less that constant, and is not stored.
 *
 * What is measured is the train's own vehicle report. The MTA's feed reference says the report's
 * timestamp is the train's last detected movement. The train arrives when that timestamp stops (the
 * first "stopped at" report carries it) and leaves between the last snapshot that still says
 * "stopped at" and the next report's timestamp. In a 520 s live sample this reads a median of 54 s
 * over 587 stops (45 to 67 s for the middle three fifths).
 *
 * What that number is has not been checked against a stopwatch. It may be the time the train
 * stands still, or it may start as the train enters the station and so include the run along the
 * platform. Until someone times a few stops by hand, read it as "time at the station".
 *
 * Only the numbered lines and the 7 are measured. On the lettered lines the vehicle timestamp is
 * simply the feed's predicted arrival (equal in all 959 stopped reports sampled), and on the L it
 * does not stand still at a station, so there is nothing to time (live samples, 2026-11-20).
 *
 * Each observation carries `slack`: half the gap between the two snapshots the departure fell
 * between, which is how far off `seconds` can be.
 */
import type { TransitTrip } from "./routes";

export type StopObs = {
  /** When the train left (unix seconds, the middle of the window it left in). */
  observedAt: number;
  route: string;
  dir: number | null;
  /** Platform id, e.g. "127S". */
  stop: string;
  seconds: number;
  slack: number;
  tripId: string;
};

/** Lines whose vehicle timestamp was checked to stand still while the train is stopped. */
export const MEASURED_ROUTES: ReadonlySet<string> = new Set(["1", "2", "3", "4", "5", "6", "6X", "7", "7X"]);
/** A stop longer than this is a hold or a stale report, kept out of the record. */
const MAX_STOP_S = 15 * 60;
/** A departure window wider than this says too little about when the train left. */
const MAX_SLACK_S = 30;

/** The stop a train is stopped at, when it arrived, and the last snapshot that still said so. */
type TripState = { seen: number; at?: string; arrived?: number; stillAt?: number };

export class StopObserver {
  private trips = new Map<string, TripState>();

  /** Feed one snapshot taken at `at` (unix seconds); returns the stops it completes. */
  ingest(trips: TransitTrip[], at: number): StopObs[] {
    const out: StopObs[] = [];
    for (const t of trips) {
      if (!MEASURED_ROUTES.has(t.route) || !t.stops.length) continue;
      const s = this.trips.get(t.id) ?? { seen: at };
      const last = t.stops[t.stops.length - 1][0];
      // Stopped at a stop that is neither the origin it waits at nor its terminal.
      const stopped = t.st === 1 && t.at !== undefined && t.vt !== undefined && t.at !== last && !(t.origin && t.at === t.stops[0][0]);
      if (s.at !== undefined && (!stopped || t.at !== s.at)) {
        // It has left: after the last snapshot that said "stopped at", and no later than its newest movement.
        const lower = s.stillAt!, upper = Math.max(lower, Math.min(at, t.vt !== undefined && t.vt > lower ? t.vt : at));
        const left = (lower + upper) / 2, slack = (upper - lower) / 2, seconds = left - s.arrived!;
        if (seconds > 0 && seconds <= MAX_STOP_S && slack <= MAX_SLACK_S) out.push({ observedAt: Math.round(left), route: t.route, dir: t.dir, stop: s.at, seconds, slack, tripId: t.id });
        s.at = s.arrived = s.stillAt = undefined;
      }
      if (stopped) {
        if (s.at === undefined) { s.at = t.at; s.arrived = t.vt; }
        s.stillAt = at;
      }
      s.seen = at;
      this.trips.set(t.id, s);
    }
    for (const [id, s] of this.trips) if (at - s.seen > 900) this.trips.delete(id);
    return out;
  }
}
