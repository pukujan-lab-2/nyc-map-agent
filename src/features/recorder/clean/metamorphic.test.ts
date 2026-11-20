/**
 * Metamorphic checks on the clean-up, run on Friday's real walk at 14 St-Union Sq.
 * Underground we rarely know where the rider truly was, so most of a recording
 * cannot be scored against the truth. Each test here changes the recording in a
 * way whose effect on the result is known, and checks the result moved as it
 * should. None needs a true position. See docs/PLAN-underground-guidance.md.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseRecording, type HeadingRow, type Recording, type StepRow } from "@/features/recorder/format";
import { LEVELS, LINE, LINE_LEVELS, RIDE_AT, SIGNS, T0 } from "@/features/recorder/replay/unionSq";
import { cleanWalk, deadReckon, distM, findRides, pathAt, type LonLat, type Timed, type XY } from "./index";

const parsed = parseRecording(JSON.parse(readFileSync("public/replay/union-sq-walk.json", "utf8")));
if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
const rec = parsed.recording;
const opts = { levels: LEVELS, rideAt: RIDE_AT, line: LINE, lineLevels: LINE_LEVELS, snapFrom: T0, snapTo: T0 + 600_000 };
const clean = (r: Recording) => cleanWalk(r, opts);
const base = clean(rec);

/** The furthest two cleaned paths are apart, metres, sampled each second between two times. */
function apart(a: readonly Timed<LonLat>[], b: readonly Timed<LonLat>[], from: number, to: number): number {
  let worst = 0;
  for (let t = from; t <= to; t += 1000) worst = Math.max(worst, distM(pathAt(a, t), pathAt(b, t)));
  return worst;
}
const end = (p: readonly Timed<XY>[]): XY => p[p.length - 1].at;
const len = (v: XY) => Math.hypot(v[0], v[1]);

describe("the raw path from steps and heading", () => {
  const raw = deadReckon(rec.steps, rec.heading);

  it("ends in the same place when the same walk is taken at half the pace", () => {
    const t0 = rec.steps[0][0];
    const slow = (t: number) => t0 + (t - t0) * 2;
    const steps = rec.steps.map(([t, c]) => [slow(t), c] as StepRow);
    // The heading keeps its two-second reach around each step, so it is stretched with the steps.
    const heading = rec.heading.map(([t, a, b, g]) => [slow(t), a, b, g] as HeadingRow);
    const slowRaw = deadReckon(steps, heading);
    expect(slowRaw).toHaveLength(raw.length);
    // A step that sat just inside the two-second reach of a heading row can fall outside it once
    // stretched, and is then not moved. A few steps of difference is that, not a change of path.
    expect(len([end(slowRaw)[0] - end(raw)[0], end(slowRaw)[1] - end(raw)[1]])).toBeLessThan(0.05 * len(end(raw)) + 5);
  });

  it("turns as a whole when every heading is turned by the same angle", () => {
    const turn = 70;
    const heading = rec.heading.map(([t, a, b, g]) => [t, (a - turn + 360) % 360, b, g] as HeadingRow);
    const turned = deadReckon(rec.steps, heading);
    const r = (turn * Math.PI) / 180;
    // Compass-style: a clockwise turn of the heading turns east towards south.
    const want: XY = [end(raw)[0] * Math.cos(r) + end(raw)[1] * Math.sin(r), -end(raw)[0] * Math.sin(r) + end(raw)[1] * Math.cos(r)];
    expect(len([end(turned)[0] - want[0], end(turned)[1] - want[1]])).toBeLessThan(0.01);
  });

  it("doubles in size when the step is twice as long", () => {
    const big = deadReckon(rec.steps, rec.heading, 1.4);
    expect(end(big)[0]).toBeCloseTo(end(raw)[0] * 2, 6);
    expect(end(big)[1]).toBeCloseTo(end(raw)[1] * 2, 6);
  });
});

describe("the cleaned path", () => {
  const first = base.fixes[0].t, last = base.fixes[base.fixes.length - 1].t;

  it("does not depend on which way the phone's compass frame points", () => {
    // The recording's heading is in the phone's own frame, not north. Between two fixed points
    // the clean-up turns each stretch to fit, so a different frame must give the same path.
    const heading = rec.heading.map(([t, a, b, g]) => [t, (a + 115) % 360, b, g] as HeadingRow);
    const c = clean({ ...rec, heading });
    expect(apart(c.clean, base.clean, first, last)).toBeLessThan(1);
  });

  it("is not moved by location fixes too poor to pin to", () => {
    const junk = rec.gps.map(([t, lat, lon]) => [t + 500, lat + 0.002, lon - 0.002, 150] as [number, number, number, number]);
    const gps = [...rec.gps, ...junk].sort((a, b) => a[0] - b[0]);
    const c = clean({ ...rec, gps });
    expect(c.fixes).toEqual(base.fixes);
    expect(apart(c.clean, base.clean, first, last)).toBe(0);
  });

  it("finds the same rides when the barometer's zero is somewhere else", () => {
    const baro = rec.baro.map(([t, h]) => [t, h + 37.5] as [number, number]);
    const r = findRides(baro), r0 = findRides(rec.baro);
    expect(r.map((x) => [x.t0, x.t1])).toEqual(r0.map((x) => [x.t0, x.t1]));
    r.forEach((x, k) => expect(x.riseM).toBeCloseTo(r0[k].riseM, 6));
  });

  it("stays on each elevator when one step row in ten is lost", () => {
    const steps = rec.steps.filter((_, k) => k % 10 !== 5);
    const c = clean({ ...rec, steps });
    expect(c.rides).toHaveLength(2);
    expect(distM(pathAt(c.clean, c.rides[0].t0), RIDE_AT[0].from)).toBeLessThan(1);
    expect(distM(pathAt(c.clean, c.rides[1].t0), RIDE_AT[1].from)).toBeLessThan(1);
  });
});

describe("what the recording says about steps (Friday's walk, the numbers the plan quotes)", () => {
  const rides = findRides(rec.baro);
  const count = (t: number) => rec.steps.reduce((c, r) => (r[0] <= t ? r[1] : c), 0);
  const k1 = SIGNS.findIndex((x) => x.id === "us-to-l"), k2 = SIGNS.findIndex((x) => x.id === "us-mural-elevator");
  const lineM = SIGNS.slice(k1 + 1, k2 + 1).reduce((m, x, j) => m + distM(SIGNS[k1 + j].at, x.at), 0);
  const walked = count(rides[1].t0) - count(rides[0].t1);
  const guide = SIGNS.slice(k1, k2).reduce((n, x) => n + x.steps, 0);
  const platform = count(rides[0].t0) - count(T0 + 10_000);

  it("counts 296 steps between the two elevators, on a line the map measures at about 144 m", () => {
    expect(walked).toBe(296);
    expect(Math.round(lineM)).toBe(144);
  });

  it("is 40% over the Walk Guide's own step count for that stretch, and 5% over on the platform", () => {
    expect(guide).toBe(212);
    expect(walked / guide).toBeCloseTo(1.4, 1);
    expect(platform / SIGNS[0].steps).toBeCloseTo(1.05, 2);
  });

  it("overshoots the far elevator by about 63 m at 0.7 m a step, and by about 23 m at the step measured on the platform", () => {
    const platformM = distM(SIGNS[0].at, SIGNS[1].at);
    expect(Math.round(walked * 0.7 - lineM)).toBe(63);
    const measured = walked * (platformM / platform) - lineM;
    expect(measured).toBeGreaterThan(20);
    expect(measured).toBeLessThan(25);
  });
});
