/**
 * Puts the dollhouse view of the walk out of Fulton St into the map (#129): the station model as a
 * map layer, one walk per street exit, and a chase camera for the trip preview to follow.
 */
import { LngLat, type Map as MaplibreMap } from "maplibre-gl";
import type { DollhouseModel, DollhouseRig, DollhouseState } from "@/lib/map/three/dollhouse";

let model: Promise<DollhouseModel> | null = null;
function loadModel(): Promise<DollhouseModel> {
  model ??= fetch("/transit/fulton-model.json").then((r) => {
    if (!r.ok) throw new Error(`station model ${r.status}`);
    return r.json() as Promise<DollhouseModel>;
  });
  model.catch(() => { model = null; });
  return model;
}

export type DollhouseView = {
  /** Where the camera goes this frame. */
  rig: (dt: number) => DollhouseRig | null;
  /** The walk's length in metres. */
  lengthM: number;
  stop: () => void;
};

/**
 * Adds the dollhouse layer for the walk that comes up at `exit` and draws whatever `getState`
 * says. Null when the model has no walk to that exit (the trip then keeps the first-person walk).
 */
export async function openDollhouse(map: MaplibreMap, exit: [number, number] | null, getState: () => DollhouseState, street: string | null): Promise<DollhouseView | null> {
  const [{ dollhouseLayer, pickWalk, walkLength, DOLLHOUSE_LAYER }, m] = await Promise.all([import("@/lib/map/three/dollhouse"), loadModel()]);
  // No exit asked for (the dev hook): the longest walk, through the most of the station.
  const walk = exit ? pickWalk(m, exit) : [...m.walks].sort((a, b) => walkLength(b.path) - walkLength(a.path))[0];
  if (!walk) return null;
  if (map.getLayer(DOLLHOUSE_LAYER)) map.removeLayer(DOLLHOUSE_LAYER);
  const view = dollhouseLayer(m, walk, getState, street);
  map.addLayer(view.layer);
  return {
    rig: view.rig,
    lengthM: walkLength(walk.path),
    stop: () => { if (map.getLayer(DOLLHOUSE_LAYER)) map.removeLayer(DOLLHOUSE_LAYER); },
  };
}

/** Points the map's camera along a dollhouse rig. */
function aimAt(map: MaplibreMap, rig: DollhouseRig): void {
  const cam = map.calculateCameraOptionsFromTo(new LngLat(...rig.eye), rig.eyeAlt, new LngLat(...rig.look), rig.lookAlt);
  map.jumpTo({ center: rig.look, zoom: cam.zoom, pitch: cam.pitch, bearing: cam.bearing, elevation: rig.lookAlt });
}

/**
 * For checking the view by itself (dev and test builds): the train pulls out, then the figure walks
 * the longest walk in `seconds` with the camera following, and it starts again. `at` (0 to 1) holds
 * the figure at one spot of the walk; `exit` picks the walk to that exit.
 */
export async function showDollhouse(map: MaplibreMap, opts: { seconds?: number; at?: number; exit?: [number, number]; street?: string } = {}): Promise<() => void> {
  const seconds = opts.seconds ?? 60, wait = 4, pause = 2;
  const began = performance.now();
  const state: DollhouseState = { walk: 0, wait: null, street: null };
  const tick = () => {
    if (opts.at != null) { state.walk = opts.at; state.wait = null; return; }
    const t = ((performance.now() - began) / 1000) % (wait + seconds + pause);
    state.wait = t < wait ? t / wait : null;
    state.walk = Math.min(Math.max(t - wait, 0) / seconds, 1);
  };
  const maxZoom = map.getMaxZoom();
  map.setMaxZoom(24);
  const view = await openDollhouse(map, opts.exit ?? null, () => { tick(); return state; }, opts.street ?? "Fulton Street");
  if (!view) { map.setMaxZoom(maxZoom); return () => {}; }
  let frame = 0, last = performance.now();
  const step = (now: number) => {
    const rig = view.rig(Math.min((now - last) / 1000, 0.1));
    last = now;
    if (rig) aimAt(map, rig);
    frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => { cancelAnimationFrame(frame); view.stop(); map.setMaxZoom(maxZoom); };
}
