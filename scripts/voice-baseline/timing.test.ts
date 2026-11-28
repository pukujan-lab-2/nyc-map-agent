import { describe, expect, it } from "vitest";
import { median, readWav, speechEndSec, turnParts, type Mark } from "./timing";

const wav = (samples: number[], rate: number) => {
  const dv = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const text = (at: number, s: string) => { for (let i = 0; i < s.length; i += 1) dv.setUint8(at + i, s.charCodeAt(i)); };
  text(0, "RIFF"); dv.setUint32(4, 36 + samples.length * 2, true); text(8, "WAVE"); text(12, "fmt ");
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, rate, true);
  dv.setUint32(28, rate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  text(36, "data"); dv.setUint32(40, samples.length * 2, true);
  samples.forEach((x, i) => dv.setInt16(44 + i * 2, Math.round(x * 32767), true));
  return new Uint8Array(dv.buffer);
};

describe("speechEndSec", () => {
  it("ends at the last loud 20 ms window, ignoring the quiet tail", () => {
    const rate = 1000;
    const loud = Array.from({ length: 300 }, (_, i) => (i % 2 ? 0.3 : -0.3));
    expect(speechEndSec([...loud, ...new Array<number>(200).fill(0.001)], rate)).toBeCloseTo(0.3);
  });
  it("is 0 for silence", () => {
    expect(speechEndSec(new Array<number>(500).fill(0), 1000)).toBe(0);
  });
});

describe("readWav", () => {
  it("reads 16-bit mono PCM and its rate", () => {
    const { rate, samples } = readWav(wav([0, 0.5, -0.5], 24000));
    expect(rate).toBe(24000);
    expect(Array.from(samples).map((x) => Math.round(x * 10) / 10)).toEqual([0, 0.5, -0.5]);
  });
  it("refuses something that is not a WAV", () => {
    expect(() => readWav(new Uint8Array(44))).toThrow(/not a WAV/);
  });
});

describe("turnParts", () => {
  const marks: Mark[] = [
    { name: "speech-end", t: 1000 },
    { name: "rec-stop", t: 2200 },
    { name: "stt-sent", t: 2600 },
    { name: "stt-done", t: 4200, text: "Does the 7 stop at 74 Street?" },
    { name: "agent-sent", t: 4300 },
    { name: "tts-sent", t: 6800, text: "One moment, I'm working on it…" },
    { name: "audio-start", t: 7600 },
    { name: "agent-first-text", t: 7800 },
    { name: "agent-done", t: 8100 },
    { name: "tts-sent", t: 8101, text: "Yes, it does." },
    { name: "tts-first-byte", t: 9200 },
    { name: "audio-start", t: 9201 },
  ];
  it("splits a turn and takes the answer's speech, not the still-working line", () => {
    expect(turnParts(marks)).toEqual({
      recordingEnd: 1200, upload: 400, stt: 1600, toAgent: 100, agentFirstToken: 3500, agentRest: 300,
      ttsFirstByte: 1100, playStart: 1, total: 8201, firstSound: 6600, sttCalls: 1,
      heard: "Does the 7 stop at 74 Street?", answer: "Yes, it does.",
    });
  });
  it("leaves a part empty when its step never happened", () => {
    const p = turnParts(marks.slice(0, 2));
    expect(p.recordingEnd).toBe(1200);
    expect(p.total).toBeNull();
    expect(p.answer).toBeNull();
  });
});

describe("median", () => {
  it("skips missing values and averages the middle pair", () => {
    expect(median([4, null, 1, 3, 2])).toBe(3);
    expect(median([null])).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
  });
});
