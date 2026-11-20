/**
 * Measures how long subway trains stop at stations, from successive snapshots of the live feed.
 * The feed's own "dwell" is not a measurement: a separate departure time appears only at scheduled
 * holds, as a constant (30 s on the 1 to 5, 60 s on the 6, 20 s on the 7, 15 s on the L), and never
 * on the lettered lines. So the stop is timed two other ways, and both are kept:
 *
 *  - "feed": the feed drops a stop from a trip when the train departs. The stop is that moment
 *    minus the last arrival time the feed predicted for it. This is the closer of the two to the
 *    time a train stands at the platform: a median of 29 s over 438 stops in a live sample.
 *  - "vehicle": the train's vehicle report. The MTA's feed reference says the report's timestamp is
 *    the train's last detected movement. It arrives when that timestamp stops (the first "stopped
 *    at" report carries it) and leaves between the last snapshot that still says "stopped at" and
 *    the next report's timestamp. It reads a median of 54 s over 458 stops in the same sample.
 *
 * Timed on the same 439 stops, "vehicle" is longer than "feed" by a near-constant 25 s (22 to 27 s
 * for the middle three fifths). That fits the vehicle timestamp marking the train entering the
 * station, with the feed's arrival marking it standing still: about 25 s to run in along the
 * platform. Neither has been checked against a stopwatch, so both are stored.
 *
 * Only the numbered lines and the 7 are measured. On the lettered lines and the L the vehicle
 * timestamp does not stand still at a station, and the feed drops each stop a fixed 14 to 30 s
 * after its predicted arrival, so neither way measures anything there (live samples, 2026-11-20).
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
  method: "vehicle" | "feed";
  seconds: number;
  slack: number;
  tripId: string;
};

/** Lines whose vehicle reports and stop drops were checked to track real stops. */
export const MEASURED_ROUTES: ReadonlySet<string> = new Set(["1", "2", "3", "4", "5", "6", "6X", "7", "7X"]);
/** A stop longer than this is a hold or a stale report, kept out of the record. */
const MAX_STOP_S = 15 * 60;
/** A departure window wider than this says too little about when the train left. */
const MAX_SLACK_S = 30;

type TripState = {
  seen: number;
  /** Vehicle method: the stop the train is stopped at, when it arrived, and the last snapshot that still said so. */
  at?: string;
  arrived?: number;
  stillAt?: number;
  /** Feed method: the first listed stop, its last predicted arrival, and the last snapshot that listed it. */
  first?: string;
  firstArr?: number;
  firstSeen?: number;
};

export class StopObserver {
  private trips = new Map<string, TripState>();

  /** Feed one snapshot taken at `at` (unix seconds); returns the stops it completes. */
  ingest(trips: TransitTrip[], at: number): StopObs[] {
    const out: StopObs[] = [];
    for (const t of trips) {
      if (!MEASURED_ROUTES.has(t.route) || !t.stops.length) continue;
      const s = this.trips.get(t.id) ?? { seen: at };
      const last = t.stops[t.stops.length - 1][0];
      const emit = (method: StopObs["method"], stop: string, arrived: number, lower: number, upper: number) => {
        const left = (lower + upper) / 2, slack = (upper - lower) / 2, seconds = left - arrived;
        if (seconds > 0 && seconds <= MAX_STOP_S && slack <= MAX_SLACK_S) out.push({ observedAt: Math.round(left), route: t.route, dir: t.dir, stop, method, seconds, slack, tripId: t.id });
      };

      // Vehicle report: stopped at a stop that is neither the origin it waits at nor its terminal.
      const stopped = t.st === 1 && t.at !== undefined && t.vt !== undefined && t.at !== last && !(t.origin && t.at === t.stops[0][0]);
      if (s.at !== undefined && (!stopped || t.at !== s.at)) {
        // It has left: after the last snapshot that said "stopped at", and no later than its newest movement.
        const upper = Math.max(s.stillAt!, Math.min(at, t.vt !== undefined && t.vt > s.stillAt! ? t.vt : at));
        emit("vehicle", s.at, s.arrived!, s.stillAt!, upper);
        s.at = s.arrived = s.stillAt = undefined;
      }
      if (stopped) {
        if (s.at === undefined) { s.at = t.at; s.arrived = t.vt; }
        s.stillAt = at;
      }

      // Feed: the first listed stop has gone from the list, so the train has left it.
      const [first, firstArr] = t.stops[0];
      if (s.first !== undefined && s.first !== first && t.stops.every(([id]) => id !== s.first) && s.first !== last) {
        emit("feed", s.first, s.firstArr!, s.firstSeen!, at);
      }
      // A train still at its origin has no arrival there to time from.
      if (t.origin) { s.first = undefined; } else { s.first = first; s.firstArr = firstArr; s.firstSeen = at; }
      s.seen = at;
      this.trips.set(t.id, s);
    }
    for (const [id, s] of this.trips) if (at - s.seen > 900) this.trips.delete(id);
    return out;
  }
}
