/**
 * Reads the pattern of a NaviLens code from a camera frame: a square of five by
 * five cells, each cyan, magenta, yellow or black, inside a black border and a
 * white frame. It does not decode what a code means to NaviLens and talks to
 * none of their services; it only tells one code from another, so the Walk
 * Guide can look the pattern up in our own table of checkpoints (codes.ts).
 *
 * A first, close-range reader: the code should fill a fair part of the frame
 * and be held within about 30 degrees of upright. Pure: no camera, no DOM.
 * See README.md in this folder before using or removing it.
 */

/** A frame's pixels, four bytes each (red, green, blue, alpha), row by row, as a canvas gives them. */
export interface Pixels { width: number; height: number; data: ArrayLike<number> }
export type Cell = "C" | "M" | "Y" | "K";
type Pt = [x: number, y: number];
/** The black square's corners in the frame: top left, top right, bottom right, bottom left. */
type Quad = [Pt, Pt, Pt, Pt];
interface Read { pattern: string; corners: Quad }

/** Cells along one side of a code. */
export const SIDE = 5;
/** The black square is the cells plus a border one cell wide on each side. */
const UNITS = SIDE + 2;
/** The longest side the search runs on; a bigger frame is sampled down to it. */
const SEARCH_PX = 240;
/** The hues NaviLens prints, degrees: yellow, cyan, magenta. */
const HUES: [Cell, number][] = [["Y", 56], ["C", 198], ["M", 331]];

const rgbAt = (px: Pixels, x: number, y: number): [number, number, number] | null => {
  const xi = Math.round(x), yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= px.width || yi >= px.height) return null;
  const k = (yi * px.width + xi) * 4;
  return [px.data[k], px.data[k + 1], px.data[k + 2]];
};

/** How bright the frame's whites are (the 95th percentile of the brightest channel), so a dim photo reads like a bright one. */
function whiteLevel(px: Pixels, step: number): number {
  const seen = new Array<number>(256).fill(0);
  let n = 0;
  for (let y = 0; y < px.height; y += step) for (let x = 0; x < px.width; x += step) {
    const k = (y * px.width + x) * 4;
    seen[Math.max(px.data[k], px.data[k + 1], px.data[k + 2])]++;
    n++;
  }
  let left = n * 0.05;
  for (let v = 255; v > 0; v--) { left -= seen[v]; if (left <= 0) return Math.max(40, v); }
  return 255;
}

/** Which of the four inks a colour is, given how bright white is in this frame. */
export function classify(r: number, g: number, b: number, white = 255): Cell {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max < white * 0.42) return "K";
  // A grey with no colour in it is a faded black or a glare, never one of the three inks.
  if (max - min < max * 0.18) return max < white * 0.6 ? "K" : "Y";
  let hue = max === r ? ((g - b) / (max - min)) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
  hue = (hue * 60 + 360) % 360;
  const off = (a: number) => Math.min(Math.abs(hue - a), 360 - Math.abs(hue - a));
  return HUES.reduce((best, h) => (off(h[1]) < off(best[1]) ? h : best))[0];
}

/** Maps the unit square onto a quad, straight lines staying straight (a homography), so a tilted code is read squarely. */
function mapper(q: Quad): (u: number, v: number) => Pt {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  let g = 0, h = 0;
  if (Math.abs(sx) > 1e-9 || Math.abs(sy) > 1e-9) {
    const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
    const den = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(den) > 1e-9) { g = (sx * dy2 - dx2 * sy) / den; h = (dx1 * sy - sx * dy1) / den; }
  }
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, d = y1 - y0 + g * y1, e = y3 - y0 + h * y3;
  return (u, v) => {
    const w = g * u + h * v + 1;
    return [(a * u + b * v + x0) / w, (d * u + e * v + y0) / w];
  };
}

/** The average colour of a small patch around a point of the unit square. */
function patch(px: Pixels, at: (u: number, v: number) => Pt, u: number, v: number, reach: number): [number, number, number] | null {
  let r = 0, g = 0, b = 0, n = 0;
  for (const du of [-reach, 0, reach]) for (const dv of [-reach, 0, reach]) {
    const p = at(u + du, v + dv);
    const c = rgbAt(px, p[0], p[1]);
    if (!c) continue;
    r += c[0]; g += c[1]; b += c[2]; n++;
  }
  return n >= 5 ? [r / n, g / n, b / n] : null;
}

/**
 * The 25 cells of the code whose black square has these corners, row by row
 * from the top left, or null when the quad is not a code: its border must be
 * black all round, the frame outside it white, and its cells must hold at
 * least two of the three inks. A dark sign with one bright stripe passes the
 * first two tests; a real code is never one colour.
 */
function readCells(px: Pixels, corners: Quad, white = whiteLevel(px, Math.max(1, Math.round(Math.max(px.width, px.height) / SEARCH_PX)))): string | null {
  const at = mapper(corners);
  const unit = 1 / UNITS;
  let ring = 0, ringOk = 0, frame = 0, frameOk = 0;
  for (let k = 0; k < UNITS; k++) {
    const t = (k + 0.5) * unit;
    for (const [u, v] of [[t, 0.5 * unit], [t, 1 - 0.5 * unit], [0.5 * unit, t], [1 - 0.5 * unit, t]] as Pt[]) {
      const c = patch(px, at, u, v, unit * 0.15);
      ring++;
      if (c && classify(c[0], c[1], c[2], white) === "K") ringOk++;
    }
    for (const [u, v] of [[t, -0.5 * unit], [t, 1 + 0.5 * unit], [-0.5 * unit, t], [1 + 0.5 * unit, t]] as Pt[]) {
      const c = patch(px, at, u, v, unit * 0.15);
      frame++;
      // White: bright, and with no colour of its own.
      if (c && Math.min(c[0], c[1], c[2]) > white * 0.62 && Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]) < Math.max(c[0], c[1], c[2]) * 0.25) frameOk++;
    }
  }
  if (ringOk < ring * 0.9 || frameOk < frame * 0.75) return null;
  let out = "";
  const inks = new Set<Cell>();
  for (let row = 0; row < SIDE; row++) for (let col = 0; col < SIDE; col++) {
    const c = patch(px, at, (1.5 + col) * unit, (1.5 + row) * unit, unit * 0.2);
    if (!c) return null;
    const cell = classify(c[0], c[1], c[2], white);
    if (cell !== "K") inks.add(cell);
    out += cell;
  }
  return inks.size >= 2 ? out : null;
}

/**
 * Finds a code in the frame and reads its pattern, or null when there is none
 * it is sure of. It looks for a dark region whose four outermost points make a
 * square-ish quad, then lets readCells decide whether that is a code.
 */
export function readCode(px: Pixels): Read | null {
  const step = Math.max(1, Math.round(Math.max(px.width, px.height) / SEARCH_PX));
  const w = Math.floor(px.width / step), h = Math.floor(px.height / step);
  if (w < 16 || h < 16) return null;
  const white = whiteLevel(px, step);
  const dark = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = (y * step * px.width + x * step) * 4;
    if (Math.max(px.data[k], px.data[k + 1], px.data[k + 2]) < white * 0.42) dark[y * w + x] = 1;
  }
  const found: { area: number; quad: Quad }[] = [];
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (dark[start] !== 1) continue;
    let area = 0;
    // The four outermost points: least and most of x + y, and of x - y.
    let tl = start, br = start, tr = start, bl = start;
    const sum = (i: number) => (i % w) + Math.floor(i / w), diff = (i: number) => (i % w) - Math.floor(i / w);
    stack.push(start);
    dark[start] = 2;
    while (stack.length) {
      const i = stack.pop()!;
      area++;
      if (sum(i) < sum(tl)) tl = i;
      if (sum(i) > sum(br)) br = i;
      if (diff(i) > diff(tr)) tr = i;
      if (diff(i) < diff(bl)) bl = i;
      const x = i % w, y = Math.floor(i / w);
      if (x > 0 && dark[i - 1] === 1) { dark[i - 1] = 2; stack.push(i - 1); }
      if (x < w - 1 && dark[i + 1] === 1) { dark[i + 1] = 2; stack.push(i + 1); }
      if (y > 0 && dark[i - w] === 1) { dark[i - w] = 2; stack.push(i - w); }
      if (y < h - 1 && dark[i + w] === 1) { dark[i + w] = 2; stack.push(i + w); }
    }
    if (area < 80) continue;
    // Corners at the outer edge of each corner pixel, back in the frame's own pixels.
    const pt = (i: number, dx: number, dy: number): Pt => [((i % w) + dx) * step, (Math.floor(i / w) + dy) * step];
    found.push({ area, quad: [pt(tl, 0, 0), pt(tr, 1, 0), pt(br, 1, 1), pt(bl, 0, 1)] });
  }
  found.sort((a, b) => b.area - a.area);
  for (const f of found.slice(0, 12)) {
    const pattern = readCells(px, f.quad, white);
    if (pattern) return { pattern, corners: f.quad };
  }
  return null;
}

/** The pattern as it reads with the code turned a quarter turn clockwise. */
export function turned(pattern: string): string {
  let out = "";
  for (let row = 0; row < SIDE; row++) for (let col = 0; col < SIDE; col++) out += pattern[(SIDE - 1 - col) * SIDE + row];
  return out;
}

/**
 * The checkpoint a read pattern stands for in our own table, whichever way up
 * the phone was held, or null when the table does not hold it. Exact matches
 * only: a pattern one cell off is treated as a code we do not know.
 */
export function checkpointFor(pattern: string, table: Readonly<Record<string, string>>): string | null {
  let p = pattern;
  for (let k = 0; k < 4; k++) {
    if (Object.hasOwn(table, p)) return table[p];
    p = turned(p);
  }
  return null;
}
