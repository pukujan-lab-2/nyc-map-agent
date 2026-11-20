/**
 * How a station drawn on its own canvas is lit and finished (#264): a filmic tone curve, one key
 * light with soft shadows, rough physically based surfaces, and one post pass (bloom on lamps and
 * signs, a slight grade, a vignette). Used by the view below the street (stationScene.ts) and the
 * Fulton St walk (StationWalkScene.tsx). The layers drawn on the map's own canvas do not use it:
 * they share MapLibre's renderer, which has no tone mapping.
 */
import * as THREE from "three";
import { getAmbient } from "@/lib/ambient";

/** Every number that sets the look, in one place. Light intensities are three's own units (no LEGACY_LIGHT). */
export const LOOK = {
  /** ACES filmic rolls bright tile off softly where a straight curve clipped it to white. */
  exposure: 0.92,
  /** The lamps' light off the ceiling, and its cooler bounce off the floor. */
  fill: { sky: 0xfff2df, ground: 0xb0aca4, intensity: 2.2 },
  /** The one light that shades and casts: warm, from above and a little to one side. */
  key: { color: 0xfff0d8, intensity: 2.1, toward: [0.45, -0.35, 1] as const },
  shadow: {
    /** Half the side of the square of floor round the viewer that gets shadows, and how far down they reach. */
    half: 26, depth: 14,
    /** The slab of station that casts starts this far above the viewer's feet: under the ceiling, so the level above casts nothing down here. */
    top: 3.05,
    size: 2048, sizeTouch: 1024, bias: -0.0012, normalBias: 0.035, radius: 2.2,
  },
  /** Light sources are drawn this many times brighter than white, so they glow. */
  lamp: 2.4,
  /** A sign's face, lit from inside: a little brighter than white, so it reads first and glows faintly. */
  sign: 1.35,
  bloom: { threshold: 1.0, knee: 0.9, strength: 0.34 },
  grade: { contrast: 1.07, saturation: 1.06, warm: [1.035, 1.0, 0.955] as const, cool: [0.95, 0.985, 1.05] as const, vignette: 0.32 },
};

export type Quality = { /** Soft shadows from the key light. */ shadows: boolean; /** The post pass. */ post: boolean; /** The most device pixels per CSS pixel to draw. */ pixelRatio: number };

/**
 * What this device draws. Eco mode keeps the tone curve and the materials, which cost nothing, and
 * drops what costs a frame: shadows, the post pass and any pixel ratio above 1.
 */
export function stationQuality(): Quality {
  const can = probe();
  // Dev and test hook: window.__stationLook = "full" draws everything even on a software renderer, so a test can build every shader.
  const forced = !!(import.meta.env.DEV || import.meta.env.VITE_E2E) && (globalThis as { __stationLook?: string }).__stationLook === "full";
  const plain = getAmbient().eco || (can.software && !forced);
  return { shadows: !plain, post: !plain && can.post, pixelRatio: plain ? 1 : 2 };
}

let probed: { post: boolean; software: boolean } | null = null;
/**
 * Asked once, on a scrap canvas: whether this browser can make the post pass's target (a multisampled
 * buffer that holds more than white), and whether it draws on the CPU (no graphics chip, or a blocked
 * driver), where shadows and a post pass cost whole frames.
 */
function probe(): { post: boolean; software: boolean } {
  if (probed) return probed;
  probed = { post: false, software: false };
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (gl) {
      probed.post = !!(gl.getExtension("EXT_color_buffer_float") || gl.getExtension("EXT_color_buffer_half_float")) && (gl.getParameter(gl.MAX_SAMPLES) as number) >= 4;
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      probed.software = /swiftshader|llvmpipe|softpipe|software/i.test(String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)));
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch { /* no WebGL 2: the plain look */ }
  return probed;
}

/**
 * Watches the gaps between frames and says, once, when the device is not keeping up: after the first
 * frames (which build shaders), a run of `GOVERNOR.frames` frames averaging under 20 a second. The scene
 * then drops its shadows and post pass for the rest of the visit. Gaps of half a second or more are a
 * hidden tab or a stall, not the device's pace, and are skipped.
 */
const GOVERNOR = { skip: 30, frames: 45, slowMs: 50, stallMs: 500 };
export function slowFrames(): (now: number) => boolean {
  let last = 0, seen = 0, sum = 0, n = 0, done = false;
  return (now) => {
    const gap = now - last;
    last = now;
    if (done || ++seen <= GOVERNOR.skip || gap <= 0 || gap >= GOVERNOR.stallMs) return false;
    sum += gap;
    if (++n < GOVERNOR.frames) return false;
    done = sum / n > GOVERNOR.slowMs;
    sum = n = 0;
    return done;
  };
}

