/**
 * How well today's elevator outages turn into walks (docs/PLAN-notice-walks.md, step 6): how many matched an
 * elevator entrance in our station data, how many were unsure, and which stations the detours send people to have no
 * elevator entrance in our data.
 *
 *   npx tsx scripts/elevator-walk-report.ts             # the MTA's feeds right now
 *   npx tsx scripts/elevator-walk-report.ts --fixture   # the outages saved on 2026-11-27
 *   add --upcoming to count the planned outages too, --json for the full walk data
 *
 * Corners come from the city's corner table (server/features/agent/data/corners.json), the same street
 * intersections the assistant's place lookup reads; the phone uses the map's own corner instead.
 */
import { readFileSync } from "node:fs";
import { bearing, metres, type Pt } from "../src/lib/map/mapRead";
import { elevatorWalk, streetUnitsOf, type ElevatorWalk, type StationRef } from "../src/features/transit/elevatorWalk";
import type { Outage } from "../src/features/transit/hooks";
import type { StaticSystem } from "../src/features/transit/model";
import { findCorner } from "../server/features/agent/corner";
import { slimOutages } from "../server/features/transit/outages";

type Row = Record<string, string>;
const FEED = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2F";
const FIXTURE = "src/features/transit/elevatorWalk.fixtures.json";

/** Manhattan's street grid runs 29° east of true north; its "NE corner" is uptown and east by the grid. */
const MANHATTAN_GRID = 29;

/** Bearing from where the streets meet to a point, from the city's corner table; null when they do not meet within 150 m. */
export function tableBearingOf(at: Pt, streets: string[]): number | null {
  if (streets.length < 2) return null;
  let best: { at: Pt; d: number; borough: string } | null = null;
  for (const borough of ["1", "2", "3", "4", "5"]) {
    const c = findCorner({ a: streets[0], b: streets[1], borough });
    const d = c ? metres(c.at, at) : Infinity;
    if (c && d <= 150 && (!best || d < best.d)) best = { at: c.at, d, borough };
  }
  if (!best) return null;
  return (bearing(best.at, at) - (best.borough === "1" ? MANHATTAN_GRID : 0) + 360) % 360;
}

async function feed(name: string): Promise<Row[]> {
  const res = await fetch(`${FEED}${name}.json`, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return (await res.json()) as Row[];
}

const describe = (r: StationRef) => `${r.name}${r.lines.length ? ` (${r.lines.join("/")})` : ""}`;

async function main() {
  const args = new Set(process.argv.slice(2));
  const saved = args.has("--fixture") ? (JSON.parse(readFileSync(FIXTURE, "utf8")) as { current: Row[]; upcoming: Row[]; equipment: Row[] }) : null;
  const [current, upcoming, equipment] = saved
    ? [saved.current, saved.upcoming, saved.equipment]
    : await Promise.all([feed("nyct_ene"), feed("nyct_ene_upcoming"), feed("nyct_ene_equipments")]);
  const sys = JSON.parse(readFileSync("public/transit/subway.json", "utf8")) as StaticSystem;
  const streetUnits = streetUnitsOf(equipment);
  const outages: Outage[] = slimOutages(current, equipment, args.has("--upcoming") ? upcoming : [])
    .filter((o) => o.equipment === "Elevator")
    .filter((o, i, all) => all.findIndex((x) => x.id === o.id) === i);
  const walks: ElevatorWalk[] = outages.map((o) => elevatorWalk(o, sys, { bearingOf: tableBearingOf, streetUnits }));
  if (args.has("--json")) { console.log(JSON.stringify(walks, null, 1)); return; }

  const street = walks.filter((w) => w.where === "street");
  const count = (s: string) => street.filter((w) => w.entrance.status === s);
  console.log(`${walks.length} elevator outages${args.has("--upcoming") ? " (out now and planned)" : " out now"}: ${street.length} street elevators, ${walks.length - street.length} inside the station.`);
  console.log(`Street elevators matched to an entrance: ${count("matched").length} (${count("matched").map((w) => `${w.id} ${w.station}${w.entrance.status === "matched" ? ` by ${w.entrance.by}` : ""}`).join("; ") || "none"})`);
  console.log(`Unsure: ${count("unsure").length}`);
  for (const w of count("unsure")) if (w.entrance.status === "unsure") console.log(`  ${w.id} ${w.station}: ${w.entrance.why}`);
  console.log(`No elevator entrance in our data at the station: ${count("not-in-data").length}${count("not-in-data").length ? ` (${count("not-in-data").map((w) => `${w.id} ${w.station}`).join("; ")})` : ""}`);
  const withJourneys = walks.filter((w) => w.journeys.length);
  console.log(`Detours read into journeys: ${withJourneys.length} of ${walks.length} (${walks.filter((w) => w.noDetour).length} have no MTA detour)`);

  const gaps = new Map<string, Set<string>>();
  const missing = new Map<string, Set<string>>();
  const unsure = new Map<string, Set<string>>();
  const note = (m: Map<string, Set<string>>, k: string, id: string) => m.set(k, (m.get(k) ?? new Set()).add(id));
  for (const w of walks) {
    for (const r of w.detourStations) {
      if (r.match.status === "found" && !r.match.elevators.length) note(gaps, r.match.name, w.id);
      if (r.match.status === "not-in-data") note(missing, describe(r), w.id);
      if (r.match.status === "unsure") note(unsure, describe(r), w.id);
    }
  }
  const list = (m: Map<string, Set<string>>) => [...m].sort(([a], [b]) => a.localeCompare(b)).map(([k, ids]) => `  ${k}: ${[...ids].join(", ")}`).join("\n") || "  none";
  console.log(`Detour stations with no elevator entrance in our data:\n${list(gaps)}`);
  console.log(`Detour places that are not a subway station in our data:\n${list(missing)}`);
  console.log(`Detour station names that fit several stations:\n${list(unsure)}`);
}

if (process.argv[1]?.endsWith("elevator-walk-report.ts")) void main().catch((e: unknown) => { console.error(e); process.exit(1); });
