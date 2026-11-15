import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { speak, ttsConfig, ttsLang, warmVoice } from "./tts";

const ENV = { STT_PROTOCOL: "speech", STT_BASE_URL: "http://gateway.test:18800", STT_STACK: "multilingual" } as unknown as NodeJS.ProcessEnv;
const post = (body: unknown) => new Request("http://app/api/tts", { method: "POST", body: JSON.stringify(body), headers: { "x-forwarded-for": "9.9.9.9" } });

describe("POST /api/tts", () => {
  it("uses the speech server that speech-to-text already names", () => {
    expect(ttsConfig(ENV)).toEqual({ base: "http://gateway.test:18800", stack: "multilingual", project: "nyc-map", modelVersion: "kokoro-1" });
    expect(ttsConfig({} as NodeJS.ProcessEnv).base).toBe("");
  });

  it("maps language tags to the four Kokoro languages", () => {
    expect([ttsLang("es-US"), ttsLang("fr"), ttsLang("ru"), ttsLang(undefined)]).toEqual(["es", "fr", null, "en"]);
  });

  it("streams the voice server's audio through with its sample rate", async () => {
    const f = vi.fn(() => Promise.resolve(new Response(new Uint8Array([1, 2, 3, 4]), { headers: { "x-sample-rate": "24000" } })));
    const res = await speak(post({ text: "Take the 4 train.", lang: "en" }), f as unknown as typeof fetch, ENV);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-sample-rate")).toBe("24000");
    expect(res.headers.get("content-type")).toBe("audio/L16");
    expect(f).toHaveBeenCalledWith("http://gateway.test:18800/tts", expect.objectContaining({ body: JSON.stringify({ text: "Take the 4 train.", stack: "multilingual", lang: "en" }) }));
    const sent = (f.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((sent.headers as Record<string, string>)["x-speech-project"]).toBe("nyc-map");
  });

  // #218: a notice's step is made once. The page names the source; a chat answer names none and is never kept.
  it("saves a named line's sound and answers the next request from the file, without the speech server", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tts-cache-"));
    const env = { ...ENV, SPEECH_CACHE_DIR: dir } as unknown as NodeJS.ProcessEnv;
    const named = (text: string, source?: string) => new Request("http://app/api/tts", { method: "POST", body: JSON.stringify({ text, lang: "en" }), headers: { "x-forwarded-for": "9.9.9.8", ...(source ? { "x-speech-source": source } : {}) } });
    const f = vi.fn(() => Promise.resolve(new Response(new Uint8Array([5, 6, 7, 8]), { headers: { "x-sample-rate": "22050" } })));
    const bytes = async (r: Response) => [...new Uint8Array(await r.arrayBuffer())];

    const first = await speak(named("Why: Technical issue.", "notice:n1"), f as unknown as typeof fetch, env);
    expect(first.headers.get("x-speech-cache")).toBe("miss");
    expect(await bytes(first)).toEqual([5, 6, 7, 8]);
    await vi.waitFor(async () => expect(await readdir(dir)).toHaveLength(1));

    const again = await speak(named("Why: Technical issue.", "notice:n2"), f as unknown as typeof fetch, env);
    expect(again.headers.get("x-speech-cache")).toBe("hit");
    expect(again.headers.get("x-sample-rate")).toBe("22050");
    expect(await bytes(again)).toEqual([5, 6, 7, 8]);
    expect(f).toHaveBeenCalledTimes(1);
    // A saved sound plays even when no speech server is set.
    expect((await speak(named("Why: Technical issue.", "trip_step"), fetch, { SPEECH_CACHE_DIR: dir } as unknown as NodeJS.ProcessEnv)).status).toBe(200);

    // No source: passed through and not kept.
    const chat = await speak(named("Your train leaves in four minutes."), f as unknown as typeof fetch, env);
    expect(chat.headers.get("x-speech-cache")).toBeNull();
    await bytes(chat);
    expect(f).toHaveBeenCalledTimes(2);
    expect(await readdir(dir)).toHaveLength(1);
    await rm(dir, { recursive: true });
  });

  it("answers 503 with no server, 400 for no text, 415 for Russian, 502 when the server fails", async () => {
    expect((await speak(post({ text: "hi" }), fetch, {} as NodeJS.ProcessEnv)).status).toBe(503);
    expect((await speak(post({ text: "  " }), fetch, ENV)).status).toBe(400);
    expect((await speak(post({ text: "Привет", lang: "ru" }), fetch, ENV)).status).toBe(415);
    const down = vi.fn(() => Promise.resolve(new Response("", { status: 500 })));
    expect((await speak(post({ text: "hi", lang: "en" }), down as unknown as typeof fetch, ENV)).status).toBe(502);
  });
});

describe("keeping the voice warm", () => {
  it("asks the speech server to load our stack, and says whether it answered", async () => {
    const ok = vi.fn(() => Promise.resolve(new Response("{}", { status: 200 })));
    expect(await warmVoice(ok as unknown as typeof fetch, ENV)).toBe(true);
    expect(ok).toHaveBeenCalledWith("http://gateway.test:18800/load?stack=multilingual", expect.objectContaining({ method: "POST", headers: { "x-speech-project": "nyc-map" } }));
    const bad = vi.fn(() => Promise.resolve(new Response("", { status: 500 })));
    expect(await warmVoice(bad as unknown as typeof fetch, ENV)).toBe(false);
    const down = vi.fn(() => Promise.reject(new Error("refused")));
    expect(await warmVoice(down as unknown as typeof fetch, ENV)).toBe(false);
  });

  it("does nothing with no speech server set", async () => {
    const f = vi.fn();
    expect(await warmVoice(f as unknown as typeof fetch, {} as NodeJS.ProcessEnv)).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
});