/** The tone curve, and shadows when asked for. */
export function dressRenderer(renderer: THREE.WebGLRenderer, q: Quality) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = LOOK.exposure;
  renderer.shadowMap.enabled = q.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
}

type SlabShadow = THREE.DirectionalLightShadow & {
  _frustum?: THREE.Frustum;
  _updateMatrix?: (camera: THREE.Camera, matrix: THREE.Matrix4, frustum: THREE.Frustum) => void;
};

type StationLights = {
  lights: THREE.Object3D[];
  /** Centre the shadows on the viewer's feet (world coordinates). Call each frame. */
  aim: (x: number, y: number, z: number) => void;
  /** Stop casting shadows, for a device that is not keeping up. */
  plain: () => void;
  dispose: () => void;
};

/**
 * The station's lights. `up` is the scene's up axis ("z" for the model's own frame, "y" for the walk).
 *
 * Below the street every room has a ceiling and often another floor over it, so a plain shadow map
 * from a light above would see only the top slab and leave every room dark. The shadow camera here
 * looks straight down from just under the viewer's own ceiling, so nothing above that casts, and its
 * projection is sheared along the light's direction, so shadows still fall at the key light's angle.
 * Floors and ceilings never cast (the caller leaves `castShadow` off them): each level has its own lamps.
 */
export function stationLights(up: "y" | "z", q: Quality): StationLights {
  const fill = new THREE.HemisphereLight(LOOK.fill.sky, LOOK.fill.ground, LOOK.fill.intensity);
  // A hemisphere light's "up" is its position's direction.
  fill.position.set(0, up === "y" ? 1 : 0, up === "z" ? 1 : 0);
  const key = new THREE.DirectionalLight(LOOK.key.color, LOOK.key.intensity);
  const [tx, ty, tz] = LOOK.key.toward;
  const toward = (up === "z" ? new THREE.Vector3(tx, ty, tz) : new THREE.Vector3(tx, tz, -ty)).normalize();
  const upV = up === "z" ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  const focus = new THREE.Vector3();
  let top = 0;
  key.position.copy(toward).multiplyScalar(40);
  const S = LOOK.shadow;
  if (q.shadows) {
    const size = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches ? S.sizeTouch : S.size;
    key.castShadow = true;
    key.shadow.mapSize.set(size, size);
    key.shadow.bias = S.bias;
    key.shadow.normalBias = S.normalBias;
    key.shadow.radius = S.radius;
    const cam = key.shadow.camera;
    cam.left = cam.bottom = -S.half;
    cam.right = cam.top = S.half;
    cam.near = 0;
    cam.far = S.depth;
    const shadow = key.shadow as SlabShadow;
    const shear = new THREE.Matrix4(), dirV = new THREE.Vector3(), look = new THREE.Vector3();
    if (shadow._updateMatrix && shadow._frustum) {
      shadow.updateMatrices = () => {
        // Straight down from the slab's top over the viewer, so the plane that cuts off the level above is level.
        cam.position.copy(focus).addScaledVector(upV, top - focus.dot(upV));
        cam.up.set(0, up === "z" ? 1 : 0, up === "z" ? 0 : -1);
        cam.lookAt(look.copy(cam.position).sub(upV));
        cam.updateMatrixWorld();
        cam.updateProjectionMatrix();
        // Sheared so each point is looked up along the light's own direction, not straight down.
        dirV.copy(toward).transformDirection(cam.matrixWorldInverse);
        shear.set(1, 0, -dirV.x / dirV.z, 0, 0, 1, -dirV.y / dirV.z, 0, 0, 0, 1, 0, 0, 0, 0, 1);
        cam.projectionMatrix.multiply(shear);
        cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
        shadow._updateMatrix!(cam, shadow.matrix, shadow._frustum!);
      };
    }
  }
  const aim = (x: number, y: number, z: number) => {
    // In whole texels and quarter metres, so shadow edges do not crawl as the viewer moves.
    const texel = (2 * S.half) / key.shadow.mapSize.x;
    const snap = (v: number, step: number) => Math.round(v / step) * step;
    focus.set(x, y, z);
    const h = focus.dot(upV);
    focus.addScaledVector(upV, -h);
    if (up === "z") focus.set(snap(focus.x, texel), snap(focus.y, texel), 0);
    else focus.set(snap(focus.x, texel), 0, snap(focus.z, texel));
    top = snap(h, 0.25) + S.top;
    key.target.position.copy(focus).addScaledVector(upV, h);
    key.position.copy(key.target.position).addScaledVector(toward, 40);
    key.target.updateMatrixWorld();
  };
  return { lights: [fill, key, key.target], aim, plain: () => { key.castShadow = false; key.shadow.map?.dispose(); key.shadow.map = null; }, dispose: () => { key.shadow.map?.dispose(); key.dispose(); fill.dispose(); } };
}

