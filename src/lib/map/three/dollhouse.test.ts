import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { outlineWalls, pickWalk, walkAt, walkLength, walkPlaces, type DollhouseModel } from "./dollhouse";

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

/**
 * The trip's exit for "Take the 4 train from Grand Central to Fulton St": the E exit on Fulton Street,
 * east of Nassau St. The model's stair comes up about 33 m short of it, in the same passage.
 */
const NASSAU_EXIT: [number, number] = [-74.0075959, 40.710219];

describe("the dollhouse walks at Fulton St", () => {
  it("has a walk for each exit it reaches, each from the platform to the street", () => {
    expect(model.walks.length).toBeGreaterThanOrEqual(5);
    for (const { path } of model.walks) {
      expect(walkAt(path, 0).z).toBeCloseTo(-4.2, 1);
      expect(walkAt(path, 1).z).toBeGreaterThan(-0.5);
    }
  });

  it("keeps the figure's feet on a floor or stair the whole way, on every walk", () => {
    model.walks.forEach(({ path, exit }) => {
      for (let i = 0; i <= 200; i++) {
        const p = walkAt(path, i / 200);
        const floor = floorUnder(p.x, p.y, p.z);
        expect(floor, `no floor under the figure at ${i / 2}% of the walk to ${exit.join(",")}`).not.toBeNull();
        expect(Math.abs((floor as number) - p.z), `feet off the floor at ${i / 2}% of the walk to ${exit.join(",")}`).toBeLessThan(0.45);
      }
    });
  });

  it("never steps up or down more than a stair's rise between frames", () => {
    for (const { path } of model.walks) {
      const n = Math.ceil(walkLength(path) * 4);
      let prev = walkAt(path, 0);
      for (let i = 1; i <= n; i++) {
        const p = walkAt(path, i / n);
        expect(Math.abs(p.z - prev.z)).toBeLessThan(0.35);
        prev = p;
      }
    }
  });

  it("takes the trip to Fulton St the long way, under Fulton St to the exit at Nassau St", () => {
    const walk = pickWalk(model, NASSAU_EXIT);
    expect(walk).not.toBeNull();
    expect(walkLength(walk!.path)).toBeGreaterThan(150);
    expect(Math.min(...walk!.path.map((p) => p[2]))).toBeLessThan(-10);
    const { signs, gates } = walkPlaces(walk!.path);
    expect(gates).not.toBeNull();
    expect(signs.some((s) => s.last && s.up)).toBe(true);
  });

  it("has no walk for an exit it does not reach, so that trip keeps the first-person walk", () => {
    expect(pickWalk(model, [-74.0066, 40.7095])).toBeNull();
  });

  it("raises walls along the floors' edges, and no walk passes through one", () => {
    const walls = outlineWalls(model);
    expect(walls.length).toBeGreaterThan(100);
    const side = (ax: number, ay: number, bx: number, by: number, px: number, py: number) => Math.sign((bx - ax) * (py - ay) - (by - ay) * (px - ax));
    for (const { path, exit } of model.walks) {
      const n = Math.ceil(walkLength(path) * 4);
      for (let i = 1; i <= n; i++) {
        const a = walkAt(path, (i - 1) / n), b = walkAt(path, i / n);
        for (const [x1, y1, z1, x2, y2, z2] of walls) {
          // A wall stands from its floor up; only one at the walker's level can be walked through.
          if (Math.abs((z1 + z2) / 2 - b.z) > 1) continue;
          const crosses = side(x1, y1, x2, y2, a.x, a.y) * side(x1, y1, x2, y2, b.x, b.y) < 0 && side(a.x, a.y, b.x, b.y, x1, y1) * side(a.x, a.y, b.x, b.y, x2, y2) < 0;
          expect(crosses, `the walk to ${exit.join(",")} goes through a wall at ${Math.round((i / n) * 100)}%`).toBe(false);
        }
      }
    }
  });

  it("stays small enough to load on a phone", () => {
    expect(readFileSync("public/transit/fulton-model.json").byteLength).toBeLessThan(2_000_000);
  });
});
