import { describe, expect, it, vi } from "vitest";
import { chunkText, pickVoice, speakQueued, spokenSummary, voiceFor, voiceRank } from "./tts";
import { isSpeech } from "./bargeIn";

describe("chunkText", () => {
  it("splits per sentence and caps chunk length", () => {
    const long = "Take the 1 train uptown, transfer at 72 St, walk two blocks west along a very long avenue that keeps going and going for quite a while past many shops and cafés, then turn right onto the side street.";
    const chunks = chunkText(`Hi there. ${long} Done!`, 80);
    expect(chunks[0]).toBe("Hi there.");
    expect(chunks.at(-1)).toBe("Done!");
    expect(chunks.every((c) => c.length <= 81)).toBe(true);
    expect(chunks.join(" ").replace(/\s+/g, " ")).toContain("turn right onto the side street.");
  });
  it("handles empty input", () => expect(chunkText("  ")).toEqual([]));
});

describe("spokenSummary", () => {
  it("keeps short answers whole", () => expect(spokenSummary("Use the stairs at 7 Av.")).toBe("Use the stairs at 7 Av."));
  it("shortens long answers and points to the screen", () => {
    const s = spokenSummary("First sentence here is fairly long and useful. " + "More detail follows. ".repeat(30));
    expect(s.length).toBeLessThan(300);
    expect(s).toMatch(/details are on screen\.$/);
  });
  it("does not end a Nepali answer in English", () => {
    const s = spokenSummary("सबैभन्दा नजिकको शौचालय यहाँ छ। " + "थप विवरण यहाँ छ। ".repeat(30));
    expect(s).not.toMatch(/details are on screen/);
    expect(s.length).toBeLessThan(300);
  });
  it("strips markdown", () => expect(spokenSummary("**Take** the [A](http://x) train.")).toBe("Take the A train."));
});

describe("pickVoice", () => {
  it("prefers a natural en-US voice", () => {
    const v = [{ lang: "fr-FR", name: "Amelie" }, { lang: "en-US", name: "Fred" }, { lang: "en-US", name: "Google US English" }] as SpeechSynthesisVoice[];
    expect(pickVoice(v)?.name).toBe("Google US English");
  });
  it("picks a voice in the browser's language, region first (#370)", () => {
    const v = [{ lang: "en-US", name: "Fred" }, { lang: "es-ES", name: "Monica" }, { lang: "es-MX", name: "Paulina" }] as SpeechSynthesisVoice[];
    expect(pickVoice(v, "es-MX")?.name).toBe("Paulina");
    expect(pickVoice(v, "es-US")?.name).toBe("Monica");
    expect(pickVoice(v, "zh-CN")).toBeUndefined();
  });
});

describe("pickVoice on real phones and browsers (owner, 2026-11-27)", () => {
  const voice = (name: string, lang: string, localService = true, voiceURI = name) => ({ name, lang, localService, voiceURI, default: false }) as SpeechSynthesisVoice;
  // iOS Safari: compact voices come first; Enhanced and Premium ones appear once downloaded; Eloquence's novelty voices are local too.
  const ios = [
    voice("Eddy (Spanish (Spain))", "es-ES", true, "com.apple.eloquence.es-ES.Eddy"),
    voice("Mónica", "es-ES", true, "com.apple.voice.compact.es-ES.Monica"),
    voice("Paulina", "es-MX", true, "com.apple.voice.compact.es-MX.Paulina"),
    voice("Marisol (Enhanced)", "es-ES", true, "com.apple.voice.enhanced.es-ES.Marisol"),
    voice("Sinji", "zh-HK", true, "com.apple.voice.premium.zh-HK.Sinji"),
    voice("Tingting", "zh-CN", true, "com.apple.voice.compact.zh-CN.Tingting"),
    voice("Lilian (Premium)", "zh-CN", true, "com.apple.voice.premium.zh-CN.Lilian"),
    voice("Grandma (French (France))", "fr-FR", true, "com.apple.eloquence.fr-FR.Grandma"),
    voice("Thomas", "fr-FR", true, "com.apple.voice.compact.fr-FR.Thomas"),
    voice("Samantha", "en-US", true, "com.apple.voice.compact.en-US.Samantha"),
    voice("Ava (Premium)", "en-US", true, "com.apple.voice.premium.en-US.Ava"),
  ];
  // Android Chrome: older builds report "es_US"; the network voices stop underground.
  const android = [
    voice("es-us-x-sfb-network", "es_US", false),
    voice("es-us-x-esc-local", "es_US", true),
    voice("ko-kr-x-kob-network", "ko-KR", false),
    voice("ko-kr-x-ism-local", "ko-KR", true),
    voice("ru-ru-x-ruc-local", "ru-RU", true),
  ];
  // Chrome on a desktop: Google's voices are online only, the system's are on the machine.
  const chrome = [voice("Google español", "es-ES", false), voice("Microsoft Helena - Spanish (Spain)", "es-ES", true), voice("Google 한국의", "ko-KR", false)];
  // Edge: the Natural voices are online; the old system ones are local and robotic.
  const edge = [
    voice("Microsoft Helena - Spanish (Spain)", "es-ES", true),
    voice("Microsoft Dalia Online (Natural) - Spanish (Mexico)", "es-MX", false),
    voice("Microsoft Denise Online (Natural) - French (France)", "fr-FR", false),
    voice("Microsoft Hortense - French (France)", "fr-FR", true),
  ];
  it("iOS: an Enhanced or Premium voice over the compact one listed first, and never a novelty voice", () => {
    expect(pickVoice(ios, "es")?.name).toBe("Marisol (Enhanced)");
    expect(pickVoice(ios, "fr")?.name).toBe("Thomas");
    expect(pickVoice(ios, "zh")?.name).toBe("Lilian (Premium)");
  });
  it("iOS: the region asked for still comes first, and Mandarin is never read by the Cantonese voice", () => {
    expect(pickVoice(ios, "es-MX")?.name).toBe("Paulina");
    expect(pickVoice(ios.filter((v) => v.name !== "Lilian (Premium)"), "zh")?.name).toBe("Tingting");
  });
  it("iOS: English keeps its preferred voice", () => expect(pickVoice(ios, "en")?.name).toBe("Samantha"));
  it("Android: the voice on the phone over the network one, whatever the tag's spelling", () => {
    expect(pickVoice(android, "es")?.name).toBe("es-us-x-esc-local");
    expect(pickVoice(android, "es-US")?.name).toBe("es-us-x-esc-local");
    expect(pickVoice(android, "ko")?.name).toBe("ko-kr-x-ism-local");
    expect(pickVoice(android, "ht")).toBeUndefined();
  });
  it("Chrome desktop: the voice on the machine first, an online Google voice when it is the only one", () => {
    expect(pickVoice(chrome, "es")?.name).toBe("Microsoft Helena - Spanish (Spain)");
    expect(pickVoice(chrome, "ko")?.name).toBe("Google 한국의");
  });
  it("Edge: a Natural voice over the old system voice", () => {
    expect(pickVoice(edge, "es")?.name).toBe("Microsoft Dalia Online (Natural) - Spanish (Mexico)");
    expect(pickVoice(edge, "fr")?.name).toBe("Microsoft Denise Online (Natural) - French (France)");
  });
  it("ranks voices: Premium, Enhanced or Natural, then on the phone, then online, novelty last", () => {
    expect(voiceRank(ios[6])).toBeLessThan(voiceRank(ios[3]));
    expect(voiceRank(ios[3])).toBeLessThan(voiceRank(ios[1]));
    expect(voiceRank(android[1])).toBeLessThan(voiceRank(android[0]));
    expect(voiceRank(ios[0])).toBeGreaterThan(voiceRank(chrome[0]));
  });
});

