import { describe, expect, it } from "vitest";
import { DWELL_DEFAULT, DWELL_LONG, DWELL_MIN, DWELL_TERMINAL, defaultDwell, deriveExpressLocal, ease, fastestRun, motionAt, typicalRun, type MotionStop } from "./dwell";
import { estimateTrain, type StaticSystem } from "./model";

const dwell30 = () => 30;
// Three stops 1000 m apart, arrivals every 120 s.
const stops: MotionStop[] = [
  { id: "A", arr: 0, m: 0 },
  { id: "B", arr: 120, m: 1000 },
  { id: "C", arr: 240, m: 2000 },
];

describe("motionAt: dwell, easing, timetable", () => {
  it("holds still at a stop for the default dwell", () => {
    for (const t of [120, 130, 149]) {
      const mo = motionAt(stops, t, dwell30)!;
      expect(mo.phase).toBe("dwell");
      expect(mo.m).toBe(1000);
    }
    expect(motionAt(stops, 151, dwell30)!.phase).toBe("moving");
  });
  it("uses realtime departure times when the feed gives them", () => {
    const s = [{ ...stops[0] }, { ...stops[1], dep: 170 }, stops[2]];
    expect(motionAt(s, 165, dwell30)).toMatchObject({ phase: "dwell", m: 1000, departs: 170 });
    expect(motionAt(s, 171, dwell30)!.phase).toBe("moving");
  });
  it("keeps every predicted arrival: travel shrinks, the train is exactly at the next stop on time", () => {
    expect(motionAt(stops, 120, dwell30)!.m).toBe(1000);
    expect(motionAt(stops, 240, () => 30, { terminal: true })!.m).toBe(2000);
    expect(motionAt(stops, 119.999, dwell30)!.m).toBeCloseTo(1000, 0);
    // Travel time is 120 - 30 = 90 s; midpoint of travel is 30 + 45 = 75 s.
    expect(motionAt(stops, 75, dwell30)!.m).toBeCloseTo(500, 6);
  });
  it("eases in and out: slow near stations, fastest mid-way, monotonic", () => {
    const at = (t: number) => motionAt(stops, t, dwell30)!.m;
    const early = at(35) - at(30), mid = at(77.5) - at(72.5), late = at(120) - at(115);
    expect(early).toBeLessThan(mid / 5);
    expect(late).toBeLessThan(mid / 5);
    let prev = -1;
    for (let t = 0; t <= 240; t += 1) { const m = motionAt(stops, t, dwell30)!.m; expect(m).toBeGreaterThanOrEqual(prev); prev = m; }
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
  });
  it("caps the default dwell so a short hop still makes its arrival", () => {
    const s = [{ id: "A", arr: 0, m: 0 }, { id: "B", arr: 40, m: 300 }];
    expect(motionAt(s, 25, () => 60)!.phase).toBe("moving");
  });
});

describe("motionAt: the run gets its time before the stop does", () => {
  const runOf = (a: MotionStop, b: MotionStop) => typicalRun(Math.abs(b.m - a.m));
  /** When the train leaves stop 0 of a two-stop trip `metres` long with `gap` seconds between arrivals. */
  const leaves = (metres: number, gap: number, dwell: number) => {
    const s = [{ id: "A", arr: 0, m: 0 }, { id: "B", arr: gap, m: metres }, { id: "C", arr: gap * 2, m: metres * 2 }];
    const mo = motionAt(s, 0, () => dwell, { runOf })!;
    return mo.phase === "dwell" ? mo.departs : NaN;
  };

  it("knows how fast a train can cover a distance", () => {
    expect(fastestRun(0)).toBe(0);
    expect(fastestRun(300)).toBeCloseTo(31.7, 1); // never reaches top speed
    expect(fastestRun(1000)).toBeCloseTo(61.3, 1); // 40.7 s at top speed plus speeding up and braking
    for (let d = 50; d < 4000; d += 50) expect(fastestRun(d + 50)).toBeGreaterThan(fastestRun(d));
    expect(fastestRun(508)).toBeCloseTo(fastestRun(507), 0); // the two formulas meet where top speed is first reached
  });

  it("a long default stop no longer makes the train race: 725 m in a 96 s gap at a 60 s station", () => {
    // Before, the stop took half the gap (48 s) and left 48 s for a run whose fastest possible time is 50 s.
    const dep = leaves(725, 96, 60);
    expect(96 - dep).toBeCloseTo(typicalRun(725), 6);
    expect(dep).toBeGreaterThan(15);
    expect(dep).toBeLessThan(30);
  });

  it("never draws a run faster than a train can go when the gap is a realistic one", () => {
    for (let metres = 200; metres <= 4000; metres += 100) {
      for (const dwell of [30, 50, 60]) {
        const gap = typicalRun(metres) + 25; // a real gap: the run plus an ordinary stop
        expect(gap - leaves(metres, gap, dwell)).toBeGreaterThanOrEqual(typicalRun(metres) - 1e-9);
      }
    }
  });

  it("gives the stop its full default when the gap has room for it", () => {
    expect(leaves(725, 200, 30)).toBe(30);
    expect(leaves(725, 200, 60)).toBe(60);
  });

  it("still stops briefly when the gap is too short for the run", () => {
    expect(leaves(1500, 90, 30)).toBe(DWELL_MIN);
    expect(leaves(300, 12, 30)).toBe(6); // and never for more than half of a very short gap
  });

  it("arrives at the next stop exactly on its predicted time", () => {
    const s = [{ id: "A", arr: 0, m: 0 }, { id: "B", arr: 96, m: 725 }, { id: "C", arr: 192, m: 1450 }];
    expect(motionAt(s, 96, () => 60, { runOf })!.m).toBe(725);
    expect(motionAt(s, 95.999, () => 60, { runOf })!.m).toBeCloseTo(725, 0);
  });

  it("leaves a departure time from the feed alone", () => {
    const s = [{ id: "A", arr: 0, dep: 45, m: 0 }, { id: "B", arr: 96, m: 725 }];
    expect(motionAt(s, 40, () => 30, { runOf })).toMatchObject({ phase: "dwell", departs: 45 });
  });
});

