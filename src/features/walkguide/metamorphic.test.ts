/**
 * Metamorphic checks on the Walk Guide's dot, over the whole filmed walk. None
 * needs to know where a rider truly was: each says how the dot must respond
 * when its input changes. See docs/PLAN-underground-guidance.md.
 */
import { describe, expect, it } from "vitest";
import { legPath, placeAt, placeForSign } from "./progress";
import { WALK, WRONG_WAYS } from "./walks";

const metres = (a: [number, number], b: [number, number]): number =>
  Math.hypot((b[0] - a[0]) * 111_320 * Math.cos((a[1] * Math.PI) / 180), (b[1] - a[1]) * 110_540);
/** How far along its leg a point of that leg is, metres from the leg's start, by walking the leg's stretches. */
function alongM(i: number, at: [number, number]): number {
  const line = legPath(WALK, i);
  let best = Infinity, bestAt = 0, before = 0;
  for (let j = 1; j < line.length; j++) {
    const a = line[j - 1], b = line[j], L = metres(a, b);
    const off = Math.abs(metres(a, at) + metres(at, b) - L);
    if (off < best) { best = off; bestAt = before + metres(a, at); }
    before += L;
  }
  return bestAt;
}

describe("the Walk Guide's dot", () => {
  it("never moves back along a leg as more steps are counted", () => {
    WALK.forEach((c, i) => {
      if (c.by || c.steps <= 0 || i === WALK.length - 1) return;
      let last = -1;
      for (let walked = 0; walked <= c.steps + 40; walked++) {
        const m = alongM(i, placeAt(WALK, { i, walked }));
        expect(m).toBeGreaterThanOrEqual(last - 0.01);
        last = m;
      }
    });
  });

  it("stops at the next checkpoint however many extra steps a rider takes", () => {
    WALK.forEach((c, i) => {
      if (c.by || c.steps <= 0 || i === WALK.length - 1) return;
      for (const extra of [0, 1, 50, 5000]) expect(placeAt(WALK, { i, walked: c.steps + extra })).toEqual(WALK[i + 1].at);
    });
  });

  it("is exactly on a checkpoint the moment its sign is confirmed, whatever was counted before", () => {
    for (const c of WALK) {
      const got = placeForSign(WALK, WRONG_WAYS, c.id);
      expect(got).not.toBeNull();
      expect(got!.place.walked).toBe(0);
      expect(placeAt(WALK, got!.place)).toEqual(c.at);
    }
  });

  it("sends a wrong-way sign back to a checkpoint on the walk, never to somewhere off it", () => {
    for (const w of WRONG_WAYS) {
      const got = placeForSign(WALK, WRONG_WAYS, w.id);
      expect(got).not.toBeNull();
      expect(WALK.map((c) => c.id)).toContain(WALK[got!.place.i].id);
      expect(got!.wrong).toBe(w);
    }
  });
});
