import { describe, expect, it } from "vitest";
import { fastestRun, typicalRun } from "../../../src/features/transit/dwell";
import type { StaticSystem } from "../../../src/features/transit/model";
import { MotionScorer, scoreTrip, TIGHT_FACTOR } from "./motionScore";

// Three stations 1113 m apart on one line.
const sys: StaticSystem = {
  system: "subway",
  routes: { G: { name: "Crosstown", short: "G", color: "#6CBE45", text: "#FFFFFF" } },
  lines: { type: "FeatureCollection", features: [] },
  stations: { type: "FeatureCollection", features: [] },
  shapes: { G: { c: [[-73.95, 40.7], [-73.95, 40.72]], m: [0, 2226], g: ["underground", "underground"] } },
  stopM: { G: { A: 0, B: 1113, C: 2226 } },
};
const trip = (stops: Array<[string, number] | [string, number, number]>, extra: object = {}) => ({ id: "t", route: "G", dir: 0, stops, ...extra });
const NEED = typicalRun(1113); // about 99 s

describe("scoring how a train is drawn", () => {
  it("counts a train standing at a station as parked, and one between stations as not", () => {
    const stops: Array<[string, number]> = [["AN", 0], ["BN", 150], ["CN", 300]];
    expect(scoreTrip(sys, trip(stops), 160)).toMatchObject({ trains: 1, parked: 1 });
    expect(scoreTrip(sys, trip(stops), 250)).toMatchObject({ trains: 1, parked: 0 });
  });

  it("does not count a train waiting at its origin or standing at its terminal", () => {
    expect(scoreTrip(sys, trip([["AN", 60, 60], ["BN", 210]], { origin: true }), 0)).toMatchObject({ trains: 0, parked: 0 });
    expect(scoreTrip(sys, trip([["AN", 0], ["BN", 150]]), 160)).toMatchObject({ trains: 0, parked: 0 });
  });

  it("finds no racing when the gap leaves the run its normal time", () => {
    const t = scoreTrip(sys, trip([["AN", 0], ["BN", NEED + 25], ["CN", 2 * (NEED + 25)]]), 5);
    expect(t).toMatchObject({ legs: 2, racing: 0, tight: 0 });
  });

  it("calls a run shorter than a train can make racing, and one within a quarter of it tight", () => {
    const fastest = fastestRun(1113); // about 66 s
    // The stop takes its 10 s minimum, so the run is the gap minus 10.
    expect(scoreTrip(sys, trip([["AN", 0], ["BN", fastest + 5]]), 1)).toMatchObject({ legs: 1, racing: 1, tight: 1 });
    expect(scoreTrip(sys, trip([["AN", 0], ["BN", fastest * TIGHT_FACTOR + 5]]), 1)).toMatchObject({ legs: 1, racing: 0, tight: 1 });
  });

  it("leaves out a stretch whose departure the feed gives, one already run, and one far ahead", () => {
    const fastest = fastestRun(1113);
    expect(scoreTrip(sys, trip([["AN", 0, 30], ["BN", 30 + fastest - 20]]), 1).legs).toBe(0);
    expect(scoreTrip(sys, trip([["AN", 0], ["BN", 150], ["CN", 300]]), 200).legs).toBe(1); // A to B is over
    expect(scoreTrip(sys, trip([["AN", 900], ["BN", 1050]]), 0).legs).toBe(0); // leaves in 15 minutes
  });
});

describe("MotionScorer", () => {
  it("keeps lines with a notice apart from lines without, and counts snapshots once each", () => {
    const stops: Array<[string, number]> = [["AN", 0], ["BN", 150], ["CN", 300]];
    const withNotice = new MotionScorer(sys, {}, new Set(["G"]));
    withNotice.ingest([trip(stops), { ...trip(stops), id: "u" }], 160);
    withNotice.ingest([trip(stops)], 250);
    expect(withNotice.finish()).toEqual([{ notice: "yes", snapshots: 2, trains: 3, parked: 2, legs: 3, racing: 0, tight: 0 }]);

    const without = new MotionScorer(sys, {}, new Set(["A"]));
    without.ingest([trip(stops)], 160);
    expect(without.finish()[0].notice).toBe("no");

    const unknown = new MotionScorer(sys, {});
    unknown.ingest([trip(stops)], 160);
    expect(unknown.finish()[0].notice).toBe("unknown");
  });

  it("reports nothing when no train was drawn", () => {
    expect(new MotionScorer(sys, {}).finish()).toEqual([]);
  });
});
