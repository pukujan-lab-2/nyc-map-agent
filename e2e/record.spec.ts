import { expect, test, type Page } from "@playwright/test";
import { expectLayout, SIZES } from "./layout";
import { mockNetwork } from "./mocks";
import { slow } from "./slow";

/**
 * The recorder page at /record (#185). The test browser has no camera, so a
 * fake one is put in before the page loads: a canvas whose colour changes
 * every frame, handed out as the camera's stream. Like a laptop, the browser
 * sends no motion, so the page records video and marks and says that motion
 * needs a phone.
 */
const fakeCamera = (page: Page) =>
  page.addInitScript(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const g = canvas.getContext("2d")!;
    let n = 0;
    setInterval(() => {
      g.fillStyle = `hsl(${(n++ * 7) % 360} 60% 50%)`;
      g.fillRect(0, 0, 320, 240);
    }, 50);
    const md = navigator.mediaDevices ?? ({} as MediaDevices);
    md.getUserMedia = () => Promise.resolve(canvas.captureStream(20));
    if (!navigator.mediaDevices) Object.defineProperty(navigator, "mediaDevices", { value: md });
  });

const open = async (page: Page, size: { width: number; height: number }) => {
  await page.setViewportSize({ width: size.width, height: size.height });
  await mockNetwork(page);
  await fakeCamera(page);
  await page.goto("/record");
  await expect(page.getByTestId("record-page")).toBeVisible({ timeout: slow(15_000) });
  await expect.poll(() => page.getByTestId("record-preview").evaluate((v: HTMLVideoElement) => v.videoWidth), { timeout: slow(10_000) }).toBeGreaterThan(0);
};

for (const size of SIZES) {
  test(`the recorder keeps the layout at ${size.name} ${size.width}×${size.height}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await open(page, size);
    await expect(page.getByRole("button", { name: "Record" })).toBeVisible();
    await expect(page.locator("#shell-bar")).toHaveCount(0);
    await expectLayout(page);
    expect(errors).toEqual([]);
  });
}
