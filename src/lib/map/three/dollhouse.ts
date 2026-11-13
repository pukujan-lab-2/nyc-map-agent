/**
 * The dollhouse view of a station walk (owner, 2026-11-12, #129): a blocky figure seen from above
 * and behind, inside the station's model drawn in the map itself, so the streets show around it and
 * the walk carries on out of the exit. Walls are cut off at waist height and every level above the
 * figure is cut away, so nothing hides it. The train pulls out first, then the figure walks past
 * the signs and through the fare gates to the street.
 *
 * The model is a triangle mesh in metres east, north and up of its origin (street level is 0),
 * with one walk per street exit, the platform edges and the downtown track. Fulton St's comes from
 * Project Subway NYC's station model (credited in the map's credits). The fare gates and signs are
 * not in that model: they are placed by rule along the walk (the gates on the last level stretch
 * before the stair to the street), not surveyed.
 */
import * as THREE from "three";
import type { CustomLayerInterface, Map as MaplibreMap } from "maplibre-gl";
import { LEGACY_LIGHT, MercatorCoordinate, sharedRenderer } from "./core";

type P3 = [number, number, number];
type DollhouseWalk = { exit: [number, number]; path: P3[] };
export type DollhouseModel = {
  origin: [number, number];
  /** x, y, z per vertex, metres. */
  v: number[];
  /** Three vertex indices per triangle. */
  t: number[];
  /** One walk from the downtown 4/5 platform to each street exit, feet on the model. */
  walks: DollhouseWalk[];
  /** Platform edges over a track bed: x1, y1, x2, y2, z. */
  edges: Array<[number, number, number, number, number]>;
  /** The downtown 4/5 track beside where the walks start: rail height, and the way the train leaves (radians from east). */
  track: { at: P3; angle: number };
};

type WalkPose = { x: number; y: number; z: number; /** Radians, 0 = north, clockwise. */ heading: number; /** Metres walked so far. */ walked: number };

/** What the trip says each frame: how far along the walk (0 to 1), how far the train has pulled out (0 to 1), or where on the street. */
export type DollhouseState = { walk: number | null; wait: number | null; street: { lon: number; lat: number; heading: number } | null };
/** A camera in the map's terms: eye and the point looked at, with their heights in metres (negative is underground). */
export type DollhouseRig = { eye: [number, number]; eyeAlt: number; look: [number, number]; lookAlt: number };

/** How far the cut sits above the figure's feet: over its head, under the next floor up. */
const CUT_ABOVE_FEET_M = 2.3;
/** Walls stop at this height above the figure's feet, so the rooms read from above. */
const WALL_ABOVE_FEET_M = 1.6;
const FIGURE_M = 1.75;
/** The chase camera: close behind the figure's back and a little over its head (owner, 2026-11-12). */
const BACK_M = 7;
const UP_M = 4.4;
const LOOK_M = 1.2;
/** An exit this close to where a walk comes up is that walk's exit. */
const EXIT_MATCH_M = 50;
/** How long the figure takes to glide from the model's last stair onto the street walk. */
const GLIDE_MS = 1500;
/** Lexington Avenue line green, for the train's stripe and the bullets. */
const LEX_GREEN = 0x00933c;
const CAR_M = 15.5, CARS = 10;

/** Length of a walk in metres, stairs measured along their slope. */
export function walkLength(walk: P3[]): number {
  let total = 0;
  for (let i = 1; i < walk.length; i++) total += Math.hypot(walk[i][0] - walk[i - 1][0], walk[i][1] - walk[i - 1][1], walk[i][2] - walk[i - 1][2]);
  return total;
}

/** Where the figure stands a fraction `f` (0 to 1) of the way along the walk, and which way it faces. */
export function walkAt(walk: P3[], f: number): WalkPose {
  const total = walkLength(walk);
  const want = Math.min(Math.max(f, 0), 1) * total;
  let done = 0;
  for (let i = 1; i < walk.length; i++) {
    const [ax, ay, az] = walk[i - 1], [bx, by, bz] = walk[i];
    const len = Math.hypot(bx - ax, by - ay, bz - az);
    if (done + len >= want || i === walk.length - 1) {
      const k = len > 0 ? Math.min((want - done) / len, 1) : 0;
      return { x: ax + (bx - ax) * k, y: ay + (by - ay) * k, z: az + (bz - az) * k, heading: Math.atan2(bx - ax, by - ay), walked: want };
    }
    done += len;
  }
  const [x, y, z] = walk[0] ?? [0, 0, 0];
  return { x, y, z, heading: 0, walked: 0 };
}

const metresBetween = (a: [number, number], b: [number, number]) =>
  Math.hypot((a[0] - b[0]) * 111_320 * Math.cos((a[1] * Math.PI) / 180), (a[1] - b[1]) * 111_320);

/** The walk that comes up at `exit` (the trip's exit), or null when the model has no walk to it. */
export function pickWalk(model: DollhouseModel, exit: [number, number]): DollhouseWalk | null {
  let best: DollhouseWalk | null = null, bestD = EXIT_MATCH_M;
  for (const w of model.walks) {
    const d = metresBetween(w.exit, exit);
    if (d < bestD) { best = w; bestD = d; }
  }
  return best;
}

/** Where along the walk things go: the stair feet and heads (signs) and the fare line (gates). */
export function walkPlaces(walk: P3[]): { signs: Array<{ at: P3; heading: number; up: boolean; last: boolean }>; gates: { at: P3; heading: number } | null } {
  const signs: Array<{ at: P3; heading: number; up: boolean; last: boolean }> = [];
  const lastClimb = (() => {
    for (let i = walk.length - 2; i >= 0; i--) if (walk[i + 1][2] - walk[i][2] > 0.3 && walk[i][2] < -0.6) {
      let j = i;
      while (j > 0 && walk[j][2] - walk[j - 1][2] > 0.05) j--;
      return j;
    }
    return -1;
  })();
  for (let i = 0; i < walk.length - 1; i++) {
    const dz = walk[i + 1][2] - walk[i][2];
    const flatBefore = i === 0 || Math.abs(walk[i][2] - walk[i - 1][2]) < 0.2;
    if (Math.abs(dz) < 0.3 || !flatBefore) continue;
    const heading = Math.atan2(walk[i + 1][0] - walk[i][0], walk[i + 1][1] - walk[i][1]);
    signs.push({ at: walk[i], heading, up: dz > 0, last: i === lastClimb });
  }
  let gates: { at: P3; heading: number } | null = null;
  if (lastClimb > 0) {
    // Back along the level stretch before the last stair: the fare line sits a few metres short of it.
    const foot = walk[lastClimb];
    let back = 0;
    for (let i = lastClimb; i > 0; i--) {
      const [a, b] = [walk[i - 1], walk[i]];
      if (Math.abs(a[2] - foot[2]) > 0.2) break;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const want = 3.5 - back;
      if (len >= want) {
        const k = want / len;
        gates = { at: [b[0] + (a[0] - b[0]) * k, b[1] + (a[1] - b[1]) * k, foot[2]], heading: Math.atan2(b[0] - a[0], b[1] - a[1]) };
        break;
      }
      back += len;
    }
  }
  return { signs, gates };
}

function box(w: number, d: number, h: number, color: number, clip: THREE.Plane[] = []): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, d, h), new THREE.MeshLambertMaterial({ color, clippingPlanes: clip }));
}

/** A simple blocky figure, feet at the group's origin, facing +y. Its limbs swing as it walks. */
function buildFigure(): { group: THREE.Group; stride: (walkedM: number, moving: boolean) => void } {
  const group = new THREE.Group();
  const leg = 0.78, torso = 0.62, head = 0.32;
  const limb = (x: number, top: number, len: number, w: number, color: number) => {
    // Pivot at the hip or shoulder so the limb swings from its top.
    const pivot = new THREE.Group();
    pivot.position.set(x, 0, top);
    const part = box(w, w, len, color);
    part.position.z = -len / 2;
    pivot.add(part);
    group.add(pivot);
    return pivot;
  };
  const legL = limb(-0.13, leg, leg, 0.22, 0x1e3a8a), legR = limb(0.13, leg, leg, 0.22, 0x1e3a8a);
  const body = box(0.52, 0.28, torso, 0xf97316);
  body.position.z = leg + torso / 2;
  const top = box(head, head, head, 0xfcd9b6);
  top.position.z = leg + torso + head / 2 + 0.03;
  const armL = limb(-0.36, leg + torso - 0.04, 0.58, 0.17, 0xf97316), armR = limb(0.36, leg + torso - 0.04, 0.58, 0.17, 0xf97316);
  group.add(body, top);
  group.scale.setScalar(FIGURE_M / (leg + torso + head + 0.03));
  const stride = (walkedM: number, moving: boolean) => {
    const swing = moving ? Math.sin((walkedM / 0.7) * Math.PI) * 0.6 : 0;
    legL.rotation.x = swing; legR.rotation.x = -swing;
    armL.rotation.x = -swing * 0.8; armR.rotation.x = swing * 0.8;
  };
  return { group, stride };
}

/** Subway wall tile: off-white glazed tiles with grey grout. */
function tileTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#f1eee6"; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = "#b9b4aa"; g.lineWidth = 2;
  for (const p of [0, 32]) { g.beginPath(); g.moveTo(0, p + 1); g.lineTo(64, p + 1); g.stroke(); }
  g.beginPath(); g.moveTo(1, 0); g.lineTo(1, 32); g.moveTo(33, 32); g.lineTo(33, 64); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** A black sign with white lettering, as the MTA hangs them; `bullets` puts the 4 and 5 in green circles before the text. */
function signMesh(text: string, opts: { arrow?: "up" | "down"; bullets?: boolean; width?: number } = {}): THREE.Mesh {
  const w = opts.width ?? 2.4, h = 0.42, px = 96;
  const c = document.createElement("canvas");
  c.width = Math.round(w * px); c.height = Math.round(h * px);
  const g = c.getContext("2d")!;
  g.fillStyle = "#111214"; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#f7f7f5"; g.fillRect(0, 4, c.width, 3);
  let x = 14;
  const mid = c.height / 2 + 3;
  if (opts.bullets) for (const n of ["4", "5"]) {
    g.fillStyle = "#00933c"; g.beginPath(); g.arc(x + 15, mid, 15, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#fff"; g.font = "bold 22px Helvetica, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(n, x + 15, mid + 1);
    x += 36;
  }
  if (opts.arrow) {
    g.fillStyle = "#fff"; g.font = "bold 28px Helvetica, Arial, sans-serif"; g.textAlign = "left"; g.textBaseline = "middle";
    g.fillText(opts.arrow === "up" ? "↑" : "↓", x, mid); x += 26;
  }
  g.fillStyle = "#fff"; g.font = "bold 24px Helvetica, Arial, sans-serif"; g.textAlign = "left"; g.textBaseline = "middle";
  g.fillText(text, x + 6, mid, c.width - x - 16);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
  // Planes face +z; callers stand it up (a quarter turn about x makes it face -y) and turn it to face the walker.
  return mesh;
}

/** A waist-high turnstile, walked through along +y: its body to the right of the lane, its three arms across it. */
function turnstile(): { group: THREE.Group; rotor: THREE.Group } {
  const group = new THREE.Group();
  const steel = 0xc7ccd3;
  const body = box(0.3, 0.9, 0.95, steel);
  body.position.set(0.32, 0, 0.475);
  const top = box(0.34, 0.95, 0.06, 0x3a3f47);
  top.position.set(0.32, 0, 0.98);
  const rotor = new THREE.Group();
  rotor.position.set(0.17, 0, 0.85);
  for (let i = 0; i < 3; i++) {
    const arm = box(0.5, 0.05, 0.05, steel);
    arm.position.x = -0.25;
    const holder = new THREE.Group();
    holder.rotation.y = (i * 2 * Math.PI) / 3;
    holder.add(arm);
    rotor.add(holder);
  }
  group.add(body, top, rotor);
  return { group, rotor };
}

/** The tall gate that only lets people out: a cage of bars, full height. */
function highExitGate(): THREE.Group {
  const group = new THREE.Group();
  const frame = 0x5b616b;
  for (const x of [-0.6, 0.6]) { const post = box(0.08, 0.08, 2.3, frame); post.position.set(x, 0, 1.15); group.add(post); }
  const lintel = box(1.28, 0.1, 0.08, frame); lintel.position.set(0, 0, 2.3); group.add(lintel);
  for (let i = 0; i < 9; i++) { const bar = box(0.04, 0.04, 2.2, 0x9aa1ab); bar.position.set(-0.5 + i * 0.125, 0, 1.12); group.add(bar); }
  return group;
}

/** The emergency gate: a waist-high swing gate with its red sign. */
function emergencyGate(): THREE.Group {
  const group = new THREE.Group();
  const post = box(0.1, 0.1, 1.05, 0x5b616b); post.position.set(-0.55, 0, 0.52); group.add(post);
  const leaf = box(1.0, 0.04, 0.8, 0xc7ccd3); leaf.position.set(0, 0, 0.55); group.add(leaf);
  const red = box(0.5, 0.05, 0.16, 0xd62f2f); red.position.set(0, 0.03, 0.8); group.add(red);
  return group;
}

function dispose(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    mesh.geometry?.dispose();
    const mat = mesh.material;
    (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((m) => { (m as THREE.MeshBasicMaterial).map?.dispose(); m.dispose(); });
  });
}

