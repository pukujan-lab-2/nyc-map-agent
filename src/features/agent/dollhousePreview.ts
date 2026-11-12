/**
 * Opens the dollhouse view of the walk out of Fulton St over the map, for checking it before it
 * is part of a trip (#129). The figure walks the whole way in `seconds`, waits, and starts again;
 * pass `at` (0 to 1) to hold it at one spot instead.
 */
import type { DollhouseModel } from "@/lib/map/three/dollhouse";

export async function showDollhouse(container: HTMLElement, opts: { seconds?: number; at?: number } = {}): Promise<() => void> {
  const [{ mountDollhouse }, model] = await Promise.all([
    import("@/lib/map/three/dollhouse"),
    fetch("/transit/fulton-model.json").then((r) => r.json() as Promise<DollhouseModel>),
  ]);
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset.testid = "dollhouse";
  canvas.className = "pointer-events-none absolute inset-0 z-[1] h-full w-full";
  container.appendChild(canvas);
  const seconds = opts.seconds ?? 20, pause = 2;
  const began = performance.now();
  const unmount = mountDollhouse(canvas, model, () => {
    if (opts.at != null) return opts.at;
    const t = ((performance.now() - began) / 1000) % (seconds + pause);
    return Math.min(t / seconds, 1);
  });
  return () => { unmount(); canvas.remove(); };
}
