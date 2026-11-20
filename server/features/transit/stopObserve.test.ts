import { describe, expect, it } from "vitest";
import type { TransitTrip } from "./routes";
import { MEASURED_ROUTES, StopObserver } from "./stopObserve";

const trip = (over: Partial<TransitTrip>): TransitTrip => ({ id: "t", route: "1", dir: 0, stops: [["120S", 1000], ["121S", 1100], ["122S", 1200]], ...over });
const run = (snaps: Array<[number, Partial<TransitTrip>]>) => {
  const o = new StopObserver();
  return snaps.flatMap(([at, t]) => o.ingest([trip(t)], at));
};

describe("timing a stop from the vehicle report", () => {
  it("runs from the report's last movement to the window the train left in", () => {
    const rows = run([
      [990, { at: "120S", st: 2, vt: 985 }],
      [1005, { at: "120S", st: 1, vt: 1001 }],  // arrived 1001: the timestamp stops there
      [1020, { at: "120S", st: 1, vt: 1001 }],
      [1035, { at: "121S", st: 2, vt: 1031, stops: [["121S", 1100], ["122S", 1200]] }], // left between 1020 and 1031
    ]);
    expect(rows).toEqual([{ observedAt: 1026, route: "1", dir: 0, stop: "120S", seconds: 24.5, slack: 5.5, tripId: "t" }]);
  });

  it("uses the snapshot time when the next report's timestamp has not moved on", () => {
    const [row] = run([
      [1005, { at: "120S", st: 1, vt: 1001 }],
      [1035, { at: "121S", st: 2, vt: 1001, stops: [["121S", 1100], ["122S", 1200]] }],
    ]);
    expect(row).toMatchObject({ seconds: 19, slack: 15 });
  });

  it("times a train first seen already stopped, because the timestamp is its arrival", () => {
    const [row] = run([
      [1050, { at: "120S", st: 1, vt: 1001 }],
      [1065, { at: "120S", st: 2, vt: 1060 }],
    ]);
    expect(row).toMatchObject({ stop: "120S", seconds: 54 });
  });

  it("times each stop of a trip once", () => {
    const rows = run([
      [1005, { at: "120S", st: 1, vt: 1001 }],
      [1035, { at: "121S", st: 2, vt: 1031, stops: [["121S", 1100], ["122S", 1200]] }],
      [1105, { at: "121S", st: 1, vt: 1101, stops: [["121S", 1100], ["122S", 1200]] }],
      [1120, { at: "121S", st: 1, vt: 1101, stops: [["121S", 1100], ["122S", 1200]] }],
      [1135, { at: "122S", st: 2, vt: 1131, stops: [["122S", 1200]] }],
    ]);
    expect(rows.map((r) => [r.stop, r.seconds])).toEqual([["120S", 17], ["121S", 24.5]]);
  });

  it("skips the origin, the terminal and a window too wide to say much", () => {
    expect(run([[1005, { at: "120S", st: 1, vt: 1001, origin: true }], [1035, { at: "121S", st: 2, vt: 1031 }]])).toEqual([]);
    expect(run([[1205, { at: "122S", st: 1, vt: 1201, stops: [["122S", 1200]] }], [1235, { at: "122S", st: 2, vt: 1231, stops: [["122S", 1200]] }]])).toEqual([]);
    expect(run([[1005, { at: "120S", st: 1, vt: 1001 }], [1105, { at: "121S", st: 2, vt: 1100 }]])).toEqual([]);
  });
});

describe("which lines are measured", () => {
  it("is the numbered lines and the 7, not the lettered lines or the L", () => {
    expect([...MEASURED_ROUTES].sort()).toEqual(["1", "2", "3", "4", "5", "6", "6X", "7", "7X"]);
    expect(run([[1005, { route: "A", at: "120S", st: 1, vt: 1001 }], [1035, { route: "A", at: "121S", st: 2, vt: 1031, stops: [["121S", 1100]] }]])).toEqual([]);
    expect(run([[1005, { route: "L", at: "120S", st: 1, vt: 1001 }], [1035, { route: "L", at: "121S", st: 2, vt: 1031, stops: [["121S", 1100]] }]])).toEqual([]);
  });
});
