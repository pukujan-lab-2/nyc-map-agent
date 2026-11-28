import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const speakKokoro = vi.fn();
const speakQueued = vi.fn();
const tellNoVoice = vi.fn();
let up = true;
vi.mock("./kokoro", async (orig) => ({ ...(await orig<typeof import("./kokoro")>()), kokoroUp: () => up, speakKokoro: (...a: unknown[]) => { speakKokoro(...a); return () => {}; } }));
vi.mock("./tts", async (orig) => ({ ...(await orig<typeof import("./tts")>()), speakQueued: (...a: unknown[]) => { speakQueued(...a); return () => {}; } }));
vi.mock("./noVoice", () => ({ tellNoVoice: (l: string) => { tellNoVoice(l); } }));
const { say } = await import("./say");

/** The phone's voice reports it has none for the language (speakQueued's 5th argument). */
const phoneHasNone = () => {
  const call = speakQueued.mock.calls.at(-1) as [unknown, unknown, unknown, string, (lang: string) => void];
  call[4](call[3]);
};
/** Kokoro fails before any sound (speakKokoro's 4th argument). */
const kokoroFails = () => (speakKokoro.mock.calls.at(-1) as [unknown, unknown, unknown, () => void])[3]();

describe("say and the Voice setting", () => {
  beforeEach(() => {
    up = true;
    vi.stubGlobal("window", { speechSynthesis: {} });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("App voice: Kokoro speaks the languages it has, the phone the rest", () => {
    say("Toma el tren A.", "es", () => {}, false, "app");
    expect(speakKokoro).toHaveBeenCalledWith("Toma el tren A.", "es", expect.any(Function), expect.any(Function), false);
    expect(speakQueued).not.toHaveBeenCalled();
    say("Сядьте на поезд A.", "ru", () => {}, false, "app");
    expect(speakQueued).toHaveBeenCalledTimes(1);
  });

  it("App voice: the phone takes over when the speech server fails", () => {
    say("Take the A train.", "en", () => {}, false, "app");
    kokoroFails();
    expect(speakQueued).toHaveBeenCalledTimes(1);
  });

  it("My phone's voice: the phone speaks even where Kokoro could", () => {
    say("Toma el tren A.", "es", () => {}, false, "phone");
    expect(speakQueued).toHaveBeenCalledTimes(1);
    expect(speakKokoro).not.toHaveBeenCalled();
  });

  it("My phone's voice: Kokoro steps in where the phone has no voice for the language", () => {
    say("乘坐A线。", "zh", () => {}, false, "phone");
    phoneHasNone();
    expect(speakKokoro).toHaveBeenCalledWith("乘坐A线。", "zh", expect.any(Function), expect.any(Function), false);
    expect(tellNoVoice).not.toHaveBeenCalled();
  });

  it("no voice anywhere: nothing is read, the note is said once and the line ends", () => {
    for (const choice of ["app", "phone"] as const) {
      const onEnd = vi.fn();
      say("Pran tren A a.", "ht", onEnd, false, choice);
      expect(speakKokoro).not.toHaveBeenCalled();
      phoneHasNone();
      expect(tellNoVoice).toHaveBeenLastCalledWith("ht");
      expect(onEnd).toHaveBeenCalledTimes(1);
    }
  });

  it("no voice on the phone and the speech server down: the note, not an English voice", () => {
    up = false;
    const onEnd = vi.fn();
    say("Pran tren A a.", "ht", onEnd, false, "phone");
    phoneHasNone();
    expect(tellNoVoice).toHaveBeenCalledWith("ht");
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});