describe("voiceFor", () => {
  const v = [{ lang: "en-US", name: "Samantha" }, { lang: "hi-IN", name: "Lekha" }, { lang: "es-ES", name: "Monica" }] as SpeechSynthesisVoice[];
  const nepali = "तपाईं कहाँबाट हिँड्नुहुन्छ?";
  it("reads a Nepali answer in a Hindi voice, not the English one", () => {
    expect(voiceFor(v, nepali, "en-US")).toEqual({ voice: v[1], lang: "hi-IN" });
  });
  it("borrows the Hindi voice when Nepali was heard but no Nepali voice exists", () => {
    expect(voiceFor(v, nepali, "ne")).toEqual({ voice: v[1], lang: "hi-IN" });
  });
  it("keeps the asked language when the text is in its letters", () => {
    expect(voiceFor(v, "Toma el tren A.", "es-ES").voice?.name).toBe("Monica");
    expect(voiceFor(v, "Take the A train.").voice?.name).toBe("Samantha");
  });
  it("reads an English answer that names a Chinese button in the English voice", () => {
    expect(voiceFor(v, "I need a starting point. Tap 使用我的位置 under my reply.", "en-US")).toEqual({ voice: v[0], lang: "en-US" });
  });
});

describe("speakQueued", () => {
  it("speaks every chunk in order, waits for voices, and ends once", async () => {
    vi.useFakeTimers();
    const said: string[] = [];
    const listeners: Array<() => void> = [];
    let voices: SpeechSynthesisVoice[] = [];
    const synth = {
      speaking: false, paused: false,
      cancel: vi.fn(), pause: vi.fn(), resume: vi.fn(),
      getVoices: () => voices,
      addEventListener: (_: string, f: () => void) => listeners.push(f),
      removeEventListener: () => {},
      speak: (u: { text: string; onend?: () => void }) => { said.push(u.text); setTimeout(() => u.onend?.(), 10); },
    } as unknown as SpeechSynthesis;
    globalThis.SpeechSynthesisUtterance = class { text: string; constructor(t: string) { this.text = t; } } as unknown as typeof SpeechSynthesisUtterance;
    const onEnd = vi.fn();
    speakQueued(synth, "One. Two. Three.", onEnd);
    expect(said).toEqual([]); // voices not loaded yet
    voices = [{ lang: "en-US", name: "Samantha" } as SpeechSynthesisVoice];
    listeners.forEach((f) => f());
    await vi.advanceTimersByTimeAsync(100);
    expect(said).toEqual(["One.", "Two.", "Three."]);
    expect(onEnd).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
  it("says nothing and reports the language when the phone has no voice for it", () => {
    const said: string[] = [];
    const synth = { speaking: false, paused: false, cancel: vi.fn(), pause() {}, resume() {}, getVoices: () => [{ lang: "en-US", name: "Samantha" }, { lang: "fr-FR", name: "Thomas" }], speak: (u: { text: string }) => said.push(u.text) } as unknown as SpeechSynthesis;
    const onEnd = vi.fn();
    const onNoVoice = vi.fn();
    speakQueued(synth, "Pran tren A a.", onEnd, "ht", onNoVoice);
    expect(said).toEqual([]);
    expect(onNoVoice).toHaveBeenCalledWith("ht");
    expect(onEnd).not.toHaveBeenCalled();
  });
  it("still speaks when the phone lists no voices yet, or the language is English", async () => {
    vi.useFakeTimers();
    const said: string[] = [];
    const synth = { speaking: false, paused: false, cancel: vi.fn(), pause() {}, resume() {}, getVoices: () => [], speak: (u: { text: string }) => said.push(u.text) } as unknown as SpeechSynthesis;
    const onNoVoice = vi.fn();
    speakQueued(synth, "Pran tren A a.", () => {}, "ht", onNoVoice);
    await vi.advanceTimersByTimeAsync(1600);
    expect(said).toEqual(["Pran tren A a."]);
    expect(onNoVoice).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
  it("cancel stops the queue", async () => {
    const said: string[] = [];
    const synth = { speaking: true, paused: false, cancel: vi.fn(), pause() {}, resume() {}, getVoices: () => [{ lang: "en-US", name: "x" }], speak: (u: { text: string }) => said.push(u.text) } as unknown as SpeechSynthesis;
    const onEnd = vi.fn();
    const cancel = speakQueued(synth, "A. B.", onEnd);
    await Promise.resolve();
    cancel();
    expect(said).toEqual(["A."]);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});

describe("barge-in VAD", () => {
  it("accumulates only above the noise floor", () => {
    expect(isSpeech(0.02, 0.01)).toBe(false);
    expect(isSpeech(0.08, 0.01)).toBe(true);
    expect(isSpeech(0.08, 0.05)).toBe(false);
  });
});
