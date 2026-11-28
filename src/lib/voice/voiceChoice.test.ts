import { describe, expect, it } from "vitest";
import { getVoiceChoice, parseVoiceChoice, readVoiceChoice, setVoiceChoice, VOICE_KEY } from "./voiceChoice";

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

describe("voiceChoice", () => {
  it("is the app voice unless the phone's voice was picked", () => {
    expect(parseVoiceChoice(null)).toBe("app");
    expect(parseVoiceChoice("kokoro")).toBe("app");
    expect(parseVoiceChoice("phone")).toBe("phone");
  });
  it("stays on this phone", () => {
    const s = memory();
    setVoiceChoice("phone", s);
    expect(s.m.get(VOICE_KEY)).toBe("phone");
    expect(readVoiceChoice(s)).toBe("phone");
    expect(getVoiceChoice()).toBe("phone");
    setVoiceChoice("app", s);
    expect(readVoiceChoice(s)).toBe("app");
  });
  it("reads as the app voice when storage is blocked", () => {
    expect(readVoiceChoice({ getItem: () => { throw new Error("blocked"); } })).toBe("app");
  });
});
