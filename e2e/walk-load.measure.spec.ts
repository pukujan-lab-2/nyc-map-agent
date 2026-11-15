import { expect, test } from "@playwright/test";
import { mockNetwork } from "./mocks";

/**
 * Times Street view → the walk inside Fulton St (#126) on a throttled phone: about 10 Mbit/s with
 * 40 ms latency and a 4x slower CPU, its workers included. From the tap on "Walk inside Fulton St"
 * to the first frame with the walker in it (performance.mark("walk-ready")), and the longest the
 * page froze before and after the tap.
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
  // Every long task the page runs, from the start, so a freeze while prefetching counts too.
  await page.addInitScript(() => {
    const w = window as unknown as { __long: Array<[number, number]> };
    w.__long = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) w.__long.push([e.startTime, e.duration]); }).observe({ type: "longtask", buffered: true });
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 40, downloadThroughput: 10e6 / 8, uploadThroughput: 5e6 / 8 });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  // The page's CPU throttle does not reach its workers: slow each one as it starts, the same 4x.
  await cdp.send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: false, flatten: false });
  cdp.on("Target.attachedToTarget", (e: { sessionId: string; targetInfo: { type: string } }) => {
    if (e.targetInfo.type !== "worker") return;
    const message = JSON.stringify({ id: 1, method: "Emulation.setCPUThrottlingRate", params: { rate: 4 } });
    void cdp.send("Target.sendMessageToTarget", { sessionId: e.sessionId, message }).catch(() => undefined);
  });
  const sizes = new Map<string, number>();
  cdp.on("Network.loadingFinished", (e: { requestId: string; encodedDataLength: number }) => { sizes.set(e.requestId, e.encodedDataLength); });
  const urls = new Map<string, string>();
  cdp.on("Network.requestWillBeSent", (e: { requestId: string; request: { url: string } }) => { urls.set(e.requestId, e.request.url); });

  await page.goto("/?flags=-agentHome");
  await expect(page.locator("canvas.maplibregl-canvas").first()).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("view-switcher").getByRole("button", { name: "Street", exact: true }).click();
  await expect(page.getByTestId("walk-bar")).toBeVisible({ timeout: 60_000 });
  const entry = page.getByTestId("street-walk-inside");
  await expect(async () => {
    await page.evaluate((c) => (window as unknown as { __map: { jumpTo(o: object): void } }).__map.jumpTo({ center: c }), BROADWAY_DEY);
    await expect(entry).toBeVisible({ timeout: 4_000 });
  }).toPass({ timeout: 60_000 });
  await page.waitForTimeout(Number(process.env.MEASURE_DWELL_MS ?? 0));
  await page.evaluate(() => {
    document.querySelector('[data-testid="street-walk-inside"]')?.addEventListener("click", () => performance.mark("walk-tap"), { capture: true });
  });
  await entry.click();
  await page.waitForFunction(() => performance.getEntriesByName("walk-ready").length > 0, null, { timeout: 280_000 });
  const r = await page.evaluate(() => {
    const at = (n: string) => performance.getEntriesByName(n)[0]?.startTime;
    const tap = at("walk-tap"), pre = at("walk-prefetch");
    const long = (window as unknown as { __long: Array<[number, number]> }).__long;
    const longest = (from: number, to: number) => Math.round(Math.max(0, ...long.filter(([s]) => s >= from && s < to).map(([, d]) => d)));
    const marks = Object.fromEntries(performance.getEntriesByType("mark").filter((m) => m.name.startsWith("walk-"))
      .map((m) => [m.name, Math.round(m.startTime - tap)]));
    const built = performance.getEntriesByName("walk-station-built")[0] as PerformanceMark | undefined;
    return {
      tapToWalkMs: Math.round(at("walk-ready") - tap),
      prefetchBeforeTapMs: pre === undefined ? null : Math.round(tap - pre),
      longestFreezeBeforeTapMs: longest(pre ?? tap, tap),
      longestFreezeAfterTapMs: longest(tap, at("walk-ready")),
      workerMs: (built?.detail as { workerMs?: number } | undefined)?.workerMs ?? null,
      marksFromTapMs: marks,
    };
  });
  const scene = [...urls].filter(([, u]) => /StationWalkScene-.*\.js$/.test(u)).map(([id]) => sizes.get(id) ?? 0)[0] ?? null;
  console.log(`WALK_LOAD ${JSON.stringify({ dwellMs: Number(process.env.MEASURE_DWELL_MS ?? 0), sceneChunkBytesOnWire: scene, ...r })}`);
});
