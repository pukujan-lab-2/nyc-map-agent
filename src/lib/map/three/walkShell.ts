/**
 * The station shell and the walk's floors, walls and colliders for the walk inside Fulton St (#126),
 * built off the main thread. stationShell plus walkGeometry take about 2 s on a laptop and four
 * times that on a phone; run on the page they froze it between the tap and the walk. Here they run
 * in a worker (walkShell.worker.ts) and come back as plain arrays, the geometry's buffers moved
 * rather than copied. Where a worker can't start (tests, an old browser) they run on the page.
 *
 * Call stationShell for the walk only through loadWalkShell, so the shell can change underneath.
 */
import type { DollhouseModel } from "./dollhouse";
import { buildWalkShell, type WalkShell, type WalkShellReply } from "./walkShellBuild";

export type { WalkShell } from "./walkShellBuild";

function inWorker(model: DollhouseModel): Promise<WalkShell> {
  if (typeof Worker === "undefined") return Promise.reject(new Error("no worker"));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./walkShell.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<WalkShellReply>) => {
      worker.terminate();
      if ("error" in e.data) reject(new Error(e.data.error));
      else { performance.mark("walk-station-built", { detail: { workerMs: e.data.ms } }); resolve(e.data.result); }
    };
    worker.onerror = (e) => { worker.terminate(); reject(new Error(e.message || "walk shell worker failed")); };
    worker.postMessage(model);
  });
}

let built: { model: DollhouseModel; promise: Promise<WalkShell> } | null = null;

/** The shell and walk geometry for `model`, built once (in a worker where it can be) and kept. */
export function loadWalkShell(model: DollhouseModel): Promise<WalkShell> {
  if (built?.model === model) return built.promise;
  const promise = inWorker(model).catch(() => buildWalkShell(model));
  built = { model, promise };
  // A failed build is tried again next time, not kept.
  promise.catch(() => { if (built?.promise === promise) built = null; });
  return promise;
}
