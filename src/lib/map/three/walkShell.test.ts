import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { DollhouseModel } from "./dollhouse";
import { loadWalkShell } from "./walkShell";
import { buildWalkShell, geometryBuffers } from "./walkShellBuild";

const model = JSON.parse(readFileSync("public/transit/fulton-model.json", "utf8")) as DollhouseModel;

describe("the walk's shell, built off the page (#126)", () => {
  it("survives the trip from the worker to the page unchanged", { timeout: 120_000 }, () => {
    const built = buildWalkShell(model);
    const buffers = geometryBuffers(built.geo);
    expect(buffers.length).toBeGreaterThan(8);
    const copy = structuredClone(built);
    expect(copy.shell).toEqual(built.shell);
    expect(copy.geo.lowest).toBe(built.geo.lowest);
    expect(copy.geo.colliders.length).toBe(built.geo.colliders.length);
    expect(Array.from(copy.geo.walls.position.subarray(0, 18))).toEqual(Array.from(built.geo.walls.position.subarray(0, 18)));
    // Moving the buffers (what the worker does) leaves every typed array readable on the far side.
    const moved = structuredClone(built, { transfer: buffers });
    expect(moved.geo.floors.position.length).toBeGreaterThan(0);
    expect(moved.geo.colliders.every((c) => c.vertices.length > 0 && c.indices.length > 0)).toBe(true);
  });

  it("builds on the page where no worker can start, once per model", { timeout: 120_000 }, async () => {
    const a = loadWalkShell(model);
    expect(loadWalkShell(model)).toBe(a);
    const { shell, geo } = await a;
    expect(shell.walls.length).toBeGreaterThan(0);
    expect(geo.colliders.length).toBeGreaterThan(0);
  });
});
