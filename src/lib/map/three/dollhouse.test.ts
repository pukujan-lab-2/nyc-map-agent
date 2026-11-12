import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { walkAt, walkLength, type DollhouseModel } from "./dollhouse";

const model = JSON.parse(readFileSync("public/transit/fulton-model.json", "utf8")) as DollhouseModel;

/** Height of the model's surface under (x, y) nearest to `z`, or null where there is none. */
function floorUnder(x: number, y: number, z: number): number | null {
  let best: number | null = null;
  const { v, t } = model;
  for (let i = 0; i < t.length; i += 3) {
    const [a, b, c] = [t[i] * 3, t[i + 1] * 3, t[i + 2] * 3];
    const d = (v[b + 1] - v[c + 1]) * (v[a] - v[c]) + (v[c] - v[b]) * (v[a + 1] - v[c + 1]);
    if (Math.abs(d) < 1e-9) continue;
    const u = ((v[b + 1] - v[c + 1]) * (x - v[c]) + (v[c] - v[b]) * (y - v[c + 1])) / d;
    const w = ((v[c + 1] - v[a + 1]) * (x - v[c]) + (v[a] - v[c]) * (y - v[c + 1])) / d;
    if (u < -0.02 || w < -0.02 || u + w > 1.02) continue;
    const h = u * v[a + 2] + w * v[b + 2] + (1 - u - w) * v[c + 2];
    if (best == null || Math.abs(h - z) < Math.abs(best - z)) best = h;
  }
  return best;
}

describe("the dollhouse walk at Fulton St", () => {
  it("starts on the platform and ends at the street", () => {
    expect(walkAt(model.walk, 0).z).toBeCloseTo(-4.2, 1);
    expect(walkAt(model.walk, 1).z).toBeGreaterThan(-0.5);
    expect(walkLength(model.walk)).toBeGreaterThan(15);
  });

  it("keeps the figure's feet on a floor or stair the whole way", () => {
    for (let i = 0; i <= 100; i++) {
      const p = walkAt(model.walk, i / 100);
      const floor = floorUnder(p.x, p.y, p.z);
      expect(floor, `no floor under the figure at ${i}%`).not.toBeNull();
      expect(Math.abs((floor as number) - p.z), `feet off the floor at ${i}%`).toBeLessThan(0.45);
    }
  });

  it("never steps up or down more than a stair's rise between frames", () => {
    let prev = walkAt(model.walk, 0);
    for (let i = 1; i <= 400; i++) {
      const p = walkAt(model.walk, i / 400);
      expect(Math.abs(p.z - prev.z)).toBeLessThan(0.2);
      prev = p;
    }
  });

  it("stays small enough to load on a phone", () => {
    expect(readFileSync("public/transit/fulton-model.json").byteLength).toBeLessThan(2_000_000);
  });
});
