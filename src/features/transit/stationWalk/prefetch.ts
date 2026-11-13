/**
 * Gets the walk inside Fulton St ready before anyone taps (#126; owner, 2026-11-13: the way in was
 * horribly slow). Street view calls prefetchWalk once it comes near the station; opening the walk
 * calls it too, for a tap that beats it. Four things load side by side: the walk's code, the
 * station model, the station built from it (in a worker, walkShell.ts) and the physics engine.
 * Each finished step is published for the loading card.
 */
import { useSyncExternalStore } from "react";
import { loadModel } from "@/lib/map/dollhousePreview";

export type WalkStep = "code" | "model" | "station" | "physics";
export type WalkLoad = { done: ReadonlySet<WalkStep>; failed: boolean };

let state: WalkLoad = { done: new Set(), failed: false };
const listeners = new Set<() => void>();
const set = (next: WalkLoad) => { state = next; for (const l of listeners) l(); };
const finish = (step: WalkStep) => {
  performance.mark(`walk-${step}`);
  set({ ...state, done: new Set([...state.done, step]) });
};

let started: Promise<void> | null = null;

/** When the page is next idle, so starting the downloads never holds up a frame of the map. */
const idle = () => new Promise<void>((resolve) => {
  if (typeof requestIdleCallback === "function") requestIdleCallback(() => resolve(), { timeout: 300 });
  else setTimeout(resolve, 0);
});

async function run(): Promise<void> {
  performance.mark("walk-prefetch");
  await idle();
  const code = import("@/lib/map/three/StationWalkScene").then((m) => {
    finish("code");
    // The engine's start decodes and compiles its WebAssembly; give the map a frame first.
    return idle().then(m.warmPhysics).then(() => finish("physics"));
  });
  const station = loadModel().then((model) => {
    finish("model");
    // Imported here, not at the top, so the shell's code stays out of the app's first download.
    return import("@/lib/map/three/walkShell").then((m) => m.loadWalkShell(model)).then(() => finish("station"));
  });
  await Promise.all([code, station]);
}

/** Starts loading the walk; safe to call often. A failed load is tried again on the next call. */
export function prefetchWalk(): Promise<void> {
  if (!started) {
    if (state.failed) set({ ...state, failed: false });
    const p = run();
    started = p;
    p.catch(() => { if (started === p) started = null; set({ ...state, failed: true }); });
  }
  return started;
}

export function useWalkLoad(): WalkLoad {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state, () => state);
}
