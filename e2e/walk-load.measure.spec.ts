import { expect, test } from "@playwright/test";
import { mockNetwork } from "./mocks";

/**
 * Times Street view → the walk inside Fulton St (#126) on a throttled phone: about 10 Mbit/s with
 * 40 ms latency and a 4x slower CPU. From the tap on "Walk inside Fulton St" to the first frame
 * with the walker in it (performance.mark("walk-ready")), and the longest the page froze meanwhile.
 * Not part of the suite; run it with MEASURE_WALK=1 (MEASURE_DWELL_MS: how long to stand at the
 * stair before tapping, default 0).
 */
const BROADWAY_DEY: [number, number] = [-74.00927, 40.71046];
test.use({ serviceWorkers: "block" });

test("time from Walk inside to the walker on screen", async ({ page, context }) => {
  test.skip(!process.env.MEASURE_WALK, "set MEASURE_WALK=1 to time the walk's load");
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await mockNetwork(page);
  await page.goto("/?flags=-agentHome");
  await expect(page.locator("canvas.maplibregl-canvas").first()).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("view-switcher").getByRole("button", { name: "Street", exact: true }).click();
  await expect(page.getByTestId("walk-bar")).toBeVisible({ timeout: 30_000 });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 40, downloadThroughput: 10e6 / 8, uploadThroughput: 5e6 / 8 });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const entry = page.getByTestId("street-walk-inside");
  await expect(async () => {
    await page.evaluate((c) => (window as unknown as { __map: { jumpTo(o: object): void } }).__map.jumpTo({ center: c }), BROADWAY_DEY);
    await expect(entry).toBeVisible({ timeout: 4_000 });
  }).toPass({ timeout: 60_000 });
  await page.waitForTimeout(Number(process.env.MEASURE_DWELL_MS ?? 0));
  await page.evaluate(() => {
    const w = window as unknown as { __longest: number };
    w.__longest = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) w.__longest = Math.max(w.__longest, e.duration); }).observe({ type: "longtask" });
    document.querySelector('[data-testid="street-walk-inside"]')?.addEventListener("click", () => performance.mark("walk-tap"), { capture: true });
  });
  await entry.click();
  await page.waitForFunction(() => performance.getEntriesByName("walk-ready").length > 0, null, { timeout: 280_000 });
  const r = await page.evaluate(() => ({
    tapToWalkMs: Math.round(performance.getEntriesByName("walk-ready")[0].startTime - performance.getEntriesByName("walk-tap")[0].startTime),
    longestFreezeMs: Math.round((window as unknown as { __longest: number }).__longest),
  }));
  console.log(`WALK_LOAD ${JSON.stringify({ dwellMs: Number(process.env.MEASURE_DWELL_MS ?? 0), ...r })}`);
});
