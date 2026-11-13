import { afterEach, describe, expect, it, vi } from "vitest";
import { keepVoice, keptVoice, kokoroLang, pcm16ToFloat, VOICE_MAX, voiceKey } from "./kokoro";

describe("kokoro", () => {
  it("speaks the app's English, Spanish, French and Chinese, and leaves the rest to the browser", () => {
    expect(kokoroLang("Take the 4 train.", "en-US")).toBe("en");
    expect(kokoroLang("Toma el tren 4.", "es-MX")).toBe("es");
    expect(kokoroLang("Prenez le train 4.", "fr")).toBe("fr");
    expect(kokoroLang("乘坐4号线。", "en")).toBe("zh");
    expect(kokoroLang("Pran tren 4 la.", "ht")).toBeNull();
    expect(kokoroLang("Садитесь на поезд 4.", "ru")).toBeNull();
    expect(kokoroLang("4번 열차를 타세요.", "en")).toBeNull();
  });

  it("turns 16-bit little-endian samples into floats and drops an odd last byte", () => {
    const f = pcm16ToFloat(new Uint8Array([0x00, 0x00, 0x00, 0x40, 0x00, 0x80, 0x7f]));
    expect([...f]).toEqual([0, 0.5, -1]);
  });
});

/** Just enough of Cache Storage for the kept lines: one cache, keys in the order they were put. */
function fakeCaches() {
  const store = new Map<string, Response>();
  const cache = {
    match: (u: string) => Promise.resolve(store.get(u)?.clone()),
    put: (u: string, r: Response) => Promise.resolve(void store.set(u, r)),
    keys: () => Promise.resolve([...store.keys()].map((u) => new Request(u))),
    delete: (r: Request) => Promise.resolve(store.delete(r.url)),
  };
  return { store, caches: { open: () => Promise.resolve(cache) } };
}

describe("spoken trip steps kept on the phone (#132)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("gives each line and language its own key", () => {
    expect(voiceKey("Up the stairs", "en")).not.toBe(voiceKey("Up the stairs", "es"));
    expect(voiceKey("Up the stairs", "en")).not.toBe(voiceKey("Up the stair", "en"));
    expect(voiceKey("Up the stairs", "en")).toMatch(/^\/__voice\/v1\/en\/[0-9a-f]+-13$/);
  });

  it("plays back a kept line's sound and sample rate, and misses a line never kept", async () => {
    const { caches } = fakeCaches();
    vi.stubGlobal("caches", caches);
    await keepVoice("Turn left to the fare gates", "en", new Uint8Array([1, 2, 3, 4]), 22050);
    const got = await keptVoice("Turn left to the fare gates", "en");
    expect(got?.rate).toBe(22050);
    expect([...(got?.pcm ?? [])]).toEqual([1, 2, 3, 4]);
    expect(await keptVoice("Turn right", "en")).toBeNull();
    expect(await keptVoice("Turn left to the fare gates", "es")).toBeNull();
  });

  it(`keeps the newest ${VOICE_MAX} lines`, async () => {
    const { caches, store } = fakeCaches();
    vi.stubGlobal("caches", caches);
    for (let i = 0; i < VOICE_MAX + 5; i++) await keepVoice(`step ${i}`, "en", new Uint8Array([i, 0]), 24000);
    expect(store.size).toBe(VOICE_MAX);
    expect(await keptVoice("step 0", "en")).toBeNull();
    expect(await keptVoice(`step ${VOICE_MAX + 4}`, "en")).not.toBeNull();
  });

  it("does nothing without Cache Storage", async () => {
    vi.stubGlobal("caches", undefined);
    await keepVoice("x", "en", new Uint8Array([1, 2]), 24000);
    expect(await keptVoice("x", "en")).toBeNull();
  });
});
