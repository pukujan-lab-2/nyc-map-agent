/**
 * A held-back check on the evening walk through 14 St-Union Sq (2026-11-13,
 * street to platform: the afternoon route the other way). That evening the
 * phone kept getting a location below ground, good to about 18 metres, so this
 * is the one walk where the clean-up can be scored against places it was not
 * given. The fixes are held back, the walk is cleaned, and the result is
 * measured against them.
 *
 * Read the numbers with two cautions. The fixes themselves are only good to
 * about 18 m. And the Walk Guide's line across the mezzanine was laid from
 * this same evening's fixes, so they sit near the line by construction; what
 * is tested is where along it the walker is put at each moment.
 */
import { describe, expect, it } from "vitest";
import { parseRecording, type HeadingRow } from "@/features/recorder/format";
import { cleanWalk, distM, findRides, pathAt, type LonLat } from "@/features/recorder/clean";
import evening from "./evening-union-sq.json";
import { LINE, LINE_LEVELS, RIDE_AT } from "./unionSq";

const parsed = parseRecording(evening);
if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
const rec = parsed.recording;
const rides = findRides(rec.baro);

// The afternoon's line and elevators, walked the other way: street, mezzanine, platform.
const line = [...LINE].reverse();
const below = LINE_LEVELS.slice(0, -1).reverse();
const lineLevels = [...below, below[below.length - 1]];
const rideAt = [{ from: RIDE_AT[1].to, to: RIDE_AT[1].from }, { from: RIDE_AT[0].to, to: RIDE_AT[0].from }];
const opts = { levels: ["street", "mezzanine", "platform"], rideAt, line, lineLevels, snapFrom: rides[0].t0, snapTo: rec.baro[rec.baro.length - 1][0] };

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];
/** Good fixes on the mezzanine, between the two rides; every second one is held back. */
const mezzanine = rec.gps.filter((g) => g[3] > 0 && g[3] <= 20 && g[0] >= rides[0].t1 && g[0] <= rides[1].t0);
const held = mezzanine.filter((_, k) => k % 2 === 1);
const without = (drop: typeof mezzanine) => ({ ...rec, gps: rec.gps.filter((g) => !drop.some((h) => h[0] === g[0])) });
const errors = (at: (t: number) => LonLat) => held.map((g) => distM(at(g[0]), [g[2], g[1]]));

describe("the evening walk, cleaned and scored against fixes it was not given", () => {
  it("has two rides down and 76 good fixes on the mezzanine, half of them held back", () => {
    expect(rides.map((r) => r.riseM < 0)).toEqual([true, true]);
    expect(mezzanine).toHaveLength(76);
    expect(held).toHaveLength(38);
    expect(median(held.map((g) => g[3]))).toBeGreaterThan(15);
  });

  it("lands within about 5 m of the held-back fixes when it is given the other half", () => {
    const c = cleanWalk(without(held), opts);
    expect(c.gaps).toEqual([]);
    expect(median(errors((t) => pathAt(c.clean, t)))).toBeLessThan(8);
  });

  it("is about 36 m off with no location at all below ground: the two elevators are not enough", () => {
    // The number to beat. The path is on the line throughout; it is in the wrong place along it.
    const c = cleanWalk(without(mezzanine), opts);
    const e = errors((t) => pathAt(c.clean, t));
    expect(median(e)).toBeGreaterThan(25);
    expect(median(e)).toBeLessThan(45);
    expect(c.clean.filter((p) => p.t >= rides[0].t1 && p.t <= rides[1].t0).every((p) => p.snapped)).toBe(true);
  });

  it("does a little better the Walk Guide's way: along the line by the share of steps taken", () => {
    const a = line.findIndex((q) => distM(q, rideAt[0].to) < 1), b = line.findIndex((q) => distM(q, rideAt[1].from) < 1);
    const path = line.slice(a, b + 1);
    const lens = path.slice(1).map((q, k) => distM(path[k], q));
    const total = lens.reduce((x, y) => x + y, 0);
    const count = (t: number) => rec.steps.reduce((c, r) => (r[0] <= t ? r[1] : c), 0);
    const c0 = count(rides[0].t1), c1 = count(rides[1].t0);
    const at = (t: number): LonLat => {
      let left = Math.max(0, Math.min(1, (count(t) - c0) / (c1 - c0))) * total;
      for (let k = 0; k < lens.length; k++) {
        if (left <= lens[k] || k === lens.length - 1) {
          const f = lens[k] ? Math.min(1, left / lens[k]) : 0;
          return [path[k][0] + (path[k + 1][0] - path[k][0]) * f, path[k][1] + (path[k + 1][1] - path[k][1]) * f];
        }
        left -= lens[k];
      }
      return path[path.length - 1];
    };
    const byShare = median(errors(at));
    const cleaned = median(errors((t) => pathAt(cleanWalk(without(mezzanine), opts).clean, t)));
    expect(byShare).toBeGreaterThan(20);
    expect(byShare).toBeLessThan(32);
    expect(byShare).toBeLessThan(cleaned);
  });

  it("comes out the same whichever way the phone's compass frame faced", () => {
    const base = cleanWalk(rec, opts);
    const turned = cleanWalk({ ...rec, heading: rec.heading.map(([t, a, b, g]) => [t, (a + 115) % 360, b, g] as HeadingRow) }, opts);
    let worst = 0;
    for (let t = base.fixes[0].t; t <= base.fixes[base.fixes.length - 1].t; t += 1000) worst = Math.max(worst, distM(pathAt(base.clean, t), pathAt(turned.clean, t)));
    expect(worst).toBeLessThan(1);
  });
});
