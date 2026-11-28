/**
 * Two more recorded walks, from the starter pack in Octo: the evening walk
 * through 14 St-Union Sq (the afternoon route the other way) and the first leg
 * at Cortlandt St. With the afternoon walk already in the repository they say
 * how much a rider's step count for the same stretch moves from one walk to the next.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseRecording, type BaroRow, type StepRow } from "@/features/recorder/format";
import { findRides } from "@/features/recorder/clean";
import { WALK } from "@/features/walkguide/walks";
import more from "./more-walks.json";

const walk = (id: string) => {
  const w = more.walks.find((x) => x.id === id)!;
  return { steps: w.steps as StepRow[], baro: w.baro as BaroRow[] };
};
const countAt = (steps: readonly StepRow[], t: number) => steps.reduce((c, r) => (r[0] <= t ? r[1] : c), 0);
/** The guide's own step count from one checkpoint to another. */
const guideSteps = (from: string, to: string) => {
  const a = WALK.findIndex((c) => c.id === from), b = WALK.findIndex((c) => c.id === to);
  return WALK.slice(a, b).reduce((n, c) => n + c.steps, 0);
};

describe("14 St-Union Sq mezzanine, between the two elevators", () => {
  const guide = guideSteps("us-to-l", "us-mural-elevator");

  it("took 218 steps in the evening, going down", () => {
    const { steps, baro } = walk("evening-union-sq");
    const rides = findRides(baro);
    expect(rides.map((r) => r.riseM < 0)).toEqual([true, true]);
    expect(countAt(steps, rides[1].t0) - countAt(steps, rides[0].t1)).toBe(218);
  });

  it("took 296 steps that afternoon, going up, on the same phone", () => {
    const parsed = parseRecording(JSON.parse(readFileSync("public/replay/union-sq-walk.json", "utf8")));
    if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
    const rides = findRides(parsed.recording.baro);
    expect(countAt(parsed.recording.steps, rides[1].t0) - countAt(parsed.recording.steps, rides[0].t1)).toBe(296);
  });

  it("is 212 steps in the guide: 3% under the evening walk and 40% under the afternoon one", () => {
    expect(guide).toBe(212);
    expect(218 / guide).toBeCloseTo(1.03, 2);
    expect(296 / guide).toBeCloseTo(1.4, 1);
  });

  it("so a rider's pace is a fact about one walk, not about the rider: it has to be learned as they go", () => {
    // The same stretch, the same phone, the same day: the count moved by more than a third.
    expect(296 / 218).toBeGreaterThan(1.33);
  });
});

describe("Cortlandt St, the street elevator to the uptown R/W platform", () => {
  const { steps, baro } = walk("cortlandt-leg1");
  const lifts = findRides(baro);

  it("rode two elevators: down about 12 m from the street, then up about 6 m to the platform", () => {
    expect(lifts).toHaveLength(2);
    expect(lifts[0].riseM).toBeCloseTo(-11.6, 0);
    expect(lifts[1].riseM).toBeCloseTo(6.2, 0);
  });

  it("took 280 steps between them, where the guide counts 235", () => {
    expect(countAt(steps, lifts[1].t0) - countAt(steps, lifts[0].t1)).toBe(280);
    expect(guideSteps("dey-passage", "uptown-queens")).toBe(235);
    expect(280 / 235).toBeCloseTo(1.19, 2);
  });

  it("does not take the passage, which slopes down 1.6 m over some 40 seconds, for a ride", () => {
    // The barometer falls about 0.07 m a second there. Until the ride finder asked for a steep
    // reading it reported this as a third ride with no length, and the rides no longer matched the levels.
    const t0 = baro[0][0];
    const at = (s: number) => baro.reduce((h, b) => (b[0] <= t0 + s * 1000 ? b[1] : h), baro[0][1]);
    expect(at(140) - at(180)).toBeGreaterThan(1.2);
    expect(lifts.every((r) => r.t1 - r.t0 >= 3000)).toBe(true);
  });
});
