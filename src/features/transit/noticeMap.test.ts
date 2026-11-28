import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { StaticSystem } from "./model";
import { busRoutesFor, noticeMapFeatures, sideNames, stepMapFrom, type BusShape } from "./noticeMap";
import type { StepMap } from "./walkMap";
import type { TransitAlert } from "./hooks";

const sys = JSON.parse(readFileSync("public/transit/subway.json", "utf8")) as StaticSystem;
const live = JSON.parse(readFileSync(new URL("./alertDiagram.fixtures.json", import.meta.url), "utf8")) as Record<string, TransitAlert>;
const color = () => "#b933ad";
const props = (c: GeoJSON.FeatureCollection) => c.features.map((f) => f.properties as Record<string, unknown>);
const CATALOG = ["M14A", "M14A+", "M14D", "M14D+", "M15", "M15+", "Q32", "Bx1"];
// Our bus data for the M14A+, trimmed to a line and two stops by 14 St-Union Sq.
const M14A: BusShape = { route: "M14A+", lines: [[[-73.9935, 40.7364], [-73.9897, 40.7350], [-73.9836, 40.7327]]], stops: [{ name: "14 ST/UNION SQ E", lon: -73.9897, lat: 40.735 }, { name: "14 ST/1 AV", lon: -73.9836, lat: 40.7327 }] };

/**
 * A step that names one of everything, on the 7 in Queens (Thanksgiving week): Flushing-bound trains skip 52 St
 * and 69 St; ride the 7 from Queensboro Plaza toward Flushing, change at 61 St-Woodside, take the Q32 or M14,
 * a B109-style shuttle from two stations, walk between two stations and use the 61 St-Woodside elevator.
 */
const STEP: StepMap = {
  stations: ["718", "713", "712", "711", "710", "A20", "121"],
  lines: ["7"],
  you: "711",
  tracks: [{ line: "7", from: "718", to: "710", toward: "Flushing", skip: ["713", "711"] }],
  ride: { line: "7", from: "718", to: "712", toward: "Flushing" },
  change: [{ at: "712", kind: "cross" }, { at: "718", kind: "line", to: ["N", "W"] }],
  bus: [
    { route: "M14", shuttle: false, stops: [{ station: "635", corner: null }] },
    { route: "L92", shuttle: true, stops: [{ station: "713", corner: "Roosevelt Av at 52 St" }, { station: "711", corner: "Roosevelt Av at 69 St" }] },
  ],
  walk: [{ from: "711", to: "710" }],
  entrances: [{ station: "712", id: "1983", state: "closed" }, { station: "712", id: "1984", state: "use" }, { station: "414", id: null, state: "closed" }],
};

describe("noticeMapFeatures", () => {
  const fx = noticeMapFeatures(STEP, sys, { color, catalog: CATALOG, busShape: (r) => (r === "M14A+" ? M14A : undefined) });

  it("draws every station, bus, shuttle stop, entrance and walk the step names", () => {
    const drawnStations = new Set(props(fx.stations).map((p) => p.id));
    for (const id of [...STEP.stations, STEP.you!]) expect(drawnStations, `station ${id}`).toContain(id);
    expect(new Set(props(fx.labels).map((p) => p.id))).toEqual(drawnStations);
    // Every bus is drawn as a line, the M14 as our M14A+ shape, the shuttle stop to stop.
    for (const b of STEP.bus!) expect(props(fx.buses).some((p) => p.route === b.route), `bus ${b.route}`).toBe(true);
    for (const b of STEP.bus!) for (const s of b.stops) expect(props(fx.busStops).some((p) => p.route === b.route && p.station === s.station), `${b.route} at ${s.station}`).toBe(true);
    expect(props(fx.buses).find((p) => p.route === "M14")?.ours).toBe("M14A+");
    for (const e of STEP.entrances!) expect(props(fx.entrances).some((p) => p.station === e.station && p.id === (e.id ?? "") && p.state === e.state), `entrance ${e.id}`).toBe(true);
    for (const w of STEP.walk!) expect(props(fx.walks).some((p) => p.from === w.from && p.to === w.to), `walk ${w.from}-${w.to}`).toBe(true);
    for (const c of STEP.change!) expect(props(fx.changes).some((p) => p.id === c.at), `change at ${c.at}`).toBe(true);
    expect(props(fx.train)).toHaveLength(1);
  });

  it("puts each signpost beside its own track: Flushing-bound runs east, so its track and sign sit south", () => {
    expect(sideNames(sys, "7", "Flushing")).toEqual(["Flushing", "Manhattan"]);
    const signs = props(fx.signposts);
    const flushing = signs.find((p) => /Flushing side$/.test(String(p.text)))!;
    const manhattan = signs.find((p) => /Manhattan side$/.test(String(p.text)))!;
    // Screen offsets: y grows downward, so south of an east-west line is positive y.
    expect((flushing.offset as number[])[1]).toBeGreaterThan(0);
    expect((manhattan.offset as number[])[1]).toBeLessThan(0);
    expect(String(flushing.text)).toMatch(/^→/);
    expect(String(manhattan.text)).toMatch(/^←/);
    // The far end of each track: the Flushing sign east of the Manhattan one.
    const at = (p: Record<string, unknown>) => fx.signposts.features[signs.indexOf(p)].geometry as GeoJSON.Point;
    expect(at(flushing).coordinates[0]).toBeGreaterThan(at(manhattan).coordinates[0]);
  });

  it("crosses out skipped stops on the skipping track only", () => {
    const stops = props(fx.trackStops);
    const skipped = stops.filter((p) => p.state === "skip");
    expect(skipped.map((p) => p.id).sort()).toEqual(["711", "713"]);
    expect(new Set(skipped.map((p) => p.side))).toEqual(new Set([0]));
    // The Manhattan-bound track still stops there.
    expect(stops.filter((p) => p.side === 1 && (p.id === "711" || p.id === "713")).map((p) => p.state)).toEqual(["stop", "stop"]);
    // Each stop sits to the right of its own track's travel: south for Flushing-bound, north for Manhattan-bound.
    for (const p of stops.filter((q) => q.id === "713")) expect(Math.sign((p.offset as number[])[1])).toBe(p.side === 0 ? 1 : -1);
  });

  it("tags the train with its direction and points its arrow east", () => {
    const [t] = props(fx.train);
    expect(t.tag).toBe("to Flushing");
    expect(Number(t.bearing)).toBeGreaterThan(45);
    expect(Number(t.bearing)).toBeLessThan(135);
  });

  it("names the line when two stations share a name, but not one complex under two ids", () => {
    const label = (id: string) => props(fx.labels).find((p) => p.id === id)?.label;
    expect(label("A20")).toBe("86 Street (A)");
    expect(label("121")).toBe("86 Street (1)");
    expect(label("712")).toBe("61 Street-Woodside");
  });

  it("marks the elevator that is out, the one to use, and says when ours has no such entrance", () => {
    const e = props(fx.entrances);
    expect(e.map((p) => [p.icon, p.label])).toEqual([
      ["notice-elev-out", "Elevator out"],
      ["notice-access", "Elevator to use"],
      ["notice-elev-out", "Elevator out: not on our map"],
    ]);
  });

  it("frames everything it draws", () => {
    const [[w, s], [e, n]] = fx.bounds!;
    for (const c of [fx.stations, fx.busStops, fx.entrances]) for (const f of c.features) {
      const [x, y] = (f.geometry as GeoJSON.Point).coordinates;
      expect(x >= w && x <= e && y >= s && y <= n).toBe(true);
    }
  });
});

describe("busRoutesFor", () => {
  it("matches a notice's M14 to our M14A+ and M14D+", () => {
    expect(busRoutesFor("M14", CATALOG)).toEqual(["M14A+", "M14D+"]);
    expect(busRoutesFor("M15", CATALOG)).toEqual(["M15"]);
    expect(busRoutesFor("bx1", CATALOG)).toEqual(["Bx1"]);
    // Temporary shuttles are not in our data: drawn from the MTA's corners instead.
    expect(busRoutesFor("B109", CATALOG)).toEqual([]);
    expect(busRoutesFor("shuttle", CATALOG)).toEqual([]);
  });
});

describe("stepMapFrom", () => {
  it("gives today's skip notice its tracks and an uptown train", () => {
    const map = stepMapFrom({ ids: ["A22"], corners: [], bus: [] }, live.aSkip, sys, "A");
    expect(map.tracks?.[0]).toMatchObject({ line: "A", toward: "Uptown" });
    expect(map.tracks?.[0].skip).toHaveLength(7);
    expect(map.ride?.toward).toBe("Uptown");
    const fx = noticeMapFeatures(map, sys, { color });
    expect(props(fx.signposts).map((p) => String(p.text).slice(2)).sort()).toEqual(["Downtown side", "Uptown side"]);
    expect(props(fx.train)[0].tag).toBe("to Uptown");
  });

  it("turns a shuttle step's corners into shuttle stops", () => {
    const map = stepMapFrom({ ids: ["103"], corners: [{ id: "103", text: "Broadway at 238 Street" }], bus: [] }, live.oneCorners, sys, "1");
    const fx = noticeMapFeatures(map, sys, { color });
    expect(props(fx.busStops).map((p) => p.station)).toEqual(["103"]);
    expect(String(props(fx.busStops)[0].label)).toContain("Broadway at 238 Street");
  });
});
