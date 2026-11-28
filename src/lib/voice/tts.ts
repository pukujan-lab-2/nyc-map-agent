/**
 * Sentence-queued speechSynthesis that does not get truncated. Chrome drops or
 * stalls long utterances (~15 s), speaks nothing useful before voices load, and
 * can GC an utterance mid-speech. So: one short chunk at a time, references
 * kept, pause/resume every 10 s, and a bounded wait for voiceschanged.
 */

/** Split text into sentence-sized chunks of at most ~`max` characters (long sentences split at commas/spaces). */
export const chunkText = (text: string, max = 180): string[] =>
  (text.replace(/\s+/g, " ").match(/[^.!?;:]+[.!?;:]*["')\]]*/g) ?? [])
    .flatMap((s) => s.match(new RegExp(`.{1,${max}}(\\s|$)`, "g")) ?? [])
    .map((s) => s.trim())
    .filter(Boolean);

/** The first sentences of an answer (~`max` chars) to say aloud; full detail stays on screen. */
export function spokenSummary(text: string, max = 240): string {
  const plain = text.replace(/[*_#>`|[\]]|\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  let out = "";
  for (const p of chunkText(plain, max)) {
    if (out && out.length + p.length > max) break;
    out = out ? `${out} ${p}` : p;
  }
  // The pointer to the screen is English: a Nepali or Arabic answer read by a borrowed voice would end in
  // English it cannot say, so those answers stop at the summary (owner report, 2026-10-27).
  const otherScript = mainScript(out) !== null;
  return out.length < plain.length - 5 && !otherScript ? `${out} The details are on screen.` : out;
}

/** "es_ES" (older Android) and "es-es" both read as "es-ES". */
const tagOf = (lang: string) => lang.replace(/_/g, "-").toLowerCase();

/** The region a bare tag means when the phone has several: "zh" is Mandarin, not Cantonese (zh-HK). */
const HOME_REGION: Record<string, string> = { en: "en-us", zh: "zh-cn" };

/**
 * How good a voice sounds, lower first (owner, 2026-11-27: the first voice a phone lists is often a
 * robotic "compact" one). Premium, Enhanced (iOS, macOS) and Natural or Neural (Edge, Android) voices
 * first, then voices on the phone itself, which keep working underground, then the rest. Apple's novelty
 * voices (Eloquence's Eddy and Grandma, Zarvox, Bells) go last.
 */
export function voiceRank(x: SpeechSynthesisVoice): number {
  const id = `${x.name} ${x.voiceURI ?? ""}`;
  if (/eloquence|speech\.synthesis\.voice|novelty/i.test(id)) return 5;
  const local = x.localService !== false;
  if (/premium/i.test(id)) return local ? 0 : 0.5;
  if (/enhanced|natural|neural/i.test(id)) return local ? 1 : 1.5;
  if (local) return /compact/i.test(id) ? 2.5 : 2;
  return /google/i.test(id) ? 3 : 4;
}

/** The best of `v` for `lang`: the region asked for first (accent), then the bare tag's home region, then voiceRank. */
function bestFor(v: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | undefined {
  const tag = tagOf(lang);
  const base = tag.split("-")[0];
  const region = (x: SpeechSynthesisVoice) => {
    const t = tagOf(x.lang);
    return t === tag ? 0 : t === HOME_REGION[base] ? 1 : 2;
  };
  const same = v.filter((x) => tagOf(x.lang).split("-")[0] === base);
  return same.sort((a, b) => region(a) - region(b) || voiceRank(a) - voiceRank(b))[0];
}

/** A voice for `lang` (BCP 47); English keeps the preferred natural US voices, then the best other English one. */
export const pickVoice = (v: SpeechSynthesisVoice[], lang = "en-US") => {
  const base = tagOf(lang).split("-")[0];
  if (base === "en") return v.find((x) => tagOf(x.lang) === "en-us" && /google|samantha|natural|aria/i.test(x.name)) ?? bestFor(v, "en-US");
  return bestFor(v, lang);
};

/** Writing systems a voice must read, and the language whose voice to borrow when none speaks the text's own. */
const SCRIPTS: Array<{ re: RegExp; langs: string[]; borrow: string; dense?: boolean }> = [
  { re: /[\u0900-\u097F]/, langs: ["hi", "ne", "mr"], borrow: "hi-IN" },
  { re: /[\u0980-\u09FF]/, langs: ["bn"], borrow: "bn-IN" },
  { re: /[\u0600-\u06FF]/, langs: ["ar", "ur", "fa"], borrow: "ar-SA" },
  { re: /[\uAC00-\uD7AF]/, langs: ["ko"], borrow: "ko-KR", dense: true },
  { re: /[\u4E00-\u9FFF]/, langs: ["zh", "ja"], borrow: "zh-CN", dense: true },
  { re: /[\u0400-\u04FF]/, langs: ["ru", "uk"], borrow: "ru-RU" },
];

/**
 * The writing system most of `text` is in, when it is not the Latin alphabet; null for Latin text.
 * An English answer that names a Chinese button ("Tap 使用我的位置") was read whole by the Chinese
 * voice (owner's partner, 2026-11-12), so one stray word no longer decides. A Chinese or Korean
 * character is about a word, so those count against Latin words; other scripts against Latin letters.
 */
export function mainScript(text: string): (typeof SCRIPTS)[number] | null {
  const letters = (text.match(/[A-Za-z\u00C0-\u024F]/g) ?? []).length;
  const words = (text.match(/[A-Za-z\u00C0-\u024F]+/g) ?? []).length;
  let best: (typeof SCRIPTS)[number] | null = null, lead = 0;
  for (const s of SCRIPTS) {
    const n = (text.match(new RegExp(s.re.source, "g")) ?? []).length;
    const over = n / Math.max(s.dense ? words : letters, 1);
    if (n > 0 && over >= 1 && over > lead) { best = s; lead = over; }
  }
  return best;
}

/**
 * The voice and language to say `text` in (owner, 2026-10-26). A Nepali answer was read by the English voice:
 * Nepali was not a language we recognised, and no browser here has a Nepali voice. When the text is in a
 * script the language does not use, or no voice speaks that language, a voice that reads the script is
 * borrowed: Hindi reads Nepali and Marathi, which share Devanagari.
 */
export function voiceFor(v: SpeechSynthesisVoice[], text: string, lang = "en-US"): { voice?: SpeechSynthesisVoice; lang: string } {
  const script = mainScript(text);
  const base = lang.split("-")[0].toLowerCase();
  const tag = script && !script.langs.includes(base) ? script.borrow : lang;
  const voice = pickVoice(v, tag);
  if (voice || !script || tag === script.borrow) return { voice, lang: tag };
  return { voice: pickVoice(v, script.borrow), lang: script.borrow };
}

/**
 * Speaks `text` chunk by chunk. Returns cancel. Callers mark speaking before calling. `onEnd` fires once: after
 * the last chunk, on cancel, or on interruption. With `onNoVoice`, a phone that lists voices but none for the
 * language (Haitian Creole on most phones) says nothing and calls `onNoVoice` with the language instead of
 * `onEnd`, rather than reading it in an English voice. English, and a phone that lists no voices yet, speak as before.
 */
export function speakQueued(synth: SpeechSynthesis, text: string, onEnd: () => void, lang?: string, onNoVoice?: (lang: string) => void): () => void {
  const chunks = chunkText(text);
  let done = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  const end = () => {
    if (done) return;
    done = true;
    clearInterval(timer);
    onEnd();
  };
  if (!chunks.length) { end(); return end; }
  synth.cancel();
  const go = () => {
    if (done || timer) return;
    const voices = synth.getVoices();
    const { voice, lang: tag } = voiceFor(voices, text, lang);
    if (!voice && voices.length && onNoVoice && !/^en\b/i.test(tag)) { done = true; onNoVoice(tag); return; }
    timer = setInterval(() => { if (synth.speaking && !synth.paused) { synth.pause(); synth.resume(); } }, 10_000);
    let i = 0;
    const next = () => {
      if (done) return;
      if (i >= chunks.length) return end();
      const u = new SpeechSynthesisUtterance(chunks[i++]);
      if (voice) u.voice = voice;
      u.lang = tag;
      u.rate = 1.02;
      u.onend = next;
      u.onerror = (e) => (/interr|cancel/.test(e.error) ? end() : next());
      // Held globally: Chrome can GC an utterance mid-speech and never fire onend.
      (globalThis as { _tts?: unknown })._tts = u;
      synth.speak(u);
    };
    next();
  };
  if (synth.getVoices().length) go();
  else {
    synth.addEventListener?.("voiceschanged", go, { once: true });
    setTimeout(go, 1500);
  }
  return () => { synth.cancel(); end(); };
}
