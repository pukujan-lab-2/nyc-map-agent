import { formatStationName } from "@/lib/streetName";

/**
 * The name of a pre-made spoken line (a notice walk's step), shared by the server that makes it and the phone that
 * plays it. The key is a SHA-256 of the words as spoken, the language and the voice (the speech server's stack and
 * Kokoro's model version), so the same sentence is one file for every notice and every rider, and a new voice never
 * plays an old sound. Both sides compute it with Web Crypto, which Node and every browser the app supports have.
 */

/** Languages whose walk sentences come from the fixed patterns (`walkPatterns.ts`), so the server can make them ahead.
 * Plan step 7 adds Spanish, French and Chinese when their pattern tables ship; until then a translated walk is
 * spoken live. The other app languages use the phone's voice, so they never get clips. */
export const CLIP_LANGS: readonly string[] = ["en"];

/** A clip's key, as it appears in GET /api/tts/clip/<key>. */
export const CLIP_RE = /^[0-9a-f]{64}$/;

/** The words exactly as `say()` hands them to Kokoro and the server sends them to the speech server. Pure. */
export function spokenText(text: string): string {
  return formatStationName(text).replace(/\s+/g, " ").trim();
}

export async function clipKey(spoken: string, lang: string, voice: string): Promise<string> {
  const data = new TextEncoder().encode(["clip-v1", spoken, lang, voice].join("\u0000"));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