type Finish = { roughness?: number; metalness?: number };

/**
 * Swap every Lambert material under `root` for a standard one that keeps its colour, texture and
 * flags. The station's furniture is built by helpers the map's dollhouse shares, which must keep
 * their Lambert look on the map's canvas, so the swap happens here, on the copy a station scene owns.
 */
export function toStandard(root: THREE.Object3D, finish: (old: THREE.MeshLambertMaterial) => Finish = () => ({})) {
  const made = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const old = mesh.material as THREE.MeshLambertMaterial | undefined;
    if (!mesh.isMesh || !old || Array.isArray(old) || !old.isMeshLambertMaterial) return;
    let next = made.get(old);
    if (!next) {
      next = new THREE.MeshStandardMaterial({
        color: old.color, map: old.map, side: old.side, transparent: old.transparent, opacity: old.opacity, vertexColors: old.vertexColors,
        polygonOffset: old.polygonOffset, polygonOffsetFactor: old.polygonOffsetFactor, polygonOffsetUnits: old.polygonOffsetUnits,
        clippingPlanes: old.clippingPlanes, fog: old.fog, roughness: 0.85, metalness: 0, ...finish(old),
      });
      made.set(old, next);
      old.dispose();
    }
    mesh.material = next;
  });
}

/** Painted or brushed metal (a train's side, a turnstile): greys with little colour in them. */
export function metalFinish(old: THREE.MeshLambertMaterial): Finish {
  // As the colour was written (sRGB), not as it is stored.
  const hex = old.color.getHex();
  const [r, g, b] = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((v) => v / 255);
  const hi = Math.max(r, g, b), lo = Math.min(r, g, b);
  return hi - lo < 0.08 && hi > 0.12 && hi < 0.82 && !old.map ? { roughness: 0.42, metalness: 0.25 } : {};
}

/** Which meshes under `root` cast and receive shadows. Unlit meshes (signs, lamps) do neither unless they are solid enough to cast. */
export function shadowed(root: THREE.Object3D, cast: boolean, receive: boolean) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const lit = !(mesh.material as THREE.Material & { isMeshBasicMaterial?: boolean }).isMeshBasicMaterial;
    mesh.castShadow = cast;
    mesh.receiveShadow = receive && lit;
  });
}

/** Brighten every unlit face that carries a picture (a sign, the street at a stair's top), so it reads as lit from inside. */
export function glowSigns(root: THREE.Object3D) {
  root.traverse((o) => {
    const mat = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
    if (mat && !Array.isArray(mat) && mat.isMeshBasicMaterial && mat.map) mat.color.setScalar(LOOK.sign);
  });
}

/** A strip light on black, one per repeat: laid over a ceiling as its emissive map, it is what glows. */
export function lampTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(16, 29, 32, 5);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

/** A quarter-size copy of the picture holding only what is brighter than white: the lamps, lit signs, daylight at a stair's top. */
const BRIGHT = /* glsl */ `
uniform sampler2D tMap;
uniform vec2 uTexel;
uniform float uThreshold;
uniform float uKnee;
varying vec2 vUv;
void main() {
  // Four taps between pixels: each averages four, so sixteen pixels go into one.
  vec3 c = texture2D(tMap, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(tMap, vUv + uTexel * vec2(1.0, -1.0)).rgb
         + texture2D(tMap, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(tMap, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  c = min(c * 0.25, vec3(12.0));
  float peak = max(c.r, max(c.g, c.b));
  gl_FragColor = vec4(c * smoothstep(uThreshold, uThreshold + uKnee, peak), 1.0);
}`;

/** One direction of a soft blur: nine pixels' worth from five taps placed between pixels. */
const BLUR = /* glsl */ `
uniform sampler2D tMap;
uniform vec2 uStep;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tMap, vUv).rgb * 0.227027;
  c += (texture2D(tMap, vUv + uStep * 1.384615).rgb + texture2D(tMap, vUv - uStep * 1.384615).rgb) * 0.316216;
  c += (texture2D(tMap, vUv + uStep * 3.230769).rgb + texture2D(tMap, vUv - uStep * 3.230769).rgb) * 0.070270;
  gl_FragColor = vec4(c, 1.0);
}`;

/**
 * The finished picture: the scene plus its glow, through the renderer's tone curve, then a little
 * more contrast and colour, warm highlights against cool shadows, and darker corners.
 */
