import { expect, test } from "@playwright/test";
import { expectLayout } from "./layout";
import { mockNetwork } from "./mocks";

/**
 * Wide screens (1024 px and up) get the menus as a column down the left edge, with the open
 * dropdown beside it (#637). Narrower screens keep the swipeable row.
 */
const ORDER = ["myDay", "layers", "filters", "data", "cityData", "settings"] as const;
const WIDE = [{ width: 1280, height: 800 }, { width: 1024, height: 768 }];

for (const size of WIDE) {
  test.describe(`left menu column at ${size.width}×${size.height}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(size);
      await mockNetwork(page);
      await page.goto("/");
      await expect(page.locator("canvas.maplibregl-canvas").first()).toBeVisible();
    });

    test("the six menus stand in one column at the left edge, in order, with their labels", async ({ page }) => {
      const rail = page.getByTestId("menu-rail");
      await expect(rail).toBeVisible();
      const boxes = [];
      for (const id of ORDER) {
        const b = await page.locator(`[data-testid="menu-rail"] [data-menu="${id}"]`).boundingBox();
        expect(b, id).not.toBeNull();
        boxes.push(b!);
      }
      for (let i = 1; i < boxes.length; i++) {
        expect(boxes[i].y).toBeGreaterThan(boxes[i - 1].y);
        expect(Math.abs(boxes[i].x - boxes[0].x)).toBeLessThan(1);
      }
      expect(boxes[0].x).toBeLessThan(24);
      await expect(page.getByTestId("menu-pill")).toHaveText("My day");
      await expect(page.getByTestId("menu-more")).toHaveCount(0);
      // The map sits beside the column, not under it.
      const area = (await page.getByTestId("map-area").boundingBox())!;
      const nav = (await rail.boundingBox())!;
      expect(area.x).toBeGreaterThanOrEqual(nav.x + nav.width);
      expect(Math.round(area.x + area.width)).toBe(size.width);
      await expectLayout(page);
    });

    test("a menu opens beside the column, one at a time, and the layout bar holds", async ({ page }) => {
      const rail = (await page.getByTestId("menu-rail").boundingBox())!;
      for (const id of ORDER) {
        await page.locator(`[data-testid="menu-rail"] [data-menu="${id}"]`).click();
        const dropdown = page.getByTestId("menu-dropdown");
        await expect(dropdown).toHaveCount(1);
        const box = (await dropdown.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(rail.x + rail.width);
        expect(box.y + box.height).toBeLessThanOrEqual(size.height);
        await expectLayout(page);
      }
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("menu-dropdown")).toHaveCount(0);
    });
  });
}

test("below 1024 px the menus stay a swipeable row, not a column", async ({ page }) => {
  await page.setViewportSize({ width: 1023, height: 800 });
  await mockNetwork(page);
  await page.goto("/");
  await expect(page.getByTestId("menu-row")).toBeVisible();
  await expect(page.getByTestId("menu-rail")).toHaveCount(0);
  await expect(page.getByTestId("menu-more")).toBeVisible();
});
