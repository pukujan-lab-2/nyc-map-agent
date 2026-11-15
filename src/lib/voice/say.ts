import { formatStationName } from "@/lib/streetName";
import { kokoroLang, kokoroUp, speakKokoro } from "./kokoro";
import { speakQueued } from "./tts";

/**
 * Says `text` once and returns cancel; `onEnd` fires once, after the last sound, on cancel or on failure.
 * Station and street shorthand is read in full ("Times Square-42 Street"), then Kokoro speaks it where it
 * has a voice (#37); the browser voice takes every other language and any failure. `keep` saves the
 * line's sound on the phone and plays it from there when the server is down (trip steps, #132; notice
 * steps, #218). `source` names where a kept line came from, "notice:<id>" for a notice's step; a kept
 * line with none is a trip step. A line that is not kept (a chat answer) is stored nowhere.
 */
export function say(text: string, lang: string, onEnd: () => void, keep = false, source?: string): () => void {
  const said = formatStationName(text);
  let inner: () => void = () => undefined;
  const browser = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) inner = speakQueued(window.speechSynthesis, said, onEnd, lang);
    else onEnd();
  };
  const k = kokoroUp() || keep ? kokoroLang(said, lang) : null;
  if (k) inner = speakKokoro(said, k, onEnd, browser, keep, source ?? (keep ? "trip_step" : undefined));
  else browser();
  return () => inner();
}