const FINISH = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform float uBloom;
uniform float uContrast;
uniform float uSaturation;
uniform vec3 uWarm;
uniform vec3 uCool;
uniform float uVignette;
uniform float uAspect;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tScene, vUv).rgb + texture2D(tBloom, vUv).rgb * uBloom;
  #ifdef TONE_MAPPING
    c = toneMapping(c);
  #endif
  c = clamp(c, 0.0, 1.0);
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c *= mix(uCool, uWarm, smoothstep(0.08, 0.7, luma));
  c = mix(vec3(luma), c, uSaturation);
  c = (c - 0.18) * uContrast + 0.18;
  vec2 d = (vUv - 0.5) * vec2(min(uAspect, 1.6), 1.0);
  c *= 1.0 - uVignette * smoothstep(0.38, 1.05, length(d) * 1.25);
  gl_FragColor = linearToOutputTexel(vec4(max(c, 0.0), 1.0));
}`;

export type StationPost = { render: (scene: THREE.Scene, camera: THREE.Camera) => void; dispose: () => void };

/**
 * The post pass, or null where it cannot run: it draws the scene into a multisampled half-float
 * target (so lamps can be brighter than white and edges stay smooth), which some browsers cannot make.
 * Call `render` in place of `renderer.render`.
 */
export function createStationPost(renderer: THREE.WebGLRenderer): StationPost | null {
  const floatTarget = renderer.extensions.has("EXT_color_buffer_float") || renderer.extensions.has("EXT_color_buffer_half_float");
  if (!floatTarget || renderer.capabilities.maxSamples < 4) return null;
  const hdr = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false } as const;
  const sceneRT = new THREE.WebGLRenderTarget(4, 4, { ...hdr, samples: 4, depthBuffer: true });
  const glow = [new THREE.WebGLRenderTarget(1, 1, { ...hdr, depthBuffer: false }), new THREE.WebGLRenderTarget(1, 1, { ...hdr, depthBuffer: false })];
  const pass = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>) =>
    new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader, uniforms, depthTest: false, depthWrite: false });
  const B = LOOK.bloom, G = LOOK.grade;
  const texel = new THREE.Vector2(), step = new THREE.Vector2();
  const blurMap: THREE.IUniform<THREE.Texture | null> = { value: null }, aspect = { value: 1 };
  const bright = pass(BRIGHT, { tMap: { value: sceneRT.texture }, uTexel: { value: texel }, uThreshold: { value: B.threshold }, uKnee: { value: B.knee } });
  const blur = pass(BLUR, { tMap: blurMap, uStep: { value: step } });
  const finish = pass(FINISH, {
    tScene: { value: sceneRT.texture }, tBloom: { value: glow[0].texture }, uBloom: { value: B.strength }, uContrast: { value: G.contrast }, uSaturation: { value: G.saturation },
    uWarm: { value: new THREE.Vector3(...G.warm) }, uCool: { value: new THREE.Vector3(...G.cool) }, uVignette: { value: G.vignette }, uAspect: aspect,
  });
  // One triangle that covers the screen.
  const tri = new THREE.BufferGeometry();
  tri.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const quad = new THREE.Mesh(tri, bright);
  quad.frustumCulled = false;
  const flat = new THREE.Scene();
  flat.add(quad);
  const still = new THREE.Camera();
  const size = new THREE.Vector2();
  let w = 0, h = 0;
  const draw = (material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) => {
    quad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(flat, still);
  };
  return {
    render(scene, camera) {
      renderer.getDrawingBufferSize(size);
      if (size.x !== w || size.y !== h) {
        [w, h] = [size.x, size.y];
        sceneRT.setSize(Math.max(w, 1), Math.max(h, 1));
        for (const g of glow) g.setSize(Math.max(w >> 2, 1), Math.max(h >> 2, 1));
        texel.set(1 / Math.max(w, 1), 1 / Math.max(h, 1));
        aspect.value = w / Math.max(h, 1);
      }
      renderer.setRenderTarget(sceneRT);
      renderer.render(scene, camera);
      draw(bright, glow[0]);
      // Twice across and down, the second time wider: a tight glow with a soft skirt.
      for (const reach of [1, 2.2]) {
        blurMap.value = glow[0].texture;
        step.set(reach / glow[0].width, 0);
        draw(blur, glow[1]);
        blurMap.value = glow[1].texture;
        step.set(0, reach / glow[0].height);
        draw(blur, glow[0]);
      }
      draw(finish, null);
    },
    dispose() {
      sceneRT.dispose();
      for (const g of glow) g.dispose();
      for (const m of [bright, blur, finish]) m.dispose();
      tri.dispose();
    },
  };
}
