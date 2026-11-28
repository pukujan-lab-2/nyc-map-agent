import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { expectLayout, SIZES } from "./layout";
import { mockNetwork } from "./mocks";
import { slow } from "./slow";

// The live feed with no trains running and real MTA notices from 2026-11-07 and 2026-11-08 added:
// the uptown A skipping seven stops, and the 1 replaced by a shuttle bus with the MTA's corners.
const LIVE = JSON.parse(readFileSync(new URL("./fixtures/transit-live-2-line.json", import.meta.url), "utf8")) as { at: number; systems: { subway: { at: number } }; alerts: { at: number; alerts: unknown[] } };
const NOTICES = JSON.parse(readFileSync(new URL("../src/features/transit/alertDiagram.fixtures.json", import.meta.url), "utf8")) as Record<string, { routes: string[] }>;

async function openNotice(page: Page, line: string, notice: string, title: RegExp) {
  const now = Math.floor(Date.now() / 1000);
  const body = structuredClone(LIVE);
  body.at = body.systems.subway.at = body.alerts.at = now;
  body.alerts.alerts = [{ ...NOTICES[notice], start: now - 3600, end: now + 6 * 3600 }];
  await mockNetwork(page);
  await page.route("**/api/transit-live*", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify(body) }));
  await page.route("**/api/transit", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ bus: false }) }));
  await page.goto("/");
  await page.getByRole("button", { name: "My train" }).click({ timeout: slow(15_000) });
  await page.locator(`[data-line="${line}"] button`).first().click({ timeout: slow(15_000) });
  const sheet = page.getByTestId("line-panel");
  await expect(sheet).toBeVisible();
  const card = sheet.locator("[data-notice]", { hasText: title }).first();
  await card.scrollIntoViewIfNeeded();
  await card.click();
  await expect(sheet.getByTestId("notice-walk")).toBeVisible({ timeout: slow(10_000) });
}

/** What the notice layers drew, read from the map's own sources. */
const drawn = (page: Page, source: string) => page.evaluate(async (id) => {
  const m = (window as unknown as { __map: { getSource(id: string): { getData(): Promise<{ features?: Array<{ properties: Record<string, unknown> }> }> } | undefined } }).__map;
  const data = await m.getSource(id)?.getData();
  return (data?.features ?? []).map((f) => f.properties);
}, source);

test("an open skip notice draws two tracks, crosses out the skipped side and signs each track", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openNotice(page, "A", "aSkip", /72 St|skips/i);
  await expect.poll(async () => (await drawn(page, "notice-tracks")).length, { timeout: slow(10_000) }).toBe(2);
  const signs = (await drawn(page, "notice-signposts")).map((p) => String(p.text));
  expect(signs.some((t) => /Uptown side$/.test(t))).toBe(true);
  expect(signs.some((t) => /Downtown side$/.test(t))).toBe(true);
  const skipped = (await drawn(page, "notice-track-stops")).filter((p) => p.state === "skip").map((p) => p.id);
  expect(skipped.sort()).toEqual(["A16", "A17", "A18", "A19", "A20", "A21", "A22"]); // 116 St to 72 St
  const train = await drawn(page, "notice-train");
  expect(train.map((p) => p.tag)).toEqual(["to Uptown"]);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: test.info().outputPath("skip.png") });
});

for (const size of SIZES) {
  test(`an open notice keeps the layout bar at ${size.name} ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await openNotice(page, "A", "aSkip", /72 St|skips/i);
    await expect.poll(async () => (await drawn(page, "notice-tracks")).length, { timeout: slow(10_000) }).toBe(2);
    await page.waitForTimeout(1200); // the camera's fly to the step
    // The skipped stretch (86 St, in its middle) stays on the open map, clear of the line sheet.
    await expectLayout(page, { focus: [-73.96892, 40.78587] });
  });
}
