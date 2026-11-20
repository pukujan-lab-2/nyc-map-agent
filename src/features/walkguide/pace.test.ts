/**
 * The rider's pace: how many steps they take for each step the guide counted.
 * The guide learns it when the rider confirms the next sign, and from then on
 * lays their steps along each leg at that pace. See docs/PLAN-underground-guidance.md.
 */
import { describe, expect, it } from "vitest";
import { arrive, dueAtNext, learnPace, legShare, placeAt, placeForSign, simTick, stepsToNextStop, type Place } from "./progress";
import { WALK, WRONG_WAYS } from "./walks";

const at = (id: string) => WALK.findIndex((c) => c.id === id);
const metres = (a: [number, number], b: [number, number]): number =>
  Math.hypot((b[0] - a[0]) * 111_320 * Math.cos((a[1] * Math.PI) / 180), (b[1] - a[1]) * 110_540);
const walkable = WALK.map((c, i) => ({ c, i })).filter(({ c, i }) => !c.by && c.steps > 0 && i < WALK.length - 1);

describe("learning a rider's pace", () => {
  const platform = at("us-platform"); // 220 steps in the guide

  it("takes the first confirmed leg's ratio as it is", () => {
    expect(learnPace(WALK, { i: platform, walked: 231 })).toBeCloseTo(1.05, 2);
  });

  it("moves halfway towards each later leg, so one odd leg cannot swing it", () => {
    expect(learnPace(WALK, { i: at("us-corridor"), walked: 125, pace: 1 })).toBeCloseTo((1 + 125 / 89) / 2, 6);
  });

  it("learns nothing from a ride, a short leg, or a rider who skipped ahead", () => {
    expect(learnPace(WALK, { i: at("us-to-mezzanine"), walked: 40, pace: 1.2 })).toBe(1.2); // an elevator
    expect(learnPace(WALK, { i: at("us-yellow"), walked: 30, pace: 1.2 })).toBe(1.2); // 14 steps in the guide
    expect(learnPace(WALK, { i: platform, walked: 20 })).toBeUndefined(); // tapped Next after 20 of 220
  });

  it("keeps a learned pace between 0.7 and 2", () => {
    expect(learnPace(WALK, { i: platform, walked: 5000 })).toBe(2);
    expect(learnPace(WALK, { i: platform, walked: 135 })).toBe(0.7);
  });

  it("is learned on confirming the next checkpoint, and only carried on a jump anywhere else", () => {
    expect(arrive(WALK, { i: platform, walked: 231 }, platform + 1).pace).toBeCloseTo(1.05, 2);
    expect(arrive(WALK, { i: platform, walked: 231 }, platform + 3)).toEqual({ i: platform + 3, walked: 0 });
    expect(arrive(WALK, { i: platform, walked: 231, pace: 1.3 }, platform - 2)).toEqual({ i: platform - 2, walked: 0, pace: 1.3 });
  });

  it("is learned when the camera or a tap names the next sign, and not from a wrong-way sign", () => {
    const next = placeForSign(WALK, WRONG_WAYS, WALK[platform + 1].id, { i: platform, walked: 231 });
    expect(next!.place.pace).toBeCloseTo(1.05, 2);
    const wrong = placeForSign(WALK, WRONG_WAYS, WRONG_WAYS[0].id, { i: at("us-corridor"), walked: 200, pace: 1.1 });
    expect(wrong!.place.pace).toBe(1.1);
    // Without a place to come from it behaves as before.
    expect(placeForSign(WALK, WRONG_WAYS, "us-yellow")!.place).toEqual({ i: at("us-yellow"), walked: 0 });
  });

  it("is carried through a simulated trip without being changed by it", () => {
    let p: Place | null = { i: at("us-to-l"), walked: 0, pace: 1.4 };
    for (let k = 0; k < 400 && p && p.i < at("us-mural-elevator"); k++) p = simTick(WALK, p, 1, true);
    expect(p).toEqual({ i: at("us-mural-elevator"), walked: 0, pace: 1.4 });
  });
});

describe("the dot at a rider's pace (no true position needed)", () => {
  it("puts a rider who takes k steps for each of the guide's, after k times n steps, where the guide's own walker is after n", () => {
    for (const k of [0.8, 1.4, 1.9]) {
      for (const { c, i } of walkable) {
        for (let n = 0; n <= c.steps; n += 3) {
          expect(metres(placeAt(WALK, { i, walked: n * k, pace: k }), placeAt(WALK, { i, walked: n }))).toBeLessThan(0.01);
        }
      }
    }
  });

  it("says the sign should be in view after the leg's steps at that pace, not before", () => {
    const i = at("us-corridor"); // 89 steps in the guide
    expect(dueAtNext(WALK, { i, walked: 89 })).toBe(true);
    expect(dueAtNext(WALK, { i, walked: 89, pace: 1.4 })).toBe(false);
    expect(dueAtNext(WALK, { i, walked: 125, pace: 1.4 })).toBe(true);
    expect(legShare(WALK, { i, walked: 62.3, pace: 1.4 })).toBeCloseTo(0.5, 2);
  });

  it("counts the steps still to go in the rider's own steps", () => {
    const i = at("us-to-l");
    const guide = stepsToNextStop(WALK, { i, walked: 0 });
    expect(stepsToNextStop(WALK, { i, walked: 0, pace: 1.4 })).toBe(Math.round(guide * 1.4));
    expect(stepsToNextStop(WALK, { i, walked: 0, pace: 1 })).toBe(guide);
  });

  it("never lets a faster or slower pace move the dot back, or past the next checkpoint", () => {
    for (const pace of [0.7, 1, 2]) {
      for (const { c, i } of walkable) {
        expect(placeAt(WALK, { i, walked: 0, pace })).toEqual(c.at);
        expect(placeAt(WALK, { i, walked: c.steps * pace + 500, pace })).toEqual(WALK[i + 1].at);
      }
    }
  });
});

describe("Friday's rider at 14 St-Union Sq, replayed through the guide", () => {
  // Steps this rider took on each leg, from the recording (src/features/recorder/clean/metamorphic.test.ts
  // pins the totals: 231 on the platform, 296 between the elevators). The split between the mezzanine
  // signs is an estimate, so only the totals below are measured.
  const took: Record<string, number> = { "us-platform": 231, "us-to-l": 27, "us-corridor": 125, "us-yellow": 22, "us-sw-turnstiles": 33, "us-downtown-sign": 51, "us-exit-arrow": 38 };

  /** How many of the rider's steps too early the guide says "the sign should be in view", summed over the legs. */
  function early(learn: boolean): number {
    let p: Place = { i: at("us-platform"), walked: 0 };
    let total = 0;
    while (p.i < at("us-mural-elevator")) {
      const c = WALK[p.i];
      const n = took[c.id] ?? 0;
      if (!c.by && c.steps > 0) total += Math.max(0, n - c.steps * (p.pace ?? 1));
      p = learn ? arrive(WALK, { ...p, walked: n }, p.i + 1) : { i: p.i + 1, walked: 0 };
    }
    return Math.round(total);
  }

  it("is told the sign should be in view 95 of their steps too early without a learned pace, and 50 with one", () => {
    expect(early(false)).toBe(95);
    expect(early(true)).toBe(50);
  });
});
