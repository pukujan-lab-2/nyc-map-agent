import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { slimOutages } from "../../../server/features/transit/outages";
import { tableBearingOf } from "../../../scripts/elevator-walk-report";
import { elevatorWalk, elevatorWhere, findStation, mtaCorner, streetUnitsOf, type ElevatorWalk, type Journey, type Leg, type StationRef } from "./elevatorWalk";
import type { Outage } from "./hooks";
import type { StaticSystem } from "./model";

type Row = Record<string, string>;
const sys = JSON.parse(readFileSync("public/transit/subway.json", "utf8")) as StaticSystem;
// The MTA's elevator feeds as they stood on 2026-11-27: out now, planned, and the equipment list for those units
// plus every elevator at 231 St and 61 St-Woodside.
const saved = JSON.parse(readFileSync(new URL("./elevatorWalk.fixtures.json", import.meta.url), "utf8")) as { current: Row[]; upcoming: Row[]; equipment: Row[] };
const today = slimOutages(saved.current, saved.equipment).filter((o) => o.equipment === "Elevator");
const opts = { bearingOf: tableBearingOf, streetUnits: streetUnitsOf(saved.equipment) };

const outage = (id: string): Outage => {
  const o = today.find((x) => x.id === id);
  if (o) return o;
  // Not out on 2026-11-27: the equipment list's own row, as it would read when it is.
  const q = saved.equipment.find((x) => x.equipmentno === id)!;
  const row = { equipment: id, station: q.station, trainno: q.trainno, equipmenttype: "EL", serving: q.serving, reason: "Repair", outagedate: "11/27/2026 06:00:00 AM", estimatedreturntoservice: "11/28/2026 06:00:00 PM", isupcomingoutage: "N" };
  return slimOutages([row], saved.equipment)[0];
};
const walk = (id: string) => elevatorWalk(outage(id), sys, opts);
const journey = (w: ElevatorWalk, heading: string) => w.journeys.find((j) => j.heading === heading)!;
const ends = (j: Journey) => (j.end.kind === "station" ? j.end.stations.map(said) : j.end.kind === "street" ? [j.end.place] : []);
/** A station as the walk would say it: its name, and how many elevator entrances our data has, or why none. */
const said = (r: StationRef) => `${r.match.status === "found" ? r.match.name : r.name}: ${r.match.status === "found" ? (r.match.elevators.length ? `${r.match.elevators.length} elevator` : "no elevator in our data") : r.match.status}`;
const legs = (j: Journey) => j.legs.map((l: Leg) => {
  if (l.kind === "ride") return `ride ${l.toward ? `${l.toward} ` : ""}${l.lines.join("/")}${l.from ? ` at ${l.from.name}` : ""}${l.to ? ` to ${l.to.name}` : ""}`;
  if (l.kind === "bus") return `bus ${l.toward ? `${l.toward} ` : ""}${l.routes.join("/")}${l.from ? ` from ${l.from}` : ""}${l.to ? ` to ${l.to}` : ""}`;
  if (l.kind === "walk") return `walk${l.to ? ` to ${l.to}` : ""}${l.station ? ` (${l.station.name})` : ""}`;
  if (l.kind === "transfer") return `transfer at ${l.at.map((s) => s.name).join(" or ")}`;
  return l.kind;
});

describe("elevatorWhere", () => {
  it("tells a street elevator from one inside the station", () => {
    expect(elevatorWhere("161 St & River Ave (NE corner) to mezzanine to reach 4/B/D service in both directions")).toBe("street");
    expect(elevatorWhere("B/D mezzanine to Woodlawn-bound 4 platform and mezzanine for Manhattan-bound 4 service")).toBe("inside");
    expect(elevatorWhere("Street (NW corner of 7 Ave and 9 Street) to mezzanine")).toBe("street");
    expect(elevatorWhere("SW corner of Southern Blvd and E 149 St for Pelham Bay Park-bound service.")).toBe("street");
    expect(elevatorWhere("Joralemon Street in front of Borough Hall to 4/5 mezzanine level.")).toBe("street");
    expect(elevatorWhere("intermediate landing to mezzanine for A/C/E service in both directions")).toBe("inside");
    expect(elevatorWhere("Transit Center concourse to downntown 4/5 platform and access to rest of complex")).toBe("inside");
  });

  it("splits today's 19 elevator outages into 11 street and 8 inside", () => {
    expect(today).toHaveLength(19);
    expect(today.filter((o) => elevatorWhere(o.serving) === "street")).toHaveLength(11);
  });
});

