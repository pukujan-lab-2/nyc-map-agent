/** Builds the walk's station shell and geometry off the page (walkShell.ts). Plain numbers, no three.js. */
import type { DollhouseModel } from "./dollhouse";
import { buildWalkShell, geometryBuffers, type WalkShellReply } from "./walkShellBuild";

self.onmessage = (e: MessageEvent<DollhouseModel>) => {
  const post = (reply: WalkShellReply, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(reply, transfer);
  try {
    const t = performance.now();
    const result = buildWalkShell(e.data);
    post({ result, ms: Math.round(performance.now() - t) }, geometryBuffers(result.geo));
  } catch (err) {
    post({ error: String(err) });
  }
};
