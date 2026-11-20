/**
 * Which live trains are "in trouble": the ones the map should keep where their own vehicle report
 * puts them, however old that report is, instead of moving them on by the timetable
 * (`estimateTrain`'s `troubled` option).
 *
 * A train is in trouble when any of these holds:
 *  - its line has an unplanned delay or detour notice;
 *  - the feed shows it held (src/lib/transit/holds.ts);
 *  - a held train stands at one of its next few stops, so it is about to queue behind it;
 *  - an unplanned delay notice names one of its next few stops (trouble at a station ahead).
 * Trouble behind a train does not slow it, so only the stops ahead are looked at.
 */
import type { LiveTrip } from "./model";
import type { TransitAlert } from "./hooks";

/** How many stops ahead a held train or a troubled station reaches back to the trains approaching it. */
export const TROUBLE_AHEAD_STOPS = 3;

/** A platform id ("A32N") or a station id ("A32") as its station id. */
const station = (id: string) => id.replace(/[NS]$/, "");

/** Stations an active, unplanned delay or detour notice names (not planned work or plain notices). */
export function troubledStations(alerts: TransitAlert[] | undefined): Set<string> {
  return new Set((alerts ?? []).filter((a) => a.kind === "delay" || (a.reroute && a.kind !== "planned")).flatMap((a) => a.stops ?? []).map(station));
}

/**
 * The ids of the trips in trouble. `routes` are the lines with a notice (`alertedRoutes`), `held` the
 * held trains by trip id with the platform each stands at, `stations` the output of `troubledStations`.
 */
export function troubledTrips(trips: LiveTrip[], routes: ReadonlySet<string>, held: ReadonlyMap<string, { stop: string }>, stations: ReadonlySet<string>): Set<string> {
  // A held train blocks its own platform: the same station and direction, whatever line arrives there.
  const blocked = new Map<string, string>();
  for (const [id, h] of held) blocked.set(h.stop, id);
  const out = new Set<string>();
  for (const trip of trips) {
    if (routes.has(trip.route) || held.has(trip.id)) { out.add(trip.id); continue; }
    for (const [stop] of trip.stops.slice(0, TROUBLE_AHEAD_STOPS)) {
      const holder = blocked.get(stop);
      if ((holder !== undefined && holder !== trip.id) || stations.has(station(stop))) { out.add(trip.id); break; }
    }
  }
  return out;
}
