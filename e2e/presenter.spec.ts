import { expect, test } from "@playwright/test";
import { expectLayout, SIZES } from "./layout";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/presenter/status", (route) => route.fulfill({ json: { haiku: false, octo: false, dictate: true } }));
  await page.emulateMedia({ reducedMotion: "reduce" });
});

for (const size of SIZES) {
  test(`the presenter fits the ${size.name}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/present");
    await expect(page.getByRole("heading", { name: "Your trip" })).toBeAttached();
    await expectLayout(page);
    await page.getByRole("button", { name: "Route" }).click();
    await expect(page.getByRole("button", { name: "Broadway entrance" })).toBeVisible();
    await expectLayout(page);
    await page.getByRole("button", { name: "Broadway entrance" }).click();
    await expect(page.getByRole("heading", { name: "Broadway entrance" })).toBeAttached();
    await expectLayout(page);
  });
}

// The "View this stop" choices sit under the stage, so a visitor switches view without the Route drawer.
for (const size of SIZES) {
  test(`the view choices sit on stage at the ${size.name}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/present");
    await page.getByRole("button", { name: "Route" }).click();
    await page.getByRole("button", { name: "Mezzanine", exact: true }).click();
    await expect(page.locator("#presenter")).toHaveAttribute("data-scene", /\d+/);
    const choices = page.locator("#presenter main #viewGroup");
    const walk = choices.getByRole("button", { name: "Original walk" });
    await expect(walk).toBeVisible();
    await expect(page.locator("#menu #viewGroup")).toHaveCount(0);
    await expectLayout(page);
    await walk.click();
    await expect(page.locator("#presenter")).toHaveAttribute("data-mode", "walk");
    await expect(choices.getByRole("button", { name: "Station frame" })).toBeVisible();
    await expectLayout(page);
  });
}

test("Moon uses the visible route controls and resumes from the original clip time", async ({ page }) => {
  await page.goto("/present");
  const ask = page.getByRole("textbox", { name: "Ask Design Baker" });
  await expect(page.getByRole("button", { name: "Sound on" })).toBeVisible();
  await page.getByRole("button", { name: "Sound on" }).click();
  await page.evaluate(() => {
    const clicks: string[] = [];
    document.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      const clicked = event.target.closest("#places, summary, button[data-index], button[data-mode]");
      if (clicked?.textContent) clicks.push(clicked.textContent.trim());
      document.querySelector("#presenter")?.setAttribute("data-test-clicks", clicks.join("|"));
    });
  });
  await ask.fill("Play the original walk at the mezzanine");
  await ask.press("Enter");
  const root = page.locator("#presenter");
  await expect(root).toHaveAttribute("data-mode", "walk");
  await expect(root).toHaveAttribute("data-test-clicks", "Route ▾|Mezzanine|Original walk");
  const clip = root.locator("video");
  await expect(clip).toBeVisible();
  await expect.poll(() => clip.evaluate((video: HTMLVideoElement) => video.readyState)).toBeGreaterThan(0);
  await clip.evaluate((video: HTMLVideoElement) => {
    video.pause();
    video.currentTime = 2;
  });
  await ask.fill("Show the pressure readings");
  await ask.press("Enter");
  await expect(root).toHaveAttribute("data-mode", "data");
  await expect(root).toHaveAttribute("data-test-clicks", "Route ▾|Mezzanine|Original walk|Route ▾|Explore the evidence|The phone feels a climb|The readings");
  await page.getByRole("button", { name: "Resume route" }).click();
  await expect(root).toHaveAttribute("data-mode", "walk");
  await expect.poll(() => clip.evaluate((video: HTMLVideoElement) => video.currentTime)).toBeCloseTo(2, 1);
});

// The closing invitation: a scannable QR and the visible link, on the last scene and at the walk's end.
for (const size of [{ name: "tall phone", width: 390, height: 844 }, { name: "desktop", width: 1280, height: 800 }]) {
  test(`the Build with us invitation fits the ${size.name}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/present");
    await page.getByRole("button", { name: "Route" }).click();
    await page.locator("#menu summary").filter({ hasText: "Explore the evidence" }).click();
    await page.getByRole("button", { name: "Build with us", exact: true }).click();
    await expect(page.locator('img[src="/presenter-media/evidence/qr-present.svg"]')).toBeVisible();
    await expect(page.getByRole("link", { name: "nyc.design-bakery.com/present" })).toBeVisible();
    await expectLayout(page);
  });
}

test("a contribute question is answered from the prepared bank without live services", async ({ page }) => {
  const liveAsks: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/presenter/ask")) liveAsks.push(request.url());
  });
  await page.goto("/present");
  const root = page.locator("#presenter");
  await expect(root).toHaveAttribute("data-answer-mode", "prepared");
  const ask = page.getByRole("textbox", { name: "Ask Design Baker" });
  await ask.fill("How can I contribute a walk?");
  await ask.press("Enter");
  await expect(page.locator("#words")).toContainText("film a station walk");
  await expect(root).toHaveAttribute("data-scene", "10");
  expect(liveAsks).toEqual([]);
});

for (const size of SIZES) {
  test(`the walk ends with the invitation at the ${size.name}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/present");
    await page.getByRole("button", { name: "Route" }).click();
    await page.getByRole("button", { name: "Street", exact: true }).click();
    await expect(page.locator('img[src="/presenter-media/evidence/qr-present.svg"]')).toBeVisible();
    await expect(page.getByRole("link", { name: "nyc.design-bakery.com/present" })).toBeVisible();
    await expectLayout(page);
  });
}

test("the opening screen offers the tech story in one tap", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/present");
  await expect(page.getByRole("heading", { name: "Your trip" })).toBeAttached();
  const chips = page.locator(".tech-chips");
  await expect(chips.getByRole("button", { name: "3D map" })).toBeVisible();
  await expectLayout(page);
  await chips.getByRole("button", { name: "3D map" }).click();
  await expect(page.locator("#presenter")).toHaveAttribute("data-scene", "7");
  await expectLayout(page);
});

test("suggested questions submit like typed ones", async ({ page }) => {
  await page.goto("/present");
  const suggest = page.locator("#suggest");
  await expect(suggest.getByRole("button", { name: "How did Washington do this?" })).toBeVisible();
  await suggest.getByRole("button", { name: "How did Washington do this?" }).click();
  await expect(page.locator("#presenter")).toHaveAttribute("data-scene", "9");
  await expect(page.locator("#words")).toContainText("Waymap");
});
