/**
 * The dollhouse view of a station walk (owner, 2026-11-12, #129): a blocky figure seen from above
 * and behind, on a station model with no ceilings, with every level above the figure cut away so
 * nothing hides it. Drawn on its own canvas, as the first-person station view is.
 *
 * The model is a triangle mesh in metres east, north and up of its origin (street level is 0),
 * with the walk as points on its floors and stairs. Fulton St's comes from Project Subway NYC's
 * station model (credited in the map's credits).
 */
import * as THREE from "three";
import { LEGACY_LIGHT } from "./core";

export type DollhouseModel = {
  origin: [number, number];
  /** x, y, z per vertex, metres. */
  v: number[];
  /** Three vertex indices per triangle. */
  t: number[];
  /** The way the figure walks, feet on the model. */
  walk: Array<[number, number, number]>;
};

export type WalkPose = { x: number; y: number; z: number; /** Radians, 0 = north, clockwise. */ heading: number; /** Metres walked so far. */ walked: number };

/** How far the cut sits above the figure's feet: over its head, under the next floor up. */
export const CUT_ABOVE_FEET_M = 2.3;
const FIGURE_M = 1.75;
const BACK_M = 13;
const UP_M = 14;

/** Length of the walk in metres, stairs measured along their slope. */
export function walkLength(walk: DollhouseModel["walk"]): number {
  let total = 0;
  for (let i = 1; i < walk.length; i++) total += Math.hypot(walk[i][0] - walk[i - 1][0], walk[i][1] - walk[i - 1][1], walk[i][2] - walk[i - 1][2]);
  return total;
}

/** Where the figure stands a fraction `f` (0 to 1) of the way along the walk, and which way it faces. */
export function walkAt(walk: DollhouseModel["walk"], f: number): WalkPose {
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

function box(w: number, d: number, h: number, color: number, clip: THREE.Plane[]): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, d, h), new THREE.MeshLambertMaterial({ color, clippingPlanes: clip }));
  return mesh;
}

/** A simple blocky figure, feet at the group's origin, facing +y. Its limbs swing as it walks. */
function buildFigure(): { group: THREE.Group; stride: (walkedM: number) => void } {
  const group = new THREE.Group();
  const none: THREE.Plane[] = [];
  const leg = 0.78, torso = 0.62, head = 0.32;
  const limb = (x: number, top: number, len: number, w: number, color: number) => {
    // Pivot at the hip or shoulder so the limb swings from its top.
    const pivot = new THREE.Group();
    pivot.position.set(x, 0, top);
    const part = box(w, w, len, color, none);
    part.position.z = -len / 2;
    pivot.add(part);
    group.add(pivot);
    return pivot;
  };
  const legL = limb(-0.13, leg, leg, 0.22, 0x1e3a8a), legR = limb(0.13, leg, leg, 0.22, 0x1e3a8a);
  const body = box(0.52, 0.28, torso, 0xf97316, none);
  body.position.z = leg + torso / 2;
  const top = box(head, head, head, 0xfcd9b6, none);
  top.position.z = leg + torso + head / 2 + 0.03;
  const armL = limb(-0.36, leg + torso - 0.04, 0.58, 0.17, 0xf97316), armR = limb(0.36, leg + torso - 0.04, 0.58, 0.17, 0xf97316);
  group.add(body, top);
  group.scale.setScalar(FIGURE_M / (leg + torso + head + 0.03));
  const stride = (walkedM: number) => {
    const swing = Math.sin((walkedM / 0.7) * Math.PI) * 0.6;
    legL.rotation.x = swing; legR.rotation.x = -swing;
    armL.rotation.x = -swing * 0.8; armR.rotation.x = swing * 0.8;
  };
  return { group, stride };
}

function dispose(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    mesh.geometry?.dispose();
    const mat = mesh.material;
    (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((m) => m.dispose());
  });
}

/**
 * Draw the dollhouse on `canvas`. `getProgress` says how far along the walk the figure is (0 to 1),
 * or null to hold the last frame. Returns the function that stops it.
 */
export function mountDollhouse(canvas: HTMLCanvasElement, model: DollhouseModel, getProgress: () => number | null): () => void {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14161a);
  // Keeps what is at or below the cut height: the levels above the figure are not drawn.
  const cut = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(model.v, 3));
  geometry.setIndex(model.t);
  geometry.computeVertexNormals();
  // Deeper floors are darker, so the levels read apart from above.
  let lowest = 0;
  for (let i = 2; i < model.v.length; i += 3) lowest = Math.min(lowest, model.v[i]);
  const shade = new Float32Array(model.v.length);
  const high = new THREE.Color(0xe7e4dd), low = new THREE.Color(0x6b7280), mix = new THREE.Color();
  for (let i = 0; i < model.v.length; i += 3) {
    mix.copy(low).lerp(high, lowest < 0 ? 1 - model.v[i + 2] / lowest : 1);
    shade.set([mix.r, mix.g, mix.b], i);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(shade, 3));
  const station = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: true, clippingPlanes: [cut] }));
  // Thin dark lines where surfaces meet at an angle, so stairs and floor edges read from above.
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 20), new THREE.LineBasicMaterial({ color: 0x4a4f58, clippingPlanes: [cut] }));

  // The way ahead, as a ribbon thick enough to see from the camera's height.
  const line = new THREE.CatmullRomCurve3(model.walk.map(([x, y, z]) => new THREE.Vector3(x, y, z + 0.12)), false, "catmullrom", 0.05);
  const way = new THREE.Mesh(new THREE.TubeGeometry(line, model.walk.length * 12, 0.11, 6), new THREE.MeshBasicMaterial({ color: 0x3fbf6f, clippingPlanes: [cut] }));
  const { group: figure, stride } = buildFigure();
  scene.add(station, edges, way, figure);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x565b66, 0.75 * LEGACY_LIGHT));
  const sun = new THREE.DirectionalLight(0xffffff, 0.45 * LEGACY_LIGHT);
  sun.position.set(-30, -40, 80);
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 600);
  camera.up.set(0, 0, 1);
  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  let frame = 0;
  /** The camera's own bearing, eased towards the figure's so a switchback does not whip the view round. */
  let behind: number | null = null;
  let last = performance.now();
  const target = new THREE.Vector3();
  const tick = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const f = getProgress();
    if (f != null) {
      const pose = walkAt(model.walk, f);
      figure.position.set(pose.x, pose.y, pose.z);
      figure.rotation.z = -pose.heading;
      stride(pose.walked);
      cut.constant = pose.z + CUT_ABOVE_FEET_M;
      if (behind == null) behind = pose.heading;
      else {
        const turn = Math.atan2(Math.sin(pose.heading - behind), Math.cos(pose.heading - behind));
        behind += turn * Math.min(dt * 1.2, 1);
      }
      target.set(pose.x, pose.y, pose.z + 1);
      camera.position.set(pose.x - Math.sin(behind) * BACK_M, pose.y - Math.cos(behind) * BACK_M, pose.z + UP_M);
      camera.lookAt(target);
      renderer.render(scene, camera);
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(frame);
    ro.disconnect();
    dispose(scene);
    renderer.dispose();
  };
}
