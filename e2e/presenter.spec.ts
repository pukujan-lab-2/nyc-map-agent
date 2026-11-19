/**
 * The journey suite (docs/specs/PRESENTER_VALIDATION.md): properties of the tour
 * as a whole, generated from the spine — not isolated clicks. The machine owns
 * navigation; these tests prove the rendered page honours it at every size.
 */
import { expect, test, type Page } from "@playwright/test";
import { expectLayout, SIZES } from "./layout";
import { SPINE, ACT_NAMES } from "../src/features/presenter/spine";
import { resolveQuestion, type Resolution } from "../src/features/presenter/router";
import { readFileSync } from "node:fs";
const media = JSON.parse(readFileSync(new URL("../src/features/presenter/media.json", import.meta.url), "utf8")) as { bank: Array<{ question: string; scene: number; answer: string }> };

const BANK = media.bank as Array<{ question: string; scene: number; answer: string }>;
const root = (page: Page) => page.locator("#presenter");
const askBox = (page: Page) => page.getByRole("textbox", { name: "Ask Design Baker" });

test.beforeEach(async ({ page }) => {
  await page.route("**/api/presenter/status", (route) => route.fulfill({ json: { haiku: false, octo: false, dictate: true } }));
  await page.emulateMedia({ reducedMotion: "reduce" });
});

/** Open one chapter by deep link with a fresh machine (a unique query forces a
 * full load, so no detour from a previous iteration survives) and wait for the draw. */
let journeySeq = 0;
async function gotoChapter(page: Page, id: number) {
  journeySeq += 1;
  await page.goto(`/present?journey=${journeySeq}#chapter-${id + 1}`);
  await expect(root(page)).toHaveAttribute("data-scene", String(id + 1));
}

async function ask(page: Page, text: string) {
  await askBox(page).fill(text);
  await askBox(page).press("Enter");
}

/** Assert the rendered position matches one router resolution. */
async function expectResolution(page: Page, from: number, r: Resolution) {
  const el = root(page);
  switch (r.kind) {
    case "navigate":
      await expect(el).toHaveAttribute("data-scene", String(r.chapter + 1));
      if (r.view) await expect(el).toHaveAttribute("data-mode", r.view);
      break;
    case "view":
      await expect(el).toHaveAttribute("data-scene", String(from + 1));
      await expect(el).toHaveAttribute("data-mode", r.view);
      break;
    case "advance":
      await expect(el).toHaveAttribute("data-scene", String(from >= SPINE.length - 1 ? SPINE.length : from + 2));
      break;
    case "restart":
      await expect(el).toHaveAttribute("data-scene", "1");
      break;
    case "back":
      await expect(el).toHaveAttribute("data-scene", String(Math.max(0, from - 1) + 1));
      break;
    default:
      // explain, smalltalk, unknown and a resume with no detour stay in place.
      await expect(el).toHaveAttribute("data-scene", String(from + 1));
  }
}

// M1 — the whole story: advancing alone visits all eighteen chapters in order,
// with the progress, act name and next label the spine declares, at two sizes.
for (const size of [{ name: "tall phone", width: 390, height: 844 }, { name: "desktop", width: 1280, height: 800 }]) {
  test(`the whole story advances through all 18 chapters at the ${size.name}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/present");
    for (let i = 0; i < SPINE.length; i++) {
      const ch = SPINE[i];
      await expect(root(page)).toHaveAttribute("data-scene", String(i + 1));
      await expect(page.locator("#step")).toHaveText(`${i + 1} / ${SPINE.length} · ${ACT_NAMES[ch.act]}`);
      await expect(page.locator("#next")).toHaveText(ch.nextLabel);
      expect(await page.locator("#scene").evaluate((el) => el.children.length)).toBeGreaterThan(0);
      await expectLayout(page);
      await page.locator("#next").click();
    }
    // The 18th advance offers the restart; the 19th takes it. Never a silent loop.
    await expect(root(page)).toHaveAttribute("data-scene", String(SPINE.length));
    await expect(page.locator("#words")).toContainText("whole story");
    await expect(page.locator("#next")).toHaveText("Start again ↺");
    await page.locator("#next").click();
    await expect(root(page)).toHaveAttribute("data-scene", "1");
  });
}

// M3 — ask and return, one chapter per act: the exact chapter, view and clip
// second come back after a substantive detour.
const RETURN_CASES = [
  { chapter: 4, view: "walk", question: "What is the tech stack?", target: 16 },
  { chapter: 8, view: "default", question: "What did the AI actually do?", target: 17 },
  { chapter: 17, view: "default", question: "How does this become 3D?", target: 13 },
];
for (const c of RETURN_CASES) {
  test(`ask and return restores the exact state at chapter ${c.chapter + 1}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoChapter(page, c.chapter);
    if (c.view !== "default") {
      await page.locator(`.view-switch button[data-mode="${c.view}"]`).click();
      await expect(root(page)).toHaveAttribute("data-mode", c.view);
    }
    const clip = page.locator("#scene video");
    let paused = false;
    if (await clip.count()) {
      await expect.poll(() => clip.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThan(0);
      await clip.evaluate((v: HTMLVideoElement) => { v.pause(); v.currentTime = 2; });
      // Wait for the seek to settle, then let the seeked event reach the machine
      // (the pause event can report the pre-seek position; CI load delays events).
      await expect.poll(() => clip.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 10_000 }).toBeCloseTo(2, 1);
      await page.waitForTimeout(1200);
      paused = true;
    }
    await ask(page, c.question);
    await expect(root(page)).toHaveAttribute("data-scene", String(c.target));
    await expect(page.locator("#next")).toHaveText("Resume route ↺");
    await page.locator("#next").click();
    await expect(root(page)).toHaveAttribute("data-scene", String(c.chapter + 1));
    await expect(root(page)).toHaveAttribute("data-mode", c.view);
    if (paused) {
      await expect.poll(() => clip.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeCloseTo(2, 1);
      expect(await clip.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
    }
  });
}

// M6 — every opening chip lands on its declared chapter, and the layout holds.
test("every opening tech chip jumps to its chapter", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/present");
  await expect(root(page)).toHaveAttribute("data-scene", "1");
  const chips = page.locator(".tech-chips button");
  await expect(chips.first()).toBeVisible();
  const count = await chips.count();
  expect(count).toBeGreaterThanOrEqual(9);
  for (let i = 0; i < count; i++) {
    await gotoChapter(page, 0);
    const chip = chips.nth(i);
    const target = Number(await chip.getAttribute("data-jump"));
    expect(SPINE[target]).toBeTruthy();
    await chip.click();
    await expect(root(page)).toHaveAttribute("data-scene", String(target + 1));
    await expectLayout(page);
  }
});

// M6 — every suggestion of every chapter resolves through the router and renders.
for (const ch of SPINE) {
  test(`every suggestion resolves at chapter ${ch.id + 1} (${ch.title})`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    for (const text of ch.suggestions) {
      await gotoChapter(page, ch.id);
      const expected = resolveQuestion(text, ch.id, BANK, false);
      await page.locator("#suggest").getByRole("button", { name: text, exact: true }).click();
      await expectResolution(page, ch.id, expected);
    }
  });
}

// M11 — the menu cannot strand: every exit path closes it, because its
// visibility is the machine's menuOpen, not a click side effect.
test("the menu closes on question, jump, advance and escape", async ({ page }) => {
  await page.goto("/present");
  const menu = page.locator("#menu");
  await page.locator("#places").click();
  await expect(menu).toBeVisible();
  await ask(page, "What is the tech stack?");
  await expect(menu).toBeHidden();
  await expect(root(page)).toHaveAttribute("data-scene", "16");
  await page.locator("#places").click();
  await expect(menu).toBeVisible();
  await page.locator('#menu .item[data-index="2"]').click();
  await expect(menu).toBeHidden();
  await expect(root(page)).toHaveAttribute("data-scene", "3");
  await page.locator("#places").click();
  await expect(menu).toBeVisible();
  await page.locator("#next").click();
  await expect(menu).toBeHidden();
  await expect(root(page)).toHaveAttribute("data-scene", "4");
  await page.locator("#places").click();
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await page.locator("#places").click();
  await expect(menu).toBeVisible();
  await page.locator("header .brand").click();
  await expect(menu).toBeHidden();
});

// M3 — small talk never moves the tour, even with a paused clip.
test("small talk stays put at a walk stop with a paused clip", async ({ page }) => {
  await page.route("**/api/presenter/chat", (route) => route.fulfill({ json: { answer: "Hello there!" } }));
  await page.route("**/api/presenter/weather", (route) => route.fulfill({ json: { answer: "It is clear over Union Square.", sources: [{ title: "Open-Meteo" }] } }));
  await gotoChapter(page, 4);
  await page.locator('.view-switch button[data-mode="walk"]').click();
  const clip = page.locator("#scene video");
  await expect.poll(() => clip.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThan(0);
  await clip.evaluate((v: HTMLVideoElement) => { v.pause(); v.currentTime = 2; });
  await page.waitForTimeout(700);
  for (const text of ["hello", "Where are we presenting?", "What's the weather in Union Square?"]) {
    await ask(page, text);
    await expect(root(page)).toHaveAttribute("data-scene", "5");
    await expect(root(page)).toHaveAttribute("data-mode", "walk");
    await expect.poll(() => clip.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeCloseTo(2, 1);
  }
  await expect(page.locator("#words")).toContainText("Union Square");
});

// M6/D33 — an unknown question says so and offers tappable chapters.
test("an unknown question offers chapters that jump", async ({ page }) => {
  await page.goto("/present");
  await ask(page, "blorptastic zibble");
  await expect(page.locator("#words")).toContainText("can’t answer that one");
  const offers = page.locator("#offer button");
  await expect(offers).toHaveCount(4);
  for (const id of [8, 9, 12, 17]) {
    await expect(page.locator(`#offer button[data-jump="${id}"]`)).toHaveText(SPINE[id].title);
  }
  await page.locator('#offer button[data-jump="12"]').click();
  await expect(root(page)).toHaveAttribute("data-scene", "13");
  await expect(page.locator("#offer")).toBeHidden();
});

// M12 — a stop's direction is answered from the spine with zero network asks.
test("a stop direction is prepared, with no live ask", async ({ page }) => {
  const asks: string[] = [];
  page.on("request", (request) => { if (request.url().includes("/api/presenter/ask")) asks.push(request.url()); });
  await gotoChapter(page, 1);
  await ask(page, "What do I do here?");
  await expect(page.locator("#words")).toContainText("glass doors");
  await expect(root(page)).toHaveAttribute("data-scene", "2");
  expect(asks).toEqual([]);
});

// M9/D30 — a 429 surfaces the server's honest answer, not a silent fallback.
test("a rate-limited ask shows the server's give-me-a-moment answer", async ({ page }) => {
  await page.route("**/api/presenter/status", (route) => route.fulfill({ json: { haiku: true, octo: true, dictate: true } }));
  await page.route("**/api/presenter/ask", (route) => route.fulfill({ status: 429, json: { error: "rate_limited", answer: "Give me a moment — too many questions at once. Try again in a few seconds." } }));
  await page.goto("/present");
  await expect(root(page)).toHaveAttribute("data-answer-mode", "live");
  await ask(page, "tell me about the mission");
  await expect(page.locator("#words")).toContainText("Give me a moment");
  await expect(page.locator("#offer button")).toHaveCount(4);
  await expect(root(page)).toHaveAttribute("data-scene", "1");
});

// The prepared bank answers without live services, and lands on its chapter.
test("a contribute question is answered from the prepared bank without live services", async ({ page }) => {
  const asks: string[] = [];
  page.on("request", (request) => { if (request.url().includes("/api/presenter/ask")) asks.push(request.url()); });
  await page.goto("/present");
  await expect(root(page)).toHaveAttribute("data-answer-mode", "prepared");
  await ask(page, "How can I contribute a walk?");
  await expect(page.locator("#words")).toContainText("film a station walk");
  await expect(root(page)).toHaveAttribute("data-scene", "18");
  expect(asks).toEqual([]);
});

// M10 — deep links on mount and on hashchange, including the legacy stop form.
test("deep links work on mount and on hashchange", async ({ page }) => {
  await page.goto("/present#chapter-13");
  await expect(root(page)).toHaveAttribute("data-scene", "13");
  await page.evaluate(() => { location.hash = "#chapter-9"; });
  await expect(root(page)).toHaveAttribute("data-scene", "9");
  // Legacy #stop-n is 1-based over the old scene indices: stop 5 → old index 4 → chapter 10.
  await page.evaluate(() => { location.hash = "#stop-5"; });
  await expect(root(page)).toHaveAttribute("data-scene", "11");
});

// The closing invitation: a scannable QR and the visible link, on the last
// chapter and at the walk's end, at every size.
for (const size of SIZES) {
  test(`the Build with us invitation fits the ${size.name}`, async ({ page }) => {
    await page.setViewportSize(size);
    await gotoChapter(page, 17);
    await expect(page.locator('img[src="/presenter-media/evidence/qr-present.svg"]')).toBeVisible();
    await expect(page.getByRole("link", { name: "nyc.design-bakery.com/present" })).toBeVisible();
    await expectLayout(page);
  });
  test(`the walk ends with the invitation at the ${size.name}`, async ({ page }) => {
    await page.setViewportSize(size);
    await gotoChapter(page, 6);
    await expect(page.locator('img[src="/presenter-media/evidence/qr-present.svg"]')).toBeVisible();
    await expect(page.getByRole("link", { name: "nyc.design-bakery.com/present" })).toBeVisible();
    await expectLayout(page);
  });
}

// M7/M10 — the layout bar at every size for the opening, the open menu, a walk
// stop, an evidence chapter with its on-stage switcher, and the invitation.
for (const size of SIZES) {
  test(`the presenter fits the ${size.name}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/present");
    await expect(page.getByRole("heading", { name: "Your trip" })).toBeAttached();
    await expectLayout(page);
    await page.locator("#places").click();
    await expect(page.locator('#menu .item[data-index="1"]')).toBeVisible();
    await expectLayout(page);
    await page.locator('#menu .item[data-index="1"]').click();
    await expect(page.getByRole("heading", { name: "Broadway entrance" })).toBeAttached();
    await expectLayout(page);
    await gotoChapter(page, 11);
    await expect(page.locator(".view-switch")).toBeVisible();
    await expectLayout(page);
    await page.locator('.view-switch button[data-mode="data"]').click();
    await expectLayout(page);
    await gotoChapter(page, 17);
    await expectLayout(page);
  });
}