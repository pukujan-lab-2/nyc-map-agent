/** Builds the walk's shell and geometry: run in walkShell.worker.ts, or on the page as a fallback (walkShell.ts). */
import type { DollhouseModel } from "./dollhouse";
import { stationShell, type Shell } from "./stationShell";
import { walkGeometry, type WalkGeometry } from "./stationWalkGeometry";

export type WalkShell = { shell: Shell; geo: WalkGeometry };

export type WalkShellReply = { result: WalkShell; ms: number } | { error: string };

/** Builds both, where it is called: the worker's job, and the fallback on the page. */
export function buildWalkShell(model: DollhouseModel): WalkShell {
  const shell = stationShell(model);
  return { shell, geo: walkGeometry(model, shell) };
}

/** Every typed array's buffer in the geometry, once each, to move to the page instead of copying. */
export function geometryBuffers(geo: WalkGeometry): ArrayBuffer[] {
  const out = new Set<ArrayBuffer>();
  for (const s of [geo.floors, geo.stairs, geo.walls, geo.ceiling]) { out.add(s.position.buffer as ArrayBuffer); out.add(s.uv.buffer as ArrayBuffer); }
  for (const c of geo.colliders) { out.add(c.vertices.buffer as ArrayBuffer); out.add(c.indices.buffer as ArrayBuffer); }
  return [...out];
}
