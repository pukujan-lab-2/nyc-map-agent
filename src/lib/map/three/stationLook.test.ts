import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { setAmbient } from "@/lib/ambient";
import { metalFinish, shadowed, stationLights, stationQuality, toStandard } from "./stationLook";

describe("stationQuality", () => {
  it("drops shadows, the post pass and extra pixels in eco mode", () => {
    setAmbient({ eco: true });
    expect(stationQuality()).toEqual({ shadows: false, post: false, pixelRatio: 1 });
    setAmbient({ eco: false });
    expect(stationQuality().shadows).toBe(true);
    expect(stationQuality().pixelRatio).toBe(2);
  });
});

describe("toStandard", () => {
  it("swaps Lambert for standard, keeps colour, texture and flags, and leaves unlit signs alone", () => {
    const map = new THREE.Texture();
    const lambert = new THREE.MeshLambertMaterial({ color: 0x336699, map, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
    const sign = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const geo = new THREE.BoxGeometry();
    const [a, b, c] = [new THREE.Mesh(geo, lambert), new THREE.Mesh(geo, lambert), new THREE.Mesh(geo, sign)];
    const root = new THREE.Group().add(a, b, c);
    toStandard(root);
    const next = a.material as unknown as THREE.MeshStandardMaterial;
    expect(next.isMeshStandardMaterial).toBe(true);
    expect(b.material).toBe(next); // shared before, shared after
    expect(next.color.getHex()).toBe(0x336699);
    expect(next.map).toBe(map);
    expect([next.side, next.transparent, next.opacity]).toEqual([THREE.DoubleSide, true, 0.5]);
    expect(c.material).toBe(sign);
  });

  it("gives plain greys a metal finish and leaves colours and textures dull", () => {
    const of = (color: number, map?: THREE.Texture) => metalFinish(new THREE.MeshLambertMaterial(map ? { color, map } : { color }));
    expect(of(0xb8bec6).metalness).toBeGreaterThan(0);
    expect(of(0xc2410c)).toEqual({});
    expect(of(0xb8bec6, new THREE.Texture())).toEqual({});
    expect(of(0xffffff)).toEqual({});
  });
});

describe("shadowed", () => {
  it("never has an unlit face take a shadow", () => {
    const geo = new THREE.BoxGeometry();
    const lit = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
    const sign = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
    shadowed(new THREE.Group().add(lit, sign), true, true);
    expect([lit.castShadow, lit.receiveShadow, sign.castShadow, sign.receiveShadow]).toEqual([true, true, true, false]);
  });
});

describe("stationLights", () => {
  const q = { shadows: true, post: false, pixelRatio: 2 };
  it("casts only from the slab under the viewer's ceiling, along the key light's direction", () => {
    for (const up of ["z", "y"] as const) {
      const { lights, aim } = stationLights(up, q);
      const key = lights.find((l) => (l as THREE.DirectionalLight).isDirectionalLight) as THREE.DirectionalLight;
      if (up === "z") aim(10, 20, -8);
      else aim(10, -8, -20);
      key.updateMatrixWorld();
      key.shadow.updateMatrices(key);
      const project = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyMatrix4(key.shadow.matrix);
      const point = (h: number, dx = 0) => (up === "z" ? project(10 + dx, 20, -8 + h) : project(10 + dx, -8 + h, -20));
      // The viewer's own floor is inside the map; a wall on the level above (5 m up) is cut off.
      expect(point(0).z).toBeGreaterThan(0);
      expect(point(0).z).toBeLessThan(1);
      expect(point(5).z).toBeLessThan(0);
      // A point 2 m up shadows the floor to one side of itself, not straight below: the light leans.
      expect(Math.abs(point(2).x - point(0).x)).toBeGreaterThan(0.005);
      const toward = key.position.clone().sub(key.target.position).normalize();
      const foot = up === "z" ? new THREE.Vector3(10, 20, -8) : new THREE.Vector3(10, -8, -20);
      const along = foot.clone().addScaledVector(toward, 2).applyMatrix4(key.shadow.matrix);
      expect(along.x).toBeCloseTo(point(0).x, 4);
      expect(along.y).toBeCloseTo(point(0).y, 4);
    }
  });

  it("casts nothing when shadows are off", () => {
    const key = stationLights("z", { ...q, shadows: false }).lights.find((l) => (l as THREE.DirectionalLight).isDirectionalLight) as THREE.DirectionalLight;
    expect(key.castShadow).toBe(false);
  });
});