describe("motionAt: origin and terminal", () => {
  it("sits at the origin until its departure", () => {
    const s = [{ id: "A", arr: 100, dep: 100, m: 0 }, { id: "B", arr: 220, m: 1000 }];
    expect(motionAt(s, 0, dwell30, { origin: true })).toMatchObject({ phase: "origin", m: 0, departs: 100 });
    expect(motionAt(s, 99, dwell30, { origin: true })!.m).toBe(0);
    expect(motionAt(s, 101, dwell30, { origin: true })!.phase).toBe("moving");
  });
  it("without an origin flag, extrapolates back from the first known stop", () => {
    const mo = motionAt(stops, -60, dwell30)!;
    expect(mo.phase).toBe("moving");
    expect(mo.m).toBeLessThan(0);
  });
  it("dwells at the terminal, then disappears", () => {
    expect(motionAt(stops, 240 + DWELL_TERMINAL - 1, dwell30)).toMatchObject({ phase: "terminal", m: 2000, arrived: 240 });
    expect(motionAt(stops, 240 + DWELL_TERMINAL + 1, dwell30)).toBeNull();
  });
});

describe("dwell defaults and express/local derivation", () => {
  it("gives a transfer point the longer stop only while a connection is pulling in", () => {
    expect(defaultDwell("120")).toBe(DWELL_DEFAULT); // 96 St (1/2/3), nobody to wait for
    expect(defaultDwell("120", undefined, true)).toBe(DWELL_LONG);
    expect(defaultDwell("R30", undefined, true)).toBe(DWELL_LONG); // DeKalb Av (override)
    expect(defaultDwell("XYZ")).toBe(DWELL_DEFAULT);
    expect(defaultDwell("XYZ", "Fulton St")).toBe(DWELL_LONG);
  });
  it("derives transfer points where an express skips stops a local makes", () => {
    const local = { route: "1", stops: ["103", "96", "86", "79", "72", "66"] };
    const express = { route: "2", stops: ["96", "72"] };
    const otherLine = { route: "F", stops: ["96", "X", "Y", "72"] }; // meets at both, different path
    expect(deriveExpressLocal([local, express])).toEqual(["72", "96"]);
    expect(deriveExpressLocal([express, otherLine])).toEqual(["72", "96"]);
    expect(deriveExpressLocal([local, otherLine])).toEqual([]);
  });
});

describe("estimateTrain with dwell", () => {
  const sys: StaticSystem = {
    system: "subway",
    routes: { G: { name: "Crosstown", short: "G", color: "#6CBE45", text: "#FFFFFF" } },
    lines: { type: "FeatureCollection", features: [] },
    stations: { type: "FeatureCollection", features: [] },
    shapes: { G: { c: [[-73.95, 40.7], [-73.95, 40.72]], m: [0, 2226], g: ["underground", "underground"] } },
    stopM: { G: { A: 0, B: 1113, C: 2226 } },
  };
  const trip = { id: "t", route: "G", dir: 0, stops: [["AN", 0], ["BN", 120], ["CN", 240]] as Array<[string, number]> };
  it("reports 'At' while dwelling and the onward stop as next", () => {
    const v = estimateTrain(sys, trip, 130)!;
    expect(v.stopped).toMatchObject({ kind: "at", stop: "BN" });
    expect(v.lat).toBeCloseTo(40.71, 4);
    expect(v.nextStop).toBe("CN");
  });
  it("stops for what the gap leaves after the run, not for a fixed 30 s", () => {
    // 1113 m normally takes 99 s, so a 120 s gap leaves a 21 s stop.
    expect(estimateTrain(sys, trip, 140)!.stopped).toMatchObject({ kind: "at", stop: "BN" });
    expect(estimateTrain(sys, trip, 143)!.stopped).toBeUndefined();
  });
  it("leaves commuter rail as it was: a 45 s stop capped at half the gap", () => {
    const rail = { ...sys, system: "lirr" as const, stopM: { G: { AN: 0, BN: 1113, CN: 2226 } } };
    expect(estimateTrain(rail, trip, 160)!.stopped).toMatchObject({ kind: "at", stop: "BN" });
    expect(estimateTrain(rail, trip, 166)!.stopped).toBeUndefined();
  });
  it("reports departures from the origin and arrival at the terminal", () => {
    expect(estimateTrain(sys, { ...trip, origin: true, stops: [["AN", 60, 60], ["BN", 180]] }, 0)!.stopped).toMatchObject({ kind: "departs", stop: "AN", t: 60 });
    expect(estimateTrain(sys, trip, 250)!.stopped).toMatchObject({ kind: "arrived", stop: "CN" });
    expect(estimateTrain(sys, trip, 240 + DWELL_TERMINAL + 5)).toBeNull();
  });
});
