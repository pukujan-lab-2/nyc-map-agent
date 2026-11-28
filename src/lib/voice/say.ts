import { formatStationName } from "@/lib/streetName";
import { kokoroLang, kokoroUp, speakKokoro } from "./kokoro";
import { tellNoVoice } from "./noVoice";
import { speakQueued } from "./tts";
import { getVoiceChoice, type VoiceChoice } from "./voiceChoice";

/**
 * Says `text` once and returns cancel; `onEnd` fires once, after the last sound, on cancel or on failure.
 * Station and street shorthand is read in full ("Times Square-42 Street"). The rider's Voice setting
 * (voiceChoice.ts) picks who speaks first: "app" is Kokoro where it has the language (#37), the phone's
 * voice for every other language and any failure; "phone" is the phone's best voice, Kokoro only where
 * the phone has none. When neither can speak the language, nothing is read in a wrong voice: the line
 * stays on screen and the app says once that this phone has no voice for it. `keep` saves Kokoro's
 * sound on the phone and plays it from there when the server is down (trip steps, #132). `clip` names the line's
 * sound made ahead on the server (a notice walk's step); Kokoro plays it when ready, else speaks the line live.
 */
export function say(text: string, lang: string, onEnd: () => void, keep = false, choice: VoiceChoice = getVoiceChoice(), clip?: string | null): () => void {
  const said = formatStationName(text);
  let inner: () => void = () => undefined;
  const k = kokoroLang(said, lang);
  const silent = (tag: string) => { tellNoVoice(tag); onEnd(); };
  const app = (onFail: () => void) => { inner = speakKokoro(said, k as string, onEnd, onFail, keep, clip); };
  const phone = (onNoVoice: (tag: string) => void) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) inner = speakQueued(window.speechSynthesis, said, onEnd, lang, onNoVoice);
    else if (/^en\b/i.test(lang)) onEnd();
    else onNoVoice(lang);
  };
  // A clip may be on the phone already, so Kokoro is tried for it even while the server is marked down.
  const appUp = !!k && (kokoroUp() || keep || (!!clip && typeof AudioContext !== "undefined"));
  if (choice === "phone") phone((tag) => (appUp ? app(() => silent(tag)) : silent(tag)));
  else if (appUp) app(() => phone(silent));
  else phone(silent);
  return () => inner();
}
