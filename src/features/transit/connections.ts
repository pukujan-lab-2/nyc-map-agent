/**
 * Which trains have a connection pulling in across the platform.
 *
 * At a transfer station two services stop on either side of one platform in the same direction: a
 * local and its express, or two lines such as the N/W and the 7 at Queensboro Plaza. Riders cross
 * between them, and trains there usually wait for each other (the owner, 2026-11-20). The feed has
 * no flag for that, so this looks at the arrivals themselves: a train connects at a station when a
 * train of another service is due on the same platform from a little before it to a little after.
 *
 * The result only lifts how long such a train may stop (`defaultDwell`'s `connecting`). The stop is
 * still cut to what the gap to its next arrival leaves, so a connection the feed does not show as a
 * longer gap changes nothing.
 */
import { EXPRESS_LOCAL_STATIONS, platformKey } from "./dwell";
import type { LiveTrip } from "./model";

/** A connecting train counts when it is due this long before our train, at most (s): it is still at the platform. */
export const CONNECT_BEFORE_S = 15;
/** ...and this long after, at most (s): worth waiting for. */
export const CONNECT_AFTER_S = 30;
/** Only a trip's next few stops are looked at; later ones are redrawn many times before they matter. */
const AHEAD_STOPS = 3;

const stationOf = (stopId: string) => stopId.replace(/[NS]$/, "");

/** For each trip with a connection, the platform ids (e.g. "127S") where one is pulling in. */
export function connectingStops(trips: LiveTrip[], transfer: ReadonlySet<string> = EXPRESS_LOCAL_STATIONS): Map<string, Set<string>> {
  const due = new Map<string, Array<{ trip: string; route: string; stop: string; arr: number }>>();
  for (const t of trips) {
    for (const [stop, arr] of t.stops.slice(0, AHEAD_STOPS)) {
      if (!transfer.has(stationOf(stop))) continue;
      const key = platformKey(stop);
      const list = due.get(key);
      if (list) list.push({ trip: t.id, route: t.route, stop, arr });
      else due.set(key, [{ trip: t.id, route: t.route, stop, arr }]);
    }
  }
  const out = new Map<string, Set<string>>();
  for (const list of due.values()) {
    for (const a of list) {
      // Another service, not the next train of the same one: that one is behind on the same track.
      if (!list.some((b) => b.route !== a.route && b.arr - a.arr >= -CONNECT_BEFORE_S && b.arr - a.arr <= CONNECT_AFTER_S)) continue;
      const set = out.get(a.trip);
      if (set) set.add(a.stop);
      else out.set(a.trip, new Set([a.stop]));
    }
  }
  return out;
}
