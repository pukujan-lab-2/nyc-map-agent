import { describe, expect, it } from "vitest";
import { makeTools } from "./tools";
import { stationPathways, stationRoutes } from "./stationRoute";
import type { Station } from "./transit";
import type { Outage } from "./services";

const data = stationPathways();
const unionSqNqrw = { gtfsId: "R20", north: "Uptown & Queens", south: "Downtown & Brooklyn" };

describe("the step-free way through a station", () => {
  it("14 St-Union Sq, off the uptown N/Q/R/W: the two elevators we filmed, with the signs to follow", () => {
    const [north] = stationRoutes(data, unionSqNqrw, "to-street", [])!;
    expect(north.toward).toBe("Uptown & Queens");
    expect(north.stepFree).toBe(true);
    expect(north.steps).toEqual([
      'Elevator EL219, signed "Elevator to Mezzanine"',
      'Along the passage, signed "Exit 14 St, 4,5,6, Elevator to L"',
      'Out through the gate, signed "Exit 14 St & 4 Av"',
      'Elevator EL217, signed "Exit 14 St & 4 Av Union Square East NE corner"',
    ]);
    expect(north.out).toEqual([]);
    expect(north.note).toBeUndefined();
  });

  it("gives the way in as well as the way out, through the same elevators in the other order", () => {
    const [down] = stationRoutes(data, unionSqNqrw, "to-platform", [])!;
    expect(down.steps.map((s) => /EL\d+/.exec(s)?.[0]).filter(Boolean)).toEqual(["EL217", "EL219"]);
    expect(down.steps[down.steps.length - 1]).toContain("EL219");
    expect(down.entrance).toBe("Union Sq Elevator");
  });

  it("says there is no way without stairs, and why, when the only elevator is out", () => {
    const [north] = stationRoutes(data, unionSqNqrw, "to-street", [{ unit: "EL219", back: "11/21/2026 06:00:00 AM" }])!;
    expect(north.stepFree).toBe(false);
    expect(north.steps).toEqual([]);
    expect(north.out).toEqual([{ unit: "EL219", back: "11/21/2026 06:00:00 AM" }]);
    expect(north.note).toBe("No way without stairs right now: elevator EL219 is out, back 11/21/2026 06:00:00 AM.");
  });

  it("is not changed by an elevator that is out somewhere else", () => {
    const usual = stationRoutes(data, unionSqNqrw, "to-street", [])!;
    expect(stationRoutes(data, unionSqNqrw, "to-street", [{ unit: "EL999", back: "later" }])).toEqual(usual);
  });

  it("answers for both directions, and with null for a stop the MTA's data does not hold", () => {
    expect(stationRoutes(data, unionSqNqrw, "to-street", [])!.map((r) => r.toward)).toEqual(["Uptown & Queens", "Downtown & Brooklyn"]);
    expect(stationRoutes(data, { gtfsId: "ZZ9" }, "to-street", [])).toBeNull();
  });

  it("never names stairs or an escalator in a step-free answer, at any stop in the data", () => {
    const stops = [...new Set(Object.entries(data.nodes).filter(([, n]) => n.kind === "p").map(([id]) => id.replace(/[NS]$/, "")))];
    for (const gtfsId of stops) {
      for (const way of ["to-street", "to-platform"] as const) {
        for (const r of stationRoutes(data, { gtfsId }, way, []) ?? []) {
          for (const s of r.steps) expect(s, `${gtfsId} ${way}`).not.toMatch(/^(Stairs|Escalator)/);
          expect(r.stepFree).toBe(r.steps.length > 0);
        }
      }
    }
  });
});

describe("the station_route tool", () => {
  const st = (over: Partial<Station>): Station => ({ id: "x", complexId: "602", name: "14 St-Union Sq", routes: [], structure: "Subway", at: [-73.9906, 40.7353], ...over });
  const stations = [
    st({ id: "1", gtfsId: "R20", routes: ["N", "Q", "R", "W"], north: "Uptown & Queens", south: "Downtown & Brooklyn" }),
    st({ id: "2", gtfsId: "L03", routes: ["L"], north: "8 Av", south: "Brooklyn" }),
    st({ id: "3", complexId: "999", gtfsId: "ZZ9", name: "Nowhere Av", routes: ["Z"], at: [-73.9, 40.7] }),
  ];
  const outage = (equipment: string): Outage => ({ station: "14 St-Union Sq", trainno: "N/Q/R/W", equipment, equipmenttype: "EL", serving: "", outagedate: "", estimatedreturntoservice: "11/21/2026 06:00:00 AM", reason: "Repair", isupcomingoutage: "N" });
  const tools = (outages: () => Promise<Outage[]>) => makeTools({ location: null, emit: () => {}, deps: { entrances: { stations: () => Promise.resolve(stations), entrances: () => Promise.resolve([]) }, outages } });
  type Result = { station: string; lines: { lines: string; platforms: { toward: string; steps: string[]; stepFree: boolean; note?: string }[] }[]; notKnown?: string; outagesNotChecked?: string; dataFrom: string };
  const ask = async (t: ReturnType<typeof tools>, input: unknown) => (await (t.station_route.execute as unknown as (a: unknown, o: unknown) => Promise<Result>)(input, { toolCallId: "x", messages: [] }));

  it("answers for the line the rider named, with today's outages left out", async () => {
    const r = await ask(tools(() => Promise.resolve([])), { station: "Union Sq", way: "to-street", line: "r" });
    expect(r.station).toBe("14 St-Union Sq");
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].lines).toBe("N Q R W");
    expect(r.lines[0].platforms[0].steps[0]).toContain("EL219");
    expect(r.notKnown).toBeUndefined();
    expect(r.dataFrom).toContain("2021");
  });

  it("says first that there is no way when the elevator on it is out", async () => {
    const r = await ask(tools(() => Promise.resolve([outage("EL219")])), { station: "Union Sq", way: "to-street", line: "R" });
    expect(r.lines[0].platforms[0].stepFree).toBe(false);
    expect(r.lines[0].platforms[0].note).toContain("EL219 is out");
  });

  it("gives every line at the station when none is named", async () => {
    const r = await ask(tools(() => Promise.resolve([])), { station: "Union Sq", way: "to-platform" });
    expect(r.lines.map((l) => l.lines)).toEqual(["N Q R W", "L"]);
  });

  it("says a station's inside is not mapped instead of guessing", async () => {
    const r = await ask(tools(() => Promise.resolve([])), { station: "Nowhere Av", way: "to-street" });
    expect(r.lines).toEqual([]);
    expect(r.notKnown).toContain("no map of the inside");
  });

  it("still answers, and says so, when the outage list cannot be reached", async () => {
    const r = await ask(tools(() => Promise.reject(new Error("offline"))), { station: "Union Sq", way: "to-street", line: "R" });
    expect(r.lines[0].platforms[0].stepFree).toBe(true);
    expect(r.outagesNotChecked).toContain("may be out");
  });
});
