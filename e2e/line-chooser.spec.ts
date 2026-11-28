import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { expectLayout } from "./layout";
import { mockNetwork } from "./mocks";
import { slow } from "./slow";

// Myrtle Av on the J, M and Z: three lines share the track and the station.
const SUBWAY = JSON.parse(readFileSync(new URL("../public/transit/subway.json", import.meta.url), "utf8")) as {
  stations: { features: Array<{ properties: { id: string }; geometry: { coordinates: [number, number] } }> };
};
const MYRTLE = SUBWAY.stations.features.find((f) => f.properties.id === "M11")!.geometry.coordinates;

type TestMap = { jumpTo(o: object): void; isMoving(): boolean; getCenter(): { lng: number; lat: number }; getZoom(): number; project(p: [number, number]): { x: number; y: number }; queryRenderedFeatures(b: [[number, number], [number, number]], o: { layers: string[] }): Array<{ properties?: Record<string, unknown>; geometry: unknown }>; loaded(): boolean; areTilesLoaded(): boolean; getLayer(id: string): unknown; getContainer(): HTMLElement };

async function tapMyrtle(page: Page) {
  await mockNetwork(page);
  await page.route("**/api/transit", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ bus: false }) }));
  await page.goto("/");
  await page.waitForFunction(() => Boolean((window as unknown as { __map?: TestMap }).__map?.getLayer("transit-line")), null, { timeout: slow(20_000) });
  await page.evaluate((c) => (window as unknown as { __map: TestMap }).__map.jumpTo({ center: c, zoom: 13.5, bearing: 0, pitch: 0 }), MYRTLE);
  // Wait until the J and M are drawn around the station: tapping before they are lands on the dot instead.
  // (The Z runs at rush hour only, so a phone may not draw it.)
  // On a phone the app can still be settling its first view, so put the station back in the middle if it moved.
  // From 640 px the left card is a map cover, and the map eases its padding once the card is up: tap only once
  // the camera has stopped, or the spot moves out from under the tap on a slow machine.
  const settled = () => expect.poll(() => page.evaluate((c) => {
    const m = (window as unknown as { __map: TestMap }).__map;
    if (m.isMoving()) return "moving";
    const at = m.getCenter();
    if (Math.abs(at.lng - c[0]) > 0.002 || Math.abs(at.lat - c[1]) > 0.002 || Math.abs(m.getZoom() - 13.5) > 0.2) m.jumpTo({ center: c, zoom: 13.5, bearing: 0, pitch: 0 });
    const p = m.project(c);
    const routes = new Set(m.queryRenderedFeatures([[p.x - 30, p.y - 30], [p.x + 30, p.y + 30]], { layers: ["transit-line"] }).map((f) => String(f.properties?.route)));
    return ["J", "M"].filter((r) => routes.has(r)).join(" ") || `none at ${at.lng.toFixed(4)},${at.lat.toFixed(4)} z${m.getZoom().toFixed(1)}`;
  }, MYRTLE), { timeout: slow(15_000) }).toBe("J M");
  await settled();
  await page.waitForTimeout(500);
  await settled();
  // A tap on the white dot opens the station card as before; the chooser is for the shared track beside it,
  // so tap the J/M/Z line about 8 px from the dot.
  const at = await page.evaluate((c) => {
    const m = (window as unknown as { __map: TestMap }).__map;
    const p = m.project(c);
    const box = m.getContainer().getBoundingClientRect();
    const lines = m.queryRenderedFeatures([[p.x - 30, p.y - 30], [p.x + 30, p.y + 30]], { layers: ["transit-line"] })
      .filter((f) => ["J", "M", "Z"].includes(String(f.properties?.route)));
    // Skip spots where a station dot, label or entrance would take the tap.
    const taps = ["transit-station", "transit-station-label", "transit-entrance", "transit-bullet"].filter((id) => m.getLayer(id));
    const free = (x: number, y: number) => m.queryRenderedFeatures([[x - 1, y - 1], [x + 1, y + 1]], { layers: taps }).length === 0;
    let best = { x: p.x, y: p.y, miss: Infinity };
    for (const f of lines) {
      const g = f.geometry as { type: string; coordinates: unknown };
      const parts = (g.type === "MultiLineString" ? g.coordinates : [g.coordinates]) as [number, number][][];
      for (const part of parts) for (let i = 1; i < part.length; i++) {
        const a = m.project(part[i - 1]), b = m.project(part[i]);
        for (let t = 0; t <= 1; t += 0.02) {
          const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
          const miss = Math.abs(Math.hypot(x - p.x, y - p.y) - 8);
          if (miss < best.miss && free(x, y)) best = { x, y, miss };
        }
      }
    }
    return { x: box.left + best.x, y: box.top + best.y };
  }, MYRTLE);
  await page.mouse.click(at.x, at.y);
  return at;
}

test("a tap where the J, M and Z meet asks which line in the left card, and a bullet opens that line", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const at = await tapMyrtle(page);
  const chooser = page.getByTestId("line-chooser");
  await expect(chooser).toBeVisible();
  await expect(chooser.locator("[data-line]")).toHaveText(["J", "M", "Z"]);
  await expect(chooser.getByRole("button", { name: "Myrtle Av station" })).toBeVisible();
  // It is the top of the left card, above the ask box, not a bubble over the tapped spot.
  const b = (await chooser.boundingBox())!;
  const card = (await page.getByTestId("agent-card").boundingBox())!;
  expect(b.x).toBeGreaterThanOrEqual(card.x);
  expect(b.x + b.width).toBeLessThanOrEqual(card.x + card.width + 1);
  expect(b.x + b.width).toBeLessThan(at.x);
  await chooser.getByRole("button", { name: "M line" }).click();
  await expect(chooser).toBeHidden();
  await expect(page.getByTestId("line-panel")).toContainText("M");
});

test("on a phone the chooser docks above the chat bar, and the station opens its card", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await tapMyrtle(page);
  const chooser = page.getByTestId("line-chooser");
  await expect(chooser).toBeVisible();
  const b = (await chooser.boundingBox())!;
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(375);
  const chat = (await page.getByRole("textbox", { name: "Ask the assistant" }).boundingBox())!;
  expect(b.y + b.height).toBeLessThanOrEqual(chat.y);
  await chooser.getByRole("button", { name: "Myrtle Av station" }).click();
  await expect(chooser).toBeHidden();
  await expect(page.getByText("Myrtle Av").first()).toBeVisible();
});

test("the chooser closes once the map moves the tapped spot off screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await tapMyrtle(page);
  const chooser = page.getByTestId("line-chooser");
  await expect(chooser).toBeVisible();
  // A flight elsewhere (here, Midtown) must not leave Myrtle Av's lines on screen as if they were there.
  await page.evaluate(() => (window as unknown as { __map: TestMap }).__map.jumpTo({ center: [-73.9855, 40.758], zoom: 15 }));
  await expect(chooser).toBeHidden();
  await expectLayout(page);
});