describe("mtaCorner", () => {
  it("reads the corner in both of the MTA's wordings", () => {
    expect(mtaCorner("161 St & River Ave (NE corner) to mezzanine")).toEqual({ streets: ["161 St", "River Ave"], corner: "NE" });
    expect(mtaCorner("Street (NW corner of 7 Ave and 9 Street) to mezzanine")).toEqual({ streets: ["7 Ave", "9 Street"], corner: "NW" });
    expect(mtaCorner("NW corner of Lorimer St and Metropolitan Ave providing access to the mezzanine control area.")).toEqual({ streets: ["Lorimer St", "Metropolitan Ave"], corner: "NW" });
    expect(mtaCorner("Mezzanine to platform for service in both directions.")).toBeNull();
  });
});

describe("161 St-Yankee Stadium", () => {
  it("EL131 is the street elevator at the NE corner of 161 St and River Av", () => {
    const w = walk("EL131");
    expect(w.where).toBe("street");
    expect(w.entrance).toEqual({ status: "matched", by: "corner", entrance: { stationId: "D11", name: "161 St-Yankee Stadium", at: [-73.92564, 40.828] } });
  });

  it("EL131's detour: to the B/D by bus to Tremont Av, to the Woodlawn-bound 4 by bus to 170 St, Fordham Rd or Mosholu Pkwy", () => {
    const w = walk("EL131");
    expect(w.journeys.map((j) => j.heading)).toEqual(["For Manhattan-bound service", "For B/D", "For Woodlawn-bound 4 stations"]);
    const bd = journey(w, "For B/D");
    expect(bd.start).toBe("street");
    expect(legs(bd)).toEqual(["walk to Grand Concourse", "bus Riverdale-bound Bx1/Bx2 to Tremont Av"]);
    expect(ends(bd)).toEqual(["Tremont Av: 1 elevator"]);
    const four = journey(w, "For Woodlawn-bound 4 stations");
    expect(ends(four)).toEqual(["170 St: 1 elevator", "Fordham Rd: 1 elevator", "Mosholu Pkwy: no elevator in our data"]);
    // The Reduced-Fare way: Metro-North from Yankees-E 153 St, which is not a subway station in our data.
    const mn = journey(w, "For Manhattan-bound service");
    expect(mn.legs.some((l) => l.kind === "walk" && l.station?.match.status === "not-in-data" && l.station.name === "Yankees-E 153 St")).toBe(true);
    expect(ends(mn)).toEqual(["125 St: unsure", "Grand Central-42 St: no elevator in our data"]);
  });

  it("EL132 is inside: from the B/D mezzanine to the 4 platforms", () => {
    const w = walk("EL132");
    expect(w.where).toBe("inside");
    expect(w.entrance).toEqual({ status: "inside" });
    expect(w.journeys.map((j) => [j.heading, j.start])).toEqual([
      ["To access street level", "train"], ["To access B/D service", "train"], ["To access 4 service", "street"],
    ]);
  });

  it("EL132's detours go by the 4 to 170 St and the Bx1/Bx2, or by bus to 149 St", () => {
    const w = walk("EL132");
    const street = journey(w, "To access street level");
    expect(legs(street)).toEqual(["ride Woodlawn-bound 4 to 170 St", "exit", "walk to Grand Concourse", "bus Mott Haven-bound Bx1/Bx2 to Grand Concourse and E 161 St"]);
    expect(street.end).toEqual({ kind: "street", place: "Grand Concourse and E 161 St" });
    expect(ends(journey(w, "To access B/D service"))).toEqual(["Tremont Av: 1 elevator"]);
    const four = journey(w, "To access 4 service");
    expect(legs(four)).toEqual(["walk to Grand Concourse", "bus Mott Haven-bound Bx1/Bx2 from Grand Concourse/E 161 St to Grand Concourse/E 149 St", "ride 4 at 149 St-Hostos"]);
    expect(ends(four)).toEqual(["149 St-Hostos: no elevator in our data"]);
    expect(w.detourStations.map(said)).toEqual(["170 St: 1 elevator", "Tremont Av: 1 elevator", "149 St-Hostos: no elevator in our data"]);
  });
});

