import { describe, expect, it } from "vitest";
import { CODES } from "./codes";
import { checkpointFor, classify, readCode, SIDE, turned, type Cell, type Pixels } from "./read";

const INK: Record<Cell, [number, number, number]> = { C: [0x5b, 0xc5, 0xf2], M: [0xe8, 0x31, 0x8a], Y: [0xff, 0xed, 0x00], K: [0, 0, 0] };
/** A small repeatable random number, so a failing picture can be drawn again. */
function rng(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
const randomPattern = (seed: number) => { const r = rng(seed); return Array.from({ length: SIDE * SIDE }, () => "CMYK"[Math.floor(r() * 4)]).join(""); };

interface Shot { width?: number; height?: number; size: number; cx?: number; cy?: number; turnDeg?: number; squash?: number; light?: number; noise?: number; seed?: number; background?: [number, number, number] }
/**
 * A made-up photo of a code: the pattern drawn `size` pixels wide (white frame
 * included), turned, squashed sideways as if seen from the side, dimmed and
 * speckled, on a plain wall.
 */
function shoot(pattern: string, { width = 640, height = 480, size, cx = width / 2, cy = height / 2, turnDeg = 0, squash = 1, light = 1, noise = 0, seed = 1, background = [120, 126, 118] }: Shot): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  const r = rng(seed), a = (turnDeg * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a), unit = size / 9;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    // Back from the photo to the code's own grid of nine units (frame, border, five cells, border, frame).
    const dx = (x + 0.5 - cx) / squash, dy = y + 0.5 - cy;
    const u = (dx * cos + dy * sin) / unit + 4.5, v = (-dx * sin + dy * cos) / unit + 4.5;
    let c = background;
    if (u >= 0 && u < 9 && v >= 0 && v < 9) {
      const col = Math.floor(u), row = Math.floor(v);
      if (col === 0 || col === 8 || row === 0 || row === 8) c = [255, 255, 255];
      else if (col === 1 || col === 7 || row === 1 || row === 7) c = [0, 0, 0];
      else c = INK[pattern[(row - 2) * SIDE + (col - 2)] as Cell];
    }
    const k = (y * width + x) * 4;
    for (let j = 0; j < 3; j++) data[k + j] = c[j] * light + (r() - 0.5) * 2 * noise;
    data[k + 3] = 255;
  }
  return { width, height, data };
}

describe("telling the four inks apart", () => {
  it("names each ink as printed, and still does in a dim photo", () => {
    for (const cell of ["C", "M", "Y", "K"] as Cell[]) {
      const [r, g, b] = INK[cell];
      expect(classify(r, g, b)).toBe(cell);
      expect(classify(r * 0.45, g * 0.45, b * 0.45, 255 * 0.45)).toBe(cell);
    }
  });
});

describe("reading a code from a photo", () => {
  const pattern = "MKYCCYYMKCKCYMYCMKYYYCKMC";

  it("reads the pattern of a code seen straight on", () => {
    expect(readCode(shoot(pattern, { size: 220 }))?.pattern).toBe(pattern);
  });

  it("reads twenty different codes, each as itself", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const p = randomPattern(seed);
      // A code with almost no colour in it is not one the reader accepts; skip the rare made-up one.
      if ([...p].filter((c) => c !== "K").length < 3) continue;
      expect(readCode(shoot(p, { size: 200, seed }))?.pattern, `pattern ${p}`).toBe(p);
    }
  });

  it("reads it small, off centre, in a large frame", () => {
    expect(readCode(shoot(pattern, { width: 1280, height: 960, size: 150, cx: 930, cy: 300 }))?.pattern).toBe(pattern);
  });

  it("reads it tilted up to 25 degrees either way", () => {
    for (const turnDeg of [-25, -12, 8, 25]) expect(readCode(shoot(pattern, { size: 220, turnDeg }))?.pattern, `turned ${turnDeg}`).toBe(pattern);
  });

  it("reads it seen from the side, squashed to 60% of its width", () => {
    expect(readCode(shoot(pattern, { size: 240, squash: 0.6 }))?.pattern).toBe(pattern);
  });

  it("reads it in poor light with a speckled picture", () => {
    expect(readCode(shoot(pattern, { size: 220, light: 0.5, noise: 14 }))?.pattern).toBe(pattern);
  });

  it("gives the same pattern however the photo is changed (no true answer needed)", () => {
    const base = readCode(shoot(pattern, { size: 220 }))!.pattern;
    for (const shot of [{ size: 160 }, { size: 300 }, { size: 220, light: 0.7 }, { size: 220, cx: 200, cy: 300 }, { size: 220, turnDeg: 10, noise: 8 }]) {
      expect(readCode(shoot(pattern, shot))?.pattern).toBe(base);
    }
  });

  it("finds nothing on a blank wall, in a framed square that is all black, or in a square whose frame is not white", () => {
    expect(readCode(shoot(pattern, { size: 0.001 }))).toBeNull();
    expect(readCode(shoot("K".repeat(25), { size: 220 }))).toBeNull();
    const noFrame = shoot(pattern, { size: 220 });
    // Paint the white frame red: a dark box with colours in it, but not a code.
    for (let k = 0; k < noFrame.data.length; k += 4) {
      const d = noFrame.data as Uint8ClampedArray;
      if (d[k] === 255 && d[k + 1] === 255 && d[k + 2] === 255) { d[k] = 200; d[k + 1] = 60; d[k + 2] = 60; }
    }
    expect(readCode(noFrame)).toBeNull();
  });
});

describe("looking a pattern up in our own table", () => {
  const pattern = "MKYCCYYMKCKCYMYCMKYYYCKMC";
  const table = { [pattern]: "us-yellow" };

  it("finds the checkpoint whichever way up the phone was held", () => {
    expect(turned(turned(turned(turned(pattern))))).toBe(pattern);
    let p = pattern;
    for (let k = 0; k < 4; k++) { expect(checkpointFor(p, table)).toBe("us-yellow"); p = turned(p); }
    expect(readCode(shoot(turned(pattern), { size: 220 }))?.pattern).toBe(turned(pattern));
  });

  it("does not guess: a pattern one cell off is a code we do not know", () => {
    expect(checkpointFor("C" + pattern.slice(1), table)).toBeNull();
    expect(checkpointFor(pattern, {})).toBeNull();
  });
});

describe("our table of codes", () => {
  it("holds only whole patterns, and no two that are the same code turned round", () => {
    const seen = new Set<string>();
    for (const pattern of Object.keys(CODES)) {
      expect(pattern).toMatch(/^[CMYK]{25}$/);
      let p = pattern;
      for (let k = 0; k < 4; k++) { expect(seen.has(p), `${pattern} is already in the table, turned`).toBe(false); p = turned(p); }
      seen.add(pattern);
    }
  });
});