type Dollhouse = {
  layer: CustomLayerInterface;
  /** The chase camera for this frame: behind and above the figure, its bearing eased toward the way it walks. */
  rig: (dt: number) => DollhouseRig | null;
};

export const DOLLHOUSE_LAYER = "dollhouse";

/** A wall to raise: from (x1, y1, z1) to (x2, y2, z2) along a floor's outer edge. */
type WallRun = [number, number, number, number, number, number];
const WALL_M = 3;

/**
 * The model has floors and stairs but no walls taller than a railing, so the station's walls are
 * raised here: along every outer edge of a floor or stair, except where more floor carries on just
 * past it (a seam between two pieces of the model) and along the platform's edge by the track.
 */
export function outlineWalls(model: DollhouseModel): WallRun[] {
  const { v, t } = model;
  const P = (k: number): P3 => [v[k * 3], v[k * 3 + 1], v[k * 3 + 2]];
  const floors: P3[][] = [];
  for (let i = 0; i < t.length; i += 3) {
    const tri = [P(t[i]), P(t[i + 1]), P(t[i + 2])];
    const [a, b, c] = tri;
    const nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    const nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const len = Math.hypot(nx, ny, nz);
    if (len > 1e-9 && Math.abs(nz) / len >= 0.3) floors.push(tri);
  }
  const key = (p: P3) => `${Math.round(p[0] * 20)},${Math.round(p[1] * 20)},${Math.round(p[2] * 20)}`;
  const uses = new Map<string, number>();
  const edgeKey = (p: P3, q: P3) => [key(p), key(q)].sort().join("|");
  for (const tri of floors) for (let e = 0; e < 3; e++) {
    const k = edgeKey(tri[e], tri[(e + 1) % 3]);
    uses.set(k, (uses.get(k) ?? 0) + 1);
  }
  /** Whether some floor lies under (x, y) within 0.4 m of height z. */
  const floorAt = (x: number, y: number, z: number) => floors.some(([a, b, c]) => {
    const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(d) < 1e-9) return false;
    const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / d;
    const w = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / d;
    if (u < -0.01 || w < -0.01 || u + w > 1.01) return false;
    return Math.abs(u * a[2] + w * b[2] + (1 - u - w) * c[2] - z) < 0.4;
  });
  const nearEdge = (x: number, y: number, z: number) => model.edges.some(([x1, y1, x2, y2, ez]) => {
    if (Math.abs(z - ez) > 0.5) return false;
    const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1e-9;
    const k = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / L2));
    return Math.hypot(x - (x1 + dx * k), y - (y1 + dy * k)) < 1;
  });
  // The walks' own steps: where two pieces of floor meet at slightly different heights the seam looks
  // like an edge, and a wall there would stand across the way.
  const steps: Array<[P3, P3]> = model.walks.flatMap((w) => w.path.slice(1).map((q, i): [P3, P3] => [w.path[i], q]));
  const side = (a: P3 | number[], b: P3 | number[], p: P3 | number[]) => Math.sign((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
  const crossed = (p: P3, q: P3) => steps.some(([a, b]) => Math.abs((a[2] + b[2]) / 2 - (p[2] + q[2]) / 2) < 1.5
    && side(p, q, a) * side(p, q, b) <= 0 && side(a, b, p) * side(a, b, q) <= 0);
  const runs: WallRun[] = [];
  for (const tri of floors) for (let e = 0; e < 3; e++) {
    const p = tri[e], q = tri[(e + 1) % 3], o = tri[(e + 2) % 3];
    if (uses.get(edgeKey(p, q)) !== 1) continue;
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (L < 0.05) continue;
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, mz = (p[2] + q[2]) / 2;
    // Outward: away from the triangle's third corner.
    let ox = -(q[1] - p[1]) / L, oy = (q[0] - p[0]) / L;
    if ((o[0] - mx) * ox + (o[1] - my) * oy > 0) { ox = -ox; oy = -oy; }
    if (floorAt(mx + ox * 0.25, my + oy * 0.25, mz)) continue;
    if (nearEdge(mx, my, mz) || crossed(p, q)) continue;
    runs.push([p[0], p[1], p[2], q[0], q[1], q[2]]);
  }
  return runs;
}

/**
 * The dollhouse as a map layer: add `layer` to the map, update the state `getState` returns each
 * frame, and point the map's camera with `rig`. `street` names the street the exit comes up on,
 * for the signs.
 */
export function dollhouseLayer(model: DollhouseModel, walk: DollhouseWalk, getState: () => DollhouseState, street: string | null): Dollhouse {
  const scene = new THREE.Scene();
  const cut = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
  const wallCut = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
  const station = new THREE.Group();

  // Floors and stairs, walls apart: walls stop at waist height so the rooms read from above.
  const fv: number[] = [], fc: number[] = [], wv: number[] = [], wuv: number[] = [];
  let lowest = 0;
  for (let i = 2; i < model.v.length; i += 3) lowest = Math.min(lowest, model.v[i]);
  const high = new THREE.Color(0xd9d5cc), low = new THREE.Color(0x8d8a84), mix = new THREE.Color();
  const P = (k: number): P3 => [model.v[k * 3], model.v[k * 3 + 1], model.v[k * 3 + 2]];
  for (let i = 0; i < model.t.length; i += 3) {
    const [a, b, c] = [P(model.t[i]), P(model.t[i + 1]), P(model.t[i + 2])];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const len = Math.hypot(n[0], n[1], n[2]);
    if (len < 1e-9) continue;
    if (Math.abs(n[2]) / len < 0.3) {
      // Tile coordinates: along the wall and up it, 0.6 m to a repeat of the texture's two rows.
      const ux = -n[1] / Math.hypot(n[0], n[1]), uy = n[0] / Math.hypot(n[0], n[1]);
      for (const p of [a, b, c]) { wv.push(...p); wuv.push((p[0] * ux + p[1] * uy) / 0.6, p[2] / 0.3); }
    } else {
      for (const p of [a, b, c]) {
        fv.push(...p);
        mix.copy(low).lerp(high, lowest < 0 ? 1 - p[2] / lowest : 1);
        fc.push(mix.r, mix.g, mix.b);
      }
    }
  }
  const floorGeo = new THREE.BufferGeometry();
  floorGeo.setAttribute("position", new THREE.Float32BufferAttribute(fv, 3));
  floorGeo.setAttribute("color", new THREE.Float32BufferAttribute(fc, 3));
  floorGeo.computeVertexNormals();
  station.add(new THREE.Mesh(floorGeo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, clippingPlanes: [cut] })));
  station.add(new THREE.LineSegments(new THREE.EdgesGeometry(floorGeo, 20), new THREE.LineBasicMaterial({ color: 0x6b6862, clippingPlanes: [cut] })));
  // Raised walls along the floors' outer edges, tiled like the rest.
  for (const [x1, y1, z1, x2, y2, z2] of outlineWalls(model)) {
    const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L;
    const u1 = x1 * ux + y1 * uy, u2 = x2 * ux + y2 * uy;
    const quad: Array<[number, number, number, number, number]> = [
      [x1, y1, z1, u1, z1], [x2, y2, z2, u2, z2], [x2, y2, z2 + WALL_M, u2, z2 + WALL_M],
      [x1, y1, z1, u1, z1], [x2, y2, z2 + WALL_M, u2, z2 + WALL_M], [x1, y1, z1 + WALL_M, u1, z1 + WALL_M],
    ];
    for (const [x, y, z, u, h] of quad) { wv.push(x, y, z); wuv.push(u / 0.6, h / 0.3); }
  }
  const wallGeo = new THREE.BufferGeometry();
  wallGeo.setAttribute("position", new THREE.Float32BufferAttribute(wv, 3));
  wallGeo.setAttribute("uv", new THREE.Float32BufferAttribute(wuv, 2));
  wallGeo.computeVertexNormals();
  const tiles = tileTexture();
  // X-ray walls: see-through enough that a wall between the camera and the figure never hides the way.
  station.add(new THREE.Mesh(wallGeo, new THREE.MeshLambertMaterial({ map: tiles, side: THREE.DoubleSide, clippingPlanes: [wallCut, cut], transparent: true, opacity: 0.55, depthWrite: false })));

  // The yellow strip along each platform edge, on the platform's side.
  for (const [x1, y1, x2, y2, z] of model.edges) {
    const L = Math.hypot(x2 - x1, y2 - y1);
    const strip = box(L, 0.6, 0.02, 0xf2c94c, [cut]);
    const ang = Math.atan2(y2 - y1, x2 - x1);
    // Toward the platform: away from the track when the track is near, else either side.
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    const [tx, ty] = model.track.at;
    const side = (tx - x1) * nx + (ty - y1) * ny > 0 ? -1 : 1;
    strip.position.set((x1 + x2) / 2 + nx * 0.3 * side, (y1 + y2) / 2 + ny * 0.3 * side, z + 0.01);
    strip.rotation.z = ang;
    station.add(strip);
  }

  // Signs: the station's name by where the walk starts, and an exit sign at each stair on the way.
  const places = walkPlaces(walk.path);
  const start = walk.path[0];
  const name = signMesh("Fulton St", { bullets: true, width: 3 });
  // A few metres along, so it hangs ahead of the figure rather than over it.
  const hung = walkAt(walk.path, Math.min(6 / walkLength(walk.path), 0.5));
  name.position.set(hung.x, hung.y, hung.z + 2.4);
  const away = Math.atan2(walk.path[1][0] - start[0], walk.path[1][1] - start[1]);
  name.rotation.set(Math.PI / 2, 0, -away, "ZXY");
  station.add(name);
  for (const s of places.signs) {
    const sign = signMesh(s.last && street ? `Exit · ${street}` : street ? `To ${street}` : "Exit", { arrow: s.up ? "up" : "down" });
    // Hung a couple of metres short of the stair, facing whoever walks up to it.
    // A stair the walk starts at gets its sign a few metres in, ahead of the figure rather than over it.
    const ahead = s.at === walk.path[0] ? -3 : 1.5;
    sign.position.set(s.at[0] - Math.sin(s.heading) * ahead, s.at[1] - Math.cos(s.heading) * ahead, s.at[2] + 2.1);
    sign.rotation.set(Math.PI / 2, 0, -s.heading, "ZXY");
    station.add(sign);
  }

  // The fare line: turnstiles, the high exit gate and the emergency gate, the walk through the middle turnstile.
  const rotors: Array<{ rotor: THREE.Group; at: THREE.Vector3 }> = [];
  if (places.gates) {
    const g = places.gates;
    const line = new THREE.Group();
    line.position.set(...g.at);
    line.rotation.z = -g.heading;
    // The lane the walk takes runs between the turnstile at 0.155 and the one before it.
    const pieces: Array<[number, "turnstile" | "high" | "emergency" | "rail"]> = [[-4.1, "rail"], [-2.9, "high"], [-1.75, "turnstile"], [-0.8, "turnstile"], [0.155, "turnstile"], [1.1, "turnstile"], [2.35, "emergency"], [3.6, "rail"]];
    for (const [x, kind] of pieces) {
      if (kind === "turnstile") {
        const t = turnstile();
        t.group.position.x = x;
        line.add(t.group);
        rotors.push({ rotor: t.rotor, at: new THREE.Vector3(x + 0.17, 0, 0) });
      } else if (kind === "high") {
        const h = highExitGate(); h.position.x = x; line.add(h);
      } else if (kind === "emergency") {
        const e = emergencyGate(); e.position.x = x; line.add(e);
      } else {
        const rail = box(1.2, 0.06, 0.06, 0x5b616b); rail.position.set(x, 0, 1.0); line.add(rail);
        const post = box(0.08, 0.08, 1.0, 0x5b616b); post.position.set(x + Math.sign(x) * 0.6, 0, 0.5); line.add(post);
      }
    }
    station.add(line);
    line.updateMatrixWorld(true);
    rotors.forEach((r) => r.at.applyMatrix4(line.matrixWorld));
  }

  // The 4/5 train on the downtown track, pulling out while the figure steps off.
  const train = new THREE.Group();
  for (let i = 0; i < CARS; i++) {
    const car = new THREE.Group();
    // Not cut: the train's roof sits below the platform's ceiling, and a cut-open car reads as a hole.
    const shell = box(CAR_M - 0.5, 2.7, 3.2, 0xb8bec6); shell.position.z = 1.9; car.add(shell);
    const roof = box(CAR_M - 0.9, 2.2, 0.12, 0x8e959e); roof.position.z = 3.56; car.add(roof);
    const windows = box(CAR_M - 1.2, 2.72, 0.7, 0x2b3038); windows.position.z = 2.5; car.add(windows);
    const stripe = box(CAR_M - 0.6, 2.74, 0.18, LEX_GREEN); stripe.position.z = 1.7; car.add(stripe);
    car.position.x = -i * CAR_M;
    train.add(car);
  }
  train.position.set(...model.track.at);
  train.rotation.z = model.track.angle;
  scene.add(train);

  const { group: figure, stride } = buildFigure();
  scene.add(station, figure);
  // The scene is z-up; three's hemisphere light assumes y-up unless told.
  const sky = new THREE.HemisphereLight(0xffffff, 0x565b66, 0.5 * LEGACY_LIGHT);
  sky.position.set(0, 0, 1);
  scene.add(sky);
  const sun = new THREE.DirectionalLight(0xffffff, 0.4 * LEGACY_LIGHT);
  sun.position.set(-30, -40, 80);
  scene.add(sun);

  // The train's front is level with the door the figure steps out of when it starts to move.
  const along = (p: P3) => (p[0] - model.track.at[0]) * Math.cos(model.track.angle) + (p[1] - model.track.at[1]) * Math.sin(model.track.angle);
  const doorAlong = along(start);

  const origin = MercatorCoordinate.fromLngLat(model.origin, 0);
  const s = origin.meterInMercatorCoordinateUnits();
  const local = new THREE.Matrix4().makeTranslation(origin.x, origin.y, origin.z).scale(new THREE.Vector3(s, -s, s));
  const lift = new THREE.Matrix4();
  const ghost = new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.45, depthFunc: THREE.GreaterDepth, depthWrite: false });
  const ghosted: Array<{ mesh: THREE.Mesh; material: THREE.Material | THREE.Material[] }> = [];
  figure.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const mesh = o as THREE.Mesh;
    ghosted.push({ mesh, material: mesh.material });
  });
  const toLngLat = (x: number, y: number): [number, number] => {
    const ll = new MercatorCoordinate(origin.x + x * s, origin.y - y * s, 0).toLngLat();
    return [ll.lng, ll.lat];
  };
  const fromLngLat = (lon: number, lat: number): [number, number] => {
    const m = MercatorCoordinate.fromLngLat([lon, lat], 0);
    return [(m.x - origin.x) / s, (origin.y - m.y) / s];
  };

  const camera = new THREE.Camera();
  let renderer: THREE.WebGLRenderer | null = null;
  let map: MaplibreMap | null = null;
  /** The camera's own bearing, eased toward the figure's so a switchback does not whip the view round. */
  let behind: number | null = null;
  let feet: P3 = [...start];
  let heading = away;
  let glide: { from: P3; at: number } | null = null;
  const place = () => {
    const st = getState();
    if (st.street) {
      let [x, y] = fromLngLat(st.street.lon, st.street.lat);
      // The trip's exit can be a stair the model does not have, a few dozen metres on: coming up, the
      // figure glides from the top of the model's stair onto the street walk instead of jumping.
      if (station.visible) glide = { from: walk.path[walk.path.length - 1], at: performance.now() };
      if (glide) {
        const k = Math.min(1, (performance.now() - glide.at) / GLIDE_MS), e = k * k * (3 - 2 * k);
        x = glide.from[0] + (x - glide.from[0]) * e;
        y = glide.from[1] + (y - glide.from[1]) * e;
        if (k >= 1) glide = null;
      }
      feet = [x, y, 0];
      heading = (st.street.heading * Math.PI) / 180;
      station.visible = false;
      train.visible = false;
      figure.position.set(x, y, 0);
      figure.rotation.z = -heading;
      stride(Math.hypot(x, y), true);
      cut.constant = CUT_ABOVE_FEET_M;
      return;
    }
    station.visible = true;
    glide = null;
    const f = st.wait != null ? 0 : st.walk ?? 0;
    const pose = walkAt(walk.path, f);
    feet = [pose.x, pose.y, pose.z];
    heading = st.wait != null ? away : pose.heading;
    figure.position.set(pose.x, pose.y, pose.z);
    figure.rotation.z = -heading;
    stride(pose.walked, st.wait == null);
    cut.constant = pose.z + CUT_ABOVE_FEET_M;
    wallCut.constant = pose.z + WALL_ABOVE_FEET_M;
    // Pulling out: from standing to about 40 km/h, gone into the tunnel by the end of the wait.
    train.visible = st.wait != null && st.wait < 1;
    if (train.visible) {
      const k = st.wait ?? 0;
      const front = doorAlong + CAR_M * (CARS / 2) + 170 * k * k;
      train.position.set(model.track.at[0] + Math.cos(model.track.angle) * front, model.track.at[1] + Math.sin(model.track.angle) * front, model.track.at[2]);
    }
    for (const r of rotors) {
      const d = Math.hypot(r.at.x - pose.x, r.at.y - pose.y);
      if (d < 0.8) r.rotor.rotation.y = ((0.8 - d) / 0.8) * (Math.PI / 3);
    }
  };

  /** The map's extruded buildings, hidden while the figure is underground and shown again on the street. */
  let hidden: Array<[string, unknown]> | null = null;
  const buildings = (show: boolean) => {
    if (!map) return;
    if (!show && !hidden) {
      hidden = [];
      for (const l of map.getStyle().layers) {
        if (l.type !== "fill-extrusion") continue;
        hidden.push([l.id, map.getLayoutProperty(l.id, "visibility") ?? "visible"]);
        map.setLayoutProperty(l.id, "visibility", "none");
      }
    } else if (show && hidden) {
      for (const [id, v] of hidden) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v as "visible" | "none");
      hidden = null;
    }
  };
  const layer: CustomLayerInterface = {
    id: DOLLHOUSE_LAYER,
    type: "custom",
    renderingMode: "3d",
    onAdd(m, gl) {
      map = m;
      renderer = sharedRenderer(m, gl);
    },
    onRemove() {
      buildings(true);
      // The renderer is shared by every three.js layer; never dispose it here.
      renderer = null;
      map = null;
      dispose(scene);
      tiles.dispose();
      ghost.dispose();
    },
    render(_gl, args) {
      if (!renderer) return;
      place();
      // The map can only aim at street level, so the station is lifted until the figure's feet are
      // there; its levels keep their places relative to each other, and the street map is the floor.
      lift.makeTranslation(0, 0, -feet[2]);
      camera.projectionMatrix = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix as unknown as number[]).multiply(local).multiply(lift);
      const clipping = renderer.localClippingEnabled;
      renderer.localClippingEnabled = true;
      renderer.resetState();
      // Underground, the street's ground and buildings would hide the station: draw it over them.
      if (station.visible) renderer.clearDepth();
      renderer.render(scene, camera);
      // The figure once more, faintly, only where a floor or stair is in front of it: an x-ray when it is hidden.
      ghosted.forEach(({ mesh }) => { mesh.material = ghost; });
      renderer.render(figure, camera);
      ghosted.forEach(({ mesh, material }) => { mesh.material = material; });
      renderer.localClippingEnabled = clipping;
      map?.triggerRepaint();
    },
  };


  const rig = (dt: number): DollhouseRig | null => {
    place();
    buildings(!station.visible);
    if (behind == null) behind = heading;
    else {
      const turn = Math.atan2(Math.sin(heading - behind), Math.cos(heading - behind));
      behind += turn * Math.min(dt * 1.2, 1);
    }
    // The layer lifts the station so the feet are at street level (see `lift`).
    const [x, y] = feet;
    const ex = x - Math.sin(behind) * BACK_M, ey = y - Math.cos(behind) * BACK_M, ez = UP_M, lz = LOOK_M;
    // The map draws custom layers as if the screen's centre were at street level, whatever elevation
    // the camera is given. So look at where the line from the eye to the figure's chest crosses street
    // level: the figure stays in the middle of the screen.
    const k = ez / (ez - lz);
    return {
      eye: toLngLat(ex, ey),
      eyeAlt: ez,
      look: toLngLat(ex + (x - ex) * k, ey + (y - ey) * k),
      lookAlt: 0,
    };
  };

  return { layer, rig };
}