describe("stations with two elevator entrances", () => {
  it("231 St: the SW and SE corner elevators each find their own entrance", () => {
    const sw = walk("EL184");
    const se = walk("EL185");
    expect(sw.entrance).toMatchObject({ status: "matched", by: "corner", entrance: { at: [-73.90507, 40.87897] } });
    expect(se.entrance).toMatchObject({ status: "matched", by: "corner", entrance: { at: [-73.90464, 40.87878] } });
    expect(journey(sw, "If you are on the street").start).toBe("street");
  });

  it("231 St without corners: unsure, never a guess", () => {
    expect(elevatorWalk(outage("EL184"), sys).entrance).toMatchObject({ status: "unsure", why: "2 elevator entrances and the corner does not decide" });
  });

  it("61 St-Woodside: both entrances sit on the NE corner, so the street elevator is unsure", () => {
    const w = walk("EL415X");
    expect(w.entrance).toMatchObject({ status: "unsure", why: "2 elevator entrances on the NE corner" });
    expect(w.noDetour).toBe(true);
    expect(walk("EL416X")).toMatchObject({ where: "inside", entrance: { status: "inside" }, journeys: [], noDetour: true });
  });
  it("E 149 St (planned): the SW and NE corner elevators, the SW one named in the other wording", () => {
    const planned = slimOutages([], saved.equipment, saved.upcoming);
    const at = (id: string) => elevatorWalk(planned.find((o) => o.id === id)!, sys, opts).entrance;
    expect(at("EL515")).toMatchObject({ status: "matched", by: "corner", entrance: { at: [-73.90405, 40.81187] } });
    expect(at("EL516")).toMatchObject({ status: "matched", by: "corner", entrance: { at: [-73.90385, 40.81231] } });
  });
});

describe("findStation", () => {
  it("keeps to the lines a detour names and says when a name fits several places", () => {
    expect(said(findStation(sys, "170 St", ["4"]))).toBe("170 St: 1 elevator");
    expect(said(findStation(sys, "170 St", ["B", "D"]))).toBe("170 St: no elevator in our data");
    expect(findStation(sys, "125 St").match.status).toBe("unsure");
    expect(said(findStation(sys, "Grand Central"))).toBe("Grand Central-42 St: no elevator in our data");
    expect(findStation(sys, "Yankees-E 153 St").match.status).toBe("not-in-data");
  });
});

describe("today's outages", () => {
  const walks = today.map((o) => elevatorWalk(o, sys, opts));

  it("reads a detour for every outage that has one", () => {
    expect(walks.filter((w) => !w.noDetour && !w.journeys.length)).toEqual([]);
    expect(walks.filter((w) => w.noDetour).map((w) => w.id)).toEqual(["EL416X"]);
  });

  it("matches the street elevators our data has, and names the stations it lacks", () => {
    const street = walks.filter((w) => w.where === "street");
    expect(street.filter((w) => w.entrance.status === "matched").map((w) => w.id)).toEqual(["EL186", "EL604", "EL131", "EL414"]);
    expect(street.filter((w) => w.entrance.status === "unsure")).toEqual([]);
    expect(street.filter((w) => w.entrance.status === "not-in-data").map((w) => w.station)).toEqual(["57 St", "Parkchester", "191 St", "137 St-City College", "191 St", "Fulton St", "49 St"]);
  });

  it("lists the detour stations with no elevator entrance in our data, the known gaps among them", () => {
    const gaps = new Set(walks.flatMap((w) => w.detourStations).flatMap((r) => (r.match.status === "found" && !r.match.elevators.length ? [r.match.name] : [])));
    for (const known of ["Mosholu Pkwy", "Grand Central-42 St", "149 St-Hostos", "49 St"]) expect(gaps).toContain(known);
  });
});
