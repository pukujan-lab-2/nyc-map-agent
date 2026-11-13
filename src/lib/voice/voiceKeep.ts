/**
 * The trip preview's spoken steps kept on the phone (#132): Kokoro's sound for a line, saved once it
 * has been read, so a walk replayed below the street keeps its voice with no signal. Loaded only when
 * such a line is spoken, to keep it out of the app's first download.
 */
import { pcm16ToFloat } from "./kokoro";

/** Cache Storage name for kept lines; a new version drops the old. */
export const VOICE_CACHE = "nyc-map-voice-v1";
/** Lines kept, newest first out; about 150 KB each, so a few trips' walks. */
export const VOICE_MAX = 80;

/** FNV-1a, for a short cache key. Pure. */
export function voiceKey(text: string, lang: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return `/__voice/v1/${lang}/${h.toString(16)}-${text.length}`;
}

const voiceUrl = (text: string, lang: string) => new URL(voiceKey(text, lang), typeof location === "undefined" ? "http://localhost" : location.origin).href;

/** A kept line's sound, or null. The stored text is checked, so a key that collides is a miss. */
export async function keptVoice(text: string, lang: string): Promise<{ f: Float32Array; rate: number } | null> {
  if (typeof caches === "undefined") return null;
  try {
    const hit = await (await caches.open(VOICE_CACHE)).match(voiceUrl(text, lang));
    if (!hit || hit.headers.get("x-text") !== encodeURIComponent(text)) return null;
    return { f: pcm16ToFloat(new Uint8Array(await hit.arrayBuffer())), rate: Number(hit.headers.get("x-sample-rate")) || 24000 };
  } catch {
    return null;
  }
}

/** Saves a line's sound (the pieces as they streamed in), dropping the oldest past VOICE_MAX. */
export async function keepVoice(text: string, lang: string, pieces: Uint8Array[], rate: number): Promise<void> {
  const pcm = new Uint8Array(pieces.reduce((n, b) => n + b.length, 0));
  let at = 0;
  for (const b of pieces) { pcm.set(b, at); at += b.length; }
  if (typeof caches === "undefined" || !pcm.length) return;
  try {
    const cache = await caches.open(VOICE_CACHE);
    const headers = { "content-type": "application/octet-stream", "x-sample-rate": String(rate), "x-text": encodeURIComponent(text) };
    await cache.put(voiceUrl(text, lang), new Response(pcm.buffer, { headers }));
    const keys = await cache.keys();
    for (const k of keys.slice(0, Math.max(0, keys.length - VOICE_MAX))) await cache.delete(k);
  } catch {
    /* full or blocked: the line is asked for again next time */
  }
}
