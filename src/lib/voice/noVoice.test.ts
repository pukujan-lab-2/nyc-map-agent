import { describe, expect, it, vi } from "vitest";
import { noVoiceNote, tellNoVoice } from "./noVoice";

describe("noVoiceNote", () => {
  it("names the language plainly, in the app's language", () => {
    expect(noVoiceNote("ht", "en")).toBe("This phone has no spoken voice for Kreyòl.");
    expect(noVoiceNote("ht", "ht")).toBe("Telefòn sa a pa gen vwa pou li Kreyòl.");
    expect(noVoiceNote("bn-IN", "bn")).toContain("বাংলা");
  });
  it("names a language the app has no words for", () => {
    expect(noVoiceNote("hi-IN", "en")).toBe("This phone has no spoken voice for Hindi.");
  });
});

describe("tellNoVoice", () => {
  it("says it once per language", () => {
    const show = vi.fn();
    expect(tellNoVoice("ht", show)).toBe(true);
    expect(tellNoVoice("ht-HT", show)).toBe(false);
    expect(tellNoVoice("ko", show)).toBe(true);
    expect(show).toHaveBeenCalledTimes(2);
  });
});
