import { expect, test, type Page, type Route } from "@playwright/test";
import { expectLayout, SIZES } from "./layout";
import { mockNetwork } from "./mocks";

/**
 * The hands-free live call pilot (?flags=+liveCall, #299). No LiveKit server is reachable here, so the call never gets past
 * "Connecting…": the token request is held to check that screen, then refused to check the fallback to one question at a time.
 * The microphone is a silent stream and the voices are the silent stubs from mocks.ts.
 */
async function setUp(page: Page): Promise<{ release: (status: number) => Promise<void> }> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    // Our own speech-to-text, the path phones take, for the fallback turn.
    Object.defineProperty(navigator, "brave", { value: {} });
    navigator.mediaDevices.getUserMedia = () => Promise.resolve(new AudioContext().createMediaStreamDestination().stream);
  });
  await mockNetwork(page);
  let held: Route | null = null;
  let arrived: () => void = () => {};
  const asked = new Promise<void>((r) => { arrived = r; });
  await page.route("**/api/voice/token", (route) => { held = route; arrived(); });
  return {
    release: async (status) => {
      await asked;
      await held?.fulfill({ status, json: { error: "voice_call_unavailable" } }).catch(() => undefined);
    },
  };
}

for (const size of SIZES) {
  test(`hands-free opens a live call with Mute and End call, and falls back to one question at a time at ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    const token = await setUp(page);
    await page.goto("/?flags=+liveCall");
    await page.getByRole("button", { name: "Hands-free conversation" }).click();
    const call = page.getByTestId("live-call");
    await expect(call.getByRole("status")).toHaveText("Connecting…");
    await expect(call.getByRole("button", { name: "Mute" })).toBeDisabled();
    await expect(call.getByRole("button", { name: "End call" })).toBeVisible();
    await expectLayout(page);

    await token.release(503);
    await expect(page.getByTestId("agent-notice")).toHaveText("The live call didn't connect, so hands-free is taking one question at a time.");
    await expect(call).toBeHidden();
    await expect(page.getByTestId("voice-listening")).toBeVisible();
    await expectLayout(page);
  });
}

test("End call while connecting leaves no call and no fallback line", async ({ page }) => {
  const token = await setUp(page);
  await page.goto("/?flags=+liveCall");
  await page.getByRole("button", { name: "Hands-free conversation" }).click();
  await page.getByTestId("live-call").getByRole("button", { name: "End call" }).click();
  await expect(page.getByTestId("live-call")).toBeHidden();
  await token.release(503);
  await expect(page.getByTestId("agent-notice")).toBeHidden();
  await expect(page.getByTestId("voice-listening")).toBeHidden();
});

test("without the flag, hands-free still takes one question and never asks for a call", async ({ page }) => {
  await setUp(page);
  let tokens = 0;
  await page.route("**/api/voice/token", (route) => { tokens += 1; return route.abort(); });
  await page.goto("/");
  await page.getByRole("button", { name: "Hands-free conversation" }).click();
  await expect(page.getByTestId("voice-listening")).toBeVisible();
  await expect(page.getByTestId("live-call")).toBeHidden();
  expect(tokens).toBe(0);
});
