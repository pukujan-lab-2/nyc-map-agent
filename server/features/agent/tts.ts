/**
 * POST /api/tts {text, lang}: the answer read aloud by Kokoro instead of the browser's own voice
 * (owner, 2026-11-01: "the output voice is still the default browser voice"). The text goes to the
 * copilot's speech server (the same one STT_BASE_URL names for speech-to-text, STT_PROTOCOL=speech):
 * POST /tts {text, stack, lang} streams 16-bit mono PCM, sample rate in X-Sample-Rate, first sound as
 * soon as it is made. We pass that stream straight through. Kokoro has voices for English, Spanish,
 * French and Chinese of the app's languages; any other answers 415 and the browser speaks it as before.
 * TTS_BASE_URL overrides the server when speech-to-text lives elsewhere. Nothing is logged.
 *
 * A line the page names a source for (X-Speech-Source: a notice's step or a trip's step) is made once:
 * the sound is saved as it streams and the next request for the same text, language, voice and model
 * version is answered from the file (speechCache.ts, #218). A chat answer names no source and is never kept.
 * Like speech-to-text, every request names the app to the speech gateway with X-Speech-Project.
 *
 * The speech server keeps one stack of models in memory and swaps when another app asks for a different
 * one, which costs the next rider about 6 s of silence. `startVoiceKeeper` asks it to load our stack
 * (POST /load, a no-op when it is already there) at start and every few minutes.
 */
import { clientIp } from "../../lib/clientIp";
import { createLimiter } from "./fair-use";
import { cacheDir, parseSource, readAudio, saveAudio, ttsKey } from "./speechCache";

/** The app's languages Kokoro speaks (the speech server's stacks.json). */
export const TTS_LANGS = new Set(["en", "es", "fr", "zh"]);
/** A spoken summary is a few sentences; a longer text is cut by the client first. */
export const MAX_CHARS = 600;
const limiter = createLimiter({ windowMax: 400, windowMs: 3_600_000, burstMax: 30, burstMs: 60_000 });

export const ttsConfig = (env = process.env) => ({
  base: (env.TTS_BASE_URL || (env.STT_PROTOCOL === "speech" ? env.STT_BASE_URL : "") || "").replace(/\/$/, ""),
  stack: env.TTS_STACK || env.STT_STACK || "multilingual",
  project: env.STT_PROJECT || "nyc-map",
  /** Part of a saved sound's key: raise it when the speech server's model or voice changes, so no old sound plays. */
  modelVersion: env.TTS_MODEL_VERSION || "kokoro-1",
});
/** A sound longer than this is passed through but not kept (about 60 s at 24 kHz). */
const MAX_KEEP_BYTES = 3 * 1024 * 1024;

const json = (body: unknown, status: number) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

/** "es-US" → "es"; null for a language Kokoro has no voice for. Pure, for tests. */
export function ttsLang(tag: unknown): string | null {
  const two = typeof tag === "string" ? tag.trim().slice(0, 2).toLowerCase() : "en";
  return TTS_LANGS.has(two || "en") ? two || "en" : null;
}

export async function speak(req: Request, f: typeof fetch = fetch, env = process.env): Promise<Response> {
  const { base, stack, project, modelVersion } = ttsConfig(env);
  const body = (await req.json().catch(() => null)) as { text?: unknown; lang?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.replace(/\s+/g, " ").trim() : "";
  if (!text || text.length > MAX_CHARS) return json({ error: "text" }, 400);
  const lang = ttsLang(body?.lang);
  if (!lang) return json({ error: "language" }, 415);
  // A saved sound needs no speech server and does not count against the rider's allowance.
  const source = cacheDir(env) ? parseSource(req.headers.get("x-speech-source")) : null;
  const key = source ? ttsKey(text, lang, stack, modelVersion) : "";
  if (source) {
    const hit = await readAudio(key, env);
    if (hit) return new Response(hit.body, { headers: { "content-type": "audio/L16", "x-sample-rate": String(hit.rate), "x-speech-cache": "hit", "cache-control": "no-store" } });
  }
  if (!base) return json({ error: "no voice server" }, 503);
  if (!limiter.take(clientIp(req.headers)).ok) return json({ error: "too many" }, 429);
  let res: Response;
  try {
    res = await f(`${base}/tts`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-speech-project": project },
      body: JSON.stringify({ text, stack, lang }),
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(20_000)]),
    });
  } catch {
    return json({ error: "voice server unreachable" }, 502);
  }
  if (!res.ok || !res.body) return json({ error: `voice server ${res.status}` }, 502);
  const rate = res.headers.get("x-sample-rate") ?? "24000";
  const headers = { "content-type": "audio/L16", "x-sample-rate": rate, "cache-control": "no-store", ...(source ? { "x-speech-cache": "miss" } : {}) };
  if (!source) return new Response(res.body, { headers });
  // The rider hears it as it arrives; our copy is saved only when the whole sound came through.
  const [toRider, toKeep] = res.body.tee();
  void (async () => {
    const parts: Uint8Array[] = [];
    let n = 0;
    try {
      for (const reader = toKeep.getReader(); ;) {
        const { done, value } = await reader.read();
        if (done) break;
        n += value.length;
        if (n > MAX_KEEP_BYTES) { void reader.cancel().catch(() => undefined); return; }
        parts.push(value);
      }
    } catch {
      return; // cut short: not kept
    }
    const pcm = new Uint8Array(n);
    let at = 0;
    for (const p of parts) { pcm.set(p, at); at += p.length; }
    await saveAudio({ key, text, lang, voice: stack, modelVersion, source }, pcm, Number(rate) || 24000, env);
  })();
  return new Response(toRider, { headers });
}

/** Ask the speech server to have our stack loaded. True when it answered 2xx; never throws. */
export async function warmVoice(f: typeof fetch = fetch, env = process.env): Promise<boolean> {
  const { base, stack, project } = ttsConfig(env);
  if (!base) return false;
  try {
    const res = await f(`${base}/load?stack=${encodeURIComponent(stack)}`, { method: "POST", headers: { "x-speech-project": project }, signal: AbortSignal.timeout(60_000) });
    return res.ok;
  } catch {
    return false;
  }
}

const KEEP_WARM_EVERY_MS = 4 * 60_000;
let keeping = false;

/** Warm now and every four minutes. Starts once, and only when a speech server is set. Logs when it goes down or comes back. */
export function startVoiceKeeper(log: (m: string) => void = console.warn, env = process.env): void {
  if (keeping || !ttsConfig(env).base) return;
  keeping = true;
  let up: boolean | undefined;
  const tick = async () => {
    const ok = await warmVoice(fetch, env);
    if (ok !== up) log(`[voice] speech server ${ok ? "has our stack loaded" : "did not answer /load"}`);
    up = ok;
  };
  void tick();
  setInterval(() => void tick(), KEEP_WARM_EVERY_MS).unref();
}
