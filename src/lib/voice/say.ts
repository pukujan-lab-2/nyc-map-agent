import { formatStationName } from "@/lib/streetName";
import { kokoroLang, kokoroUp, speakKokoro } from "./kokoro";
import { speakQueued } from "./tts";

/**
 * Says `text` once and returns cancel; `onEnd` fires once, after the last sound, on cancel or on failure.
 * Station and street shorthand is read in full ("Times Square-42 Street"), then Kokoro speaks it where it
 * has a voice (#37); the browser voice takes every other language and any failure. `keep` saves the
 * line's sound on the phone and plays it from there when the server is down (trip steps, #132; notice
 * steps, #218). `source` ("notice:<id>") says the line is public text the server may keep for every
 * rider. A trip's step names none: it can name where the rider is going, so it stays on the phone.
 * While the speech server is known to be down, a kept line is still asked for only with no signal,
 * where the phone's own copy answers; with a signal the browser voice speaks at once.
 */
/**
 * Whether to ask for Kokoro's voice. While the speech server is marked down (a minute after a failure),
 * only a kept line with no signal is still asked for, since the phone's own copy can answer it; with a
 * signal the browser voice speaks at once instead of every step waiting on a server that is down. Pure.
 */
export const askKokoro = (up: boolean, keep: boolean, online: boolean): boolean => up || (keep && !online);

export function say(text: string, lang: string, onEnd: () => void, keep = false, source?: string): () => void {
  const said = formatStationName(text);
  let inner: () => void = () => undefined;
  const browser = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) inner = speakQueued(window.speechSynthesis, said, onEnd, lang);
    else onEnd();
  };
  const online = typeof navigator === "undefined" || navigator.onLine !== false;
  const k = askKokoro(kokoroUp(), keep, online) ? kokoroLang(said, lang) : null;
  if (k) inner = speakKokoro(said, k, onEnd, browser, keep, source);
  else browser();
  return () => inner();
}
