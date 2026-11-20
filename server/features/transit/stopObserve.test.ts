import { describe, expect, it } from "vitest";
import type { TransitTrip } from "./routes";
import { MEASURED_ROUTES, StopObserver } from "./stopObserve";

const trip = (over: Partial<TransitTrip>): TransitTrip => ({ id: "t", route: "1", dir: 0, stops: [["120S", 1000], ["121S", 1100], ["122S", 1200]], ...over });
const run = (snaps: Array<[number, Partial<TransitTrip>]>) => {
  const o = new StopObserver();
  return snaps.flatMap(([at, t]) => o.ingest([trip(t)], at));
};
const only = (rows: ReturnType<typeof run>, method: "vehicle" | "feed") => rows.filter((r) => r.method === method);

describe("timing a stop from the vehicle report", () => {
  it("runs from the report's last movement to the window the train left in", () => {
    const rows = only(run([
      [990, { at: "120S", st: 2, vt: 985 }],
      [1005, { at: "120S", st: 1, vt: 1001 }],  // arrived 1001: the timestamp stops there
      [1020, { at: "120S", st: 1, vt: 1001 }],
      [1035, { at: "121S", st: 2, vt: 1031, stops: [["121S", 1100], ["122S", 1200]] }], // left between 1020 and 1031
    ]), "vehicle");
    expect(rows).toEqual([{ observedAt: 1026, route: "1", dir: 0, stop: "120S", method: "vehicle", seconds: 24.5, slack: 5.5, tripId: "t" }]);
  });

  it("uses the snapshot time when the next report's timestamp has not moved on", () => {
    const [row] = only(run([
      [1005, { at: "120S", st: 1, vt: 1001 }],
      [1035, { at: "121S", st: 2, vt: 1001, stops: [["121S", 1100], ["122S", 1200]] }],
    ]), "vehicle");
    expect(row).toMatchObject({ seconds: 19, slack: 15 });
  });

  it("times a train first seen already stopped, because the timestamp is its arrival", () => {
    const [row] = only(run([
      [1050, { at: "120S", st: 1, vt: 1001 }],
      [1065, { at: "120S", st: 2, vt: 1060 }],
    ]), "vehicle");
    expect(row).toMatchObject({ stop: "120S", seconds: 54 });
  });

  it("skips the origin, the terminal, a window too wide to say much, and lines it cannot measure", () => {
    expect(only(run([[1005, { at: "120S", st: 1, vt: 1001, origin: true }], [1035, { at: "121S", st: 2, vt: 1031 }]]), "vehicle")).toEqual([]);
    expect(only(run([[1205, { at: "122S", st: 1, vt: 1201, stops: [["122S", 1200]] }], [1235, { at: "122S", st: 2, vt: 1231, stops: [["122S", 1200]] }]]), "vehicle")).toEqual([]);
    expect(only(run([[1005, { at: "120S", st: 1, vt: 1001 }], [1105, { at: "121S", st: 2, vt: 1100 }]]), "vehicle")).toEqual([]);
    expect(run([[1005, { route: "A", at: "120S", st: 1, vt: 1001 }], [1035, { route: "A", at: "121S", st: 2, vt: 1031, stops: [["121S", 1100]] }]])).toEqual([]);
  });
});

describe("which lines are measured", () => {
  it("is the numbered lines and the 7, not the lettered lines or the L", () => {
    expect([...MEASURED_ROUTES].sort()).toEqual(["1", "2", "3", "4", "5", "6", "6X", "7", "7X"]);
  });
});

describe("timing a stop from the feed dropping it", () => {
  it("runs from the last predicted arrival to the window the stop left the list in", () => {
    const rows = only(run([
      [990, {}],
      [1010, { stops: [["120S", 1004], ["121S", 1100], ["122S", 1200]] }], // last prediction: arrives 1004
      [1040, { stops: [["121S", 1100], ["122S", 1200]] }],                 // gone between 1010 and 1040
    ]), "feed");
    expect(rows).toEqual([{ observedAt: 1025, route: "1", dir: 0, stop: "120S", method: "feed", seconds: 21, slack: 15, tripId: "t" }]);
  });

  it("does not time a stop that left the list before its predicted arrival, or a trip's origin", () => {
    expect(only(run([[900, {}], [930, { stops: [["121S", 1100], ["122S", 1200]] }]]), "feed")).toEqual([]);
    expect(only(run([[990, { origin: true }], [1040, { stops: [["121S", 1100], ["122S", 1200]] }]]), "feed")).toEqual([]);
  });

  it("gives both timings for the same stop when the feed allows both", () => {
    const rows = run([
      [1005, { at: "120S", st: 1, vt: 1001 }],
      [1035, { at: "121S", st: 2, vt: 1031, stops: [["121S", 1100], ["122S", 1200]] }],
    ]);
    expect(rows.map((r) => [r.method, r.stop, r.seconds])).toEqual([["vehicle", "120S", 17], ["feed", "120S", 20]]);
  });
});
