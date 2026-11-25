import { expect, test } from "@playwright/test";
import { expectLayout, SIZES } from "./layout";
import { mockNetwork } from "./mocks";

for (const size of SIZES) {
  test(`the map's hands-free button takes a question directly at ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => {
      class Recognition {
        onend?: () => void;
        onresult?: (e: unknown) => void;
        start() {
          Object.assign(window, { speakQuestion: () => {
            this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "Does the 7 stop at 74 Street Broadway?" } }] });
            this.onend?.();
          } });
        }
        abort() {}
      }
      Object.assign(window, { SpeechRecognition: Recognition });
    });
    await mockNetwork(page);
    const spoken: string[] = [];
    await page.route("**/api/tts", async (route) => {
      const body = route.request().postDataJSON() as { text: string };
      spoken.push(body.text);
      await route.fulfill({ contentType: "audio/L16", body: Buffer.alloc(4800), headers: { "x-sample-rate": "24000" } });
    });
    const asked: string[] = [];
    await page.route("**/api/agent", async (route) => {
      const body = route.request().postDataJSON() as { messages: Array<{ content: string }> };
      asked.push(body.messages.at(-1)?.content ?? "");
      await route.fulfill({
        contentType: "application/x-ndjson",
        body: JSON.stringify({ type: "text", text: "The local 7 stops there." }) + "\n" + JSON.stringify({ type: "done", model: "test" }) + "\n",
      });
    });
    await page.goto("/");
    const voice = page.getByRole("button", { name: "Hands-free conversation" });
    const status = page.getByTestId("voice-listening");
    await voice.click();
    await expect(status).toBeVisible();
    await expect.poll(() => page.evaluate(() => "speakQuestion" in window)).toBe(true);
    await expect(status.getByRole("status")).toHaveText("Listening");
    await expect(status.getByRole("button").locator("span span").first()).toHaveCSS("animation-name", "none");
    await expectLayout(page);
    await page.evaluate(() => (window as unknown as { speakQuestion: () => void }).speakQuestion());
    await expect(page.getByText("The local 7 stops there.")).toBeVisible();
    await expect.poll(() => spoken).toContain("The local 7 stops there.");
    expect(asked).toEqual(["Does the 7 stop at 74 Street Broadway?"]);
    await expect(voice).toHaveAttribute("aria-pressed", "false");
    await expect(status).toBeHidden();
  });
}

test("hands-free retries an empty automatic transcript with the app language", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "brave", { value: {} });
    // Pace quiet and speech frames by analyser reads so startup timing cannot hide the test turn.
    let frame = 0;
    AnalyserNode.prototype.getFloatTimeDomainData = (samples) => {
      frame += 1;
      samples.fill(frame > 3 && frame <= 9 ? 0.25 : 0);
    };
    navigator.mediaDevices.getUserMedia = async () => {
      const ctx = new AudioContext();
      await ctx.resume();
      const mic = ctx.createMediaStreamDestination();
      const signal = ctx.createOscillator();
      signal.connect(mic);
      signal.start();
      signal.stop(ctx.currentTime + 5);
      signal.onended = () => { void ctx.close(); };
      return mic.stream;
    };
  });
  await mockNetwork(page);
  const languages: string[] = [];
  await page.route("**/api/stt", async (route) => {
    // The browser sends multipart data with the requested recognition language.
    const lang = route.request().postData()?.match(/name="lang"\r\n\r\n([^\r]+)/)?.[1] ?? "";
    languages.push(lang);
    await route.fulfill({ json: { text: lang === "auto" ? "" : "Does the 7 stop at 74 Street Broadway?" } });
  });
  await page.route("**/api/agent", (route) => route.fulfill({
    contentType: "application/x-ndjson",
    body: JSON.stringify({ type: "text", text: "The local 7 stops there." }) + "\n",
  }));
  await page.goto("/");
  await page.getByRole("button", { name: "Hands-free conversation" }).click();
  await expect(page.getByText("The local 7 stops there.")).toBeVisible({ timeout: 15_000 });
  expect(languages).toEqual(["auto", "en-US"]);
});
