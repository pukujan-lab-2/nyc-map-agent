import { writeFileSync } from "node:fs";
import { test } from "@playwright/test";
import { mockNetwork } from "./mocks";

const OUT = process.env.STILLS!;
type P = [number, number];
const VIEWS: Record<string, { c: P; z: number; pts: Record<string, P> }> = {
  city: { c: [-73.982, 40.748], z: 13.2, pts: {} },
  event: { c: [-73.9835, 40.7537], z: 16.4, pts: { park: [-73.9832, 40.7536] } },
  exit: { c: [-73.9866, 40.7489], z: 17.3, pts: {
    station: [-73.98795, 40.74972], portal: [-73.98768, 40.74962], corner5: [-73.98497, 40.74845], esb: [-73.98535, 40.74826], esbC: [-73.985656, 40.748433],
    w1: [-73.98768, 40.74962], w2: [-73.98497, 40.74845], w3: [-73.98535, 40.74826] } },
  trip: { c: [-73.9832, 40.7440], z: 13.95, pts: {
    you: [-73.9903, 40.7359], us: [-73.989951, 40.734673], s23: [-73.986599, 40.739864], s28: [-73.984264, 40.743070], s33: [-73.982076, 40.746081],
    gc4: [-73.976848, 40.751776], gc7: [-73.976041, 40.751431], av5: [-73.981963, 40.753821], park: [-73.9832, 40.7536] } },
  under: { c: [-73.98800, 40.74980], z: 19.2, pts: {
    you: [-73.98822, 40.75008], portal: [-73.98768, 40.74962], station: [-73.98795, 40.74972] } },
  wc: { c: [-73.9836, 40.7538], z: 17.6, pts: { you: [-73.9845, 40.7539], wc: [-73.9826, 40.7537], a: [-73.9845, 40.7539], b: [-73.98414, 40.75348], d: [-73.9826, 40.7537] } },
};

test.use({ viewport: { width: 1280, height: 720 }, headless: false, launchOptions: { args: [] } });
test.setTimeout(240_000);
test("stills", async ({ page }) => {
  await mockNetwork(page);
  await page.route("**/*", (r) => (new URL(r.request().url()).hostname === "localhost" ? r.fallback() : r.continue()));
  await page.goto("/");
  await page.waitForFunction(() => !!(globalThis as any).__map, null, { timeout: 60_000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.addStyleTag({ content: "body > *:not(#root), #root *:not(canvas):not(.maplibregl-map):not(.maplibregl-canvas-container) { visibility: hidden !important } .maplibregl-canvas-container, .maplibregl-canvas-container canvas, .maplibregl-map { visibility: visible !important }" });
  const proj: Record<string, Record<string, P>> = {};
  for (const [name, v] of Object.entries(VIEWS).filter(([n]) => !process.env.ONLY || process.env.ONLY.split(',').includes(n))) {
    await page.evaluate(({ c, z }) => { const m = (globalThis as any).__map; m.jumpTo({ center: c, zoom: z, pitch: 0, bearing: 0 }); }, v);
    await page.evaluate(() => new Promise<void>((res) => { const m = (globalThis as any).__map; const done = () => res(); if (m.areTilesLoaded()) setTimeout(done, 300); m.once("idle", done); setTimeout(done, 15000); }));
    await page.waitForTimeout(1500);
    proj[name] = await page.evaluate((pts) => { const m = (globalThis as any).__map; return Object.fromEntries(Object.entries(pts).map(([k, p]) => { const q = m.project(p); return [k, [Math.round(q.x * 10) / 10, Math.round(q.y * 10) / 10]]; })); }, v.pts);
    await page.screenshot({ path: `${OUT}/${name}.png` });
  }
  writeFileSync(`${OUT}/points-${process.env.ONLY ?? 'all'}.json`, JSON.stringify(proj, null, 1));
});
