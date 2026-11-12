/**
 * Opens the dollhouse view of the walk out of Fulton St on a canvas over the map (#129).
 * `getProgress` says how far along the walk the figure is (0 to 1); null holds the last frame.
 */
import type { DollhouseModel } from "@/lib/map/three/dollhouse";

export async function openDollhouse(container: HTMLElement, getProgress: () => number | null, testid: string): Promise<{ canvas: HTMLCanvasElement; stop: () => void }> {
  const [{ mountDollhouse }, model] = await Promise.all([
    import("@/lib/map/three/dollhouse"),
    fetch("/transit/fulton-model.json").then((r) => r.json() as Promise<DollhouseModel>),
  ]);
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset.testid = testid;
  canvas.className = "pointer-events-none absolute inset-0 z-[1] h-full w-full";
  container.appendChild(canvas);
  const unmount = mountDollhouse(canvas, model, getProgress);
  return { canvas, stop: () => { unmount(); canvas.remove(); } };
}

/**
 * For checking the view by itself (dev and test builds): the figure walks the whole way in
 * `seconds`, waits, and starts again; pass `at` (0 to 1) to hold it at one spot instead.
 */
export async function showDollhouse(container: HTMLElement, opts: { seconds?: number; at?: number } = {}): Promise<() => void> {
  const seconds = opts.seconds ?? 20, pause = 2;
  const began = performance.now();
  const { stop } = await openDollhouse(container, () => {
    if (opts.at != null) return opts.at;
    const t = ((performance.now() - began) / 1000) % (seconds + pause);
    return Math.min(t / seconds, 1);
  }, "dollhouse");
  return stop;
}
