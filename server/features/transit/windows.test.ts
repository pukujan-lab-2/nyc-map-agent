import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { slimAlert, windowsAhead, type MercuryAlert } from "./alerts";

// The MTA's 7 train notices as its feed served them on 2026-11-27, trimmed to the fields that matter here.
const feed = JSON.parse(readFileSync(new URL("./__fixtures__/seven-windows.json", import.meta.url), "utf8")) as MercuryAlert[];
const byId = (id: string) => feed.find((e) => e.id === id)!;
const BASE = "lmm:planned_work:31498"; // Flushing-bound 7 skips 52 St and 69 St
const WEEKEND = "lmm:planned_work:36304"; // ... and 74 St to 111 St, Sat 6:45 AM to Sun 4 PM
const RUSH = "lmm:planned_work:31871"; // Manhattan-bound 7 and 7X stop at 74 St, rush hours only

const ny = (y: number, m: number, d: number, h: number, min = 0) => Date.UTC(y, m - 1, d, h + 5, min) / 1000; // November is EST
const THU_NIGHT = ny(2026, 11, 26, 22);
const SAT_NOON = ny(2026, 11, 28, 12);
const SUN_EVENING = ny(2026, 11, 29, 18);
const covers = (w: Array<[number, number]>, t: number) => w.some(([s, e]) => s <= t && (!e || e >= t));

describe("every window of a notice", () => {
  it("keeps the pause in the 52 St skip while the bigger weekend skip runs", () => {
    const a = slimAlert(byId(BASE), THU_NIGHT)!;
    expect(a.windows).toHaveLength(3);
    // Saturday noon the base notice is paused and the weekend one is in effect: the walk must say 74 St is skipped.
    expect(covers(a.windows!, SAT_NOON)).toBe(false);
    expect(covers(slimAlert(byId(WEEKEND), THU_NIGHT, SUN_EVENING)!.windows!, SAT_NOON)).toBe(true);
    // Sunday evening the base skip is back.
    expect(covers(a.windows!, SUN_EVENING)).toBe(true);
  });

  it("carries a rush-hour notice's separate windows instead of one that reads as always", () => {
    const a = slimAlert(byId(RUSH), ny(2026, 11, 20, 7))!;
    expect(a.windows!.length).toBeGreaterThan(5);
    // Friday 8 AM is inside a window, Friday noon is not.
    expect(covers(a.windows!, ny(2026, 11, 20, 8))).toBe(true);
    expect(covers(a.windows!, ny(2026, 11, 20, 12))).toBe(false);
  });

  it("keeps the first overlapping window as start and end, as before", () => {
    const a = slimAlert(byId(WEEKEND), THU_NIGHT, ny(2026, 11, 30, 5))!;
    expect([a.start, a.end]).toEqual([ny(2026, 11, 28, 6, 45), ny(2026, 11, 29, 16)]);
  });

  it("leaves out windows that ended, ones past three weeks, and a single window", () => {
    const now = 1_000_000;
    expect(windowsAhead([{ start: 0, end: now - 1 }, { start: now + 10, end: now + 20 }, { start: now + 30, end: now + 40 }], now)).toEqual([[now + 10, now + 20], [now + 30, now + 40]]);
    expect(windowsAhead([{ start: now + 10, end: now + 20 }, { start: now + 22 * 86_400, end: 0 }], now)).toBeUndefined();
    expect(windowsAhead([{ start: now - 5 }], now)).toBeUndefined();
  });
});
