import { expect, test, type Page } from "@playwright/test";
import { expectLayout, SIZES } from "./layout";

const SPLAT_FRAME = 'iframe[title="Interactive Queensboro Plaza Gaussian splat"]';

test.beforeEach(async ({ page }) => {
  await page.route("**/api/presenter/status", (route) => route.fulfill({ json: { haiku: false, octo: false, dictate: true } }));
  await page.emulateMedia({ reducedMotion: "reduce" });
});

/** The moves the viewer accepted, read inside the splat iframe. */
function cameraMoves(page: Page): Promise<string[]> {
  const frame = page.frame({ url: /splat\/index\.html/ });
  if (!frame) return Promise.resolve([]);
  return frame.evaluate(() => (window as unknown as { __presenterCameraMoves?: string[] }).__presenterCameraMoves ?? []);
}

async function openSplat(page: Page) {
  const ask = page.getByRole("textbox", { name: "Ask Design Baker" });
  await ask.fill("Show me the splat");
  await ask.press("Enter");
  await expect(page.locator("#presenter")).toHaveAttribute("data-scene", "7");
  await expect(page.locator(SPLAT_FRAME)).toBeVisible();
}

for (const size of SIZES) {
  test(`the splat scene fits the ${size.name}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/present");
    await openSplat(page);
    await expectLayout(page);
  });
}

test("Moon drives the splat camera: overview first, then a slow orbit", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/present");
  await openSplat(page);
  await expect.poll(() => cameraMoves(page), { timeout: 15_000 }).toEqual(["overview", "orbit"]);
});

test("an interrupting question cancels the pending orbit", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/present");
  await openSplat(page);
  await expect.poll(() => cameraMoves(page), { timeout: 15_000 }).toContain("overview");
  // Record what the presenter posts to this iframe, so a late orbit would still be seen
  // after the question moves the page to another scene and the iframe is gone.
  await page.evaluate((selector) => {
    const frame = document.querySelector<HTMLIFrameElement>(selector);
    const target = frame?.contentWindow;
    if (!target) return;
    const log: string[] = [];
    (window as unknown as { __splatPosts: string[] }).__splatPosts = log;
    const original = target.postMessage.bind(target) as unknown as (...args: unknown[]) => void;
    target.postMessage = ((message: { type?: string; move?: string }, ...rest: unknown[]) => {
      if (message && message.type === "presenter-camera" && typeof message.move === "string") log.push(message.move);
      original(message, ...rest);
    }) as unknown as typeof target.postMessage;
  }, SPLAT_FRAME);
  const ask = page.getByRole("textbox", { name: "Ask Design Baker" });
  await ask.fill("Show the pressure readings");
  await ask.press("Enter");
  await expect(page.locator("#presenter")).toHaveAttribute("data-mode", "data");
  // The orbit was due 2.5 s after the overview; give it time to arrive if the guard failed.
  // The spy went in after overview was posted, so a working guard leaves it empty; a late
  // orbit would appear here as ["orbit"] even though the iframe is already gone.
  await page.waitForTimeout(3000);
  expect(await page.evaluate(() => (window as unknown as { __splatPosts?: string[] }).__splatPosts ?? [])).toEqual([]);
});

test("the orbit visibly moves the rendered camera", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/present");
  await openSplat(page);
  await expect.poll(() => cameraMoves(page), { timeout: 20_000 }).toEqual(["overview", "orbit"]);
  // The overview tweens 2.5 s; the orbit arrives 2.5 s later and tweens another 2.5 s before it turns.
  await page.waitForTimeout(6000);
  const frame = page.locator(SPLAT_FRAME);
  const first = await frame.screenshot();
  await page.waitForTimeout(1200);
  const second = await frame.screenshot();
  expect(first.equals(second), "two frames a second apart during the orbit should differ").toBe(false);
});