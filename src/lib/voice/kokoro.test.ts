import { afterEach, describe, expect, it, vi } from "vitest";
import { kokoroLang, openSpeech, pcm16ToFloat, speakKokoro } from "./kokoro";

describe("kokoro", () => {
  it("speaks the app's English, Spanish, French and Chinese, and leaves the rest to the browser", () => {
    expect(kokoroLang("Take the 4 train.", "en-US")).toBe("en");
    expect(kokoroLang("Toma el tren 4.", "es-MX")).toBe("es");
    expect(kokoroLang("Prenez le train 4.", "fr")).toBe("fr");
    expect(kokoroLang("乘坐4号线。", "en")).toBe("zh");
    expect(kokoroLang("Pran tren 4 la.", "ht")).toBeNull();
    expect(kokoroLang("Садитесь на поезд 4.", "ru")).toBeNull();
    expect(kokoroLang("4번 열차를 타세요.", "en")).toBeNull();
    // An English answer naming a Chinese button stays English; a Chinese one naming a station stays Chinese.
    expect(kokoroLang("I need a starting point. Tap 使用我的位置 under my reply, or type the address.", "en-US")).toBe("en");
    expect(kokoroLang("从 Fulton St 站坐 A 线往上城方向，到 59 St-Columbus Circle 下车。", "en-US")).toBe("zh");
  });

  it("turns 16-bit little-endian samples into floats and drops an odd last byte", () => {
    const f = pcm16ToFloat(new Uint8Array([0x00, 0x00, 0x00, 0x40, 0x00, 0x80, 0x7f]));
    expect([...f]).toEqual([0, 0.5, -1]);
  });
});

/** Silent: every "sound" here is bytes in a Response; nothing reaches an AudioContext. */
describe("a notice walk's clip made ahead", () => {
  const KEY = "c".repeat(64);
  const audio = () => new Response(new Uint8Array([0, 0, 0, 64]), { headers: { "content-type": "audio/L16", "x-sample-rate": "24000" } });
  const calls = (f: ReturnType<typeof vi.fn>) => (f.mock.calls as unknown as Array<[string, RequestInit?]>).map(([url, init]) => `${init?.method ?? "GET"} ${url}`);
  afterEach(() => vi.unstubAllGlobals());

  it("plays the clip when it is ready, without asking for the line live", async () => {
    const f = vi.fn((url: string) => Promise.resolve(url.includes("/clip/") ? audio() : new Response("", { status: 500 })));
    const res = await openSpeech("Take the 7.", "en", false, KEY, new AbortController().signal, f as unknown as typeof fetch);
    expect(res.headers.get("x-sample-rate")).toBe("24000");
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([0, 0, 0, 64]);
    expect(calls(f)).toEqual([`GET /api/tts/clip/${KEY}`]);
  });

  it("speaks the line live when the clip is not made yet or can't be reached", async () => {
    for (const clipAnswer of [() => Promise.resolve(new Response("{}", { status: 404 })), () => Promise.reject(new TypeError("offline"))]) {
      const f = vi.fn((url: string) => (url.includes("/clip/") ? clipAnswer() : Promise.resolve(audio())));
      const res = await openSpeech("Take the 7.", "en", false, KEY, new AbortController().signal, f as unknown as typeof fetch);
      expect(res.ok).toBe(true);
      expect(calls(f)).toEqual([`GET /api/tts/clip/${KEY}`, "POST /api/tts"]);
      expect(JSON.parse((f.mock.calls[1] as unknown as [string, RequestInit])[1].body as string)).toEqual({ text: "Take the 7.", lang: "en" });
    }
    const f = vi.fn(() => Promise.resolve(audio()));
    await openSpeech("Take the 7.", "en", false, null, new AbortController().signal, f as unknown as typeof fetch);
    expect(calls(f)).toEqual(["POST /api/tts"]);
  });

  it("hands the line to the phone's own voice when neither the clip nor live speech answers", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(new Response("{}", { status: url.includes("/clip/") ? 404 : 502 }))));
    const onFail = vi.fn();
    const onEnd = vi.fn();
    speakKokoro("Take the 7.", "en", onEnd, onFail, false, KEY);
    await vi.waitFor(() => expect(onFail).toHaveBeenCalledTimes(1));
    expect(onEnd).not.toHaveBeenCalled();
  });
});
