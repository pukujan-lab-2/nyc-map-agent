import { describe, expect, it, vi } from "vitest";
import { createActor } from "xstate";
import { closeSheets, openNextUnderTop, pullSheetMounted, raiseSheet, sheetBack } from "./sheet";
import { sheetHeight, sheetMachine, shownBanner, viewPlace, type SheetEvent } from "./sheetMachine";

const noop = () => {};
const open = (id: number, tag?: string, now = 0): SheetEvent => ({ type: "OPEN", id, close: noop, tag, now });

function run(...events: SheetEvent[]) {
  const actor = createActor(sheetMachine, { input: {} }).start();
  events.forEach((e) => actor.send(e));
  return actor.getSnapshot().context;
}
const order = (...events: SheetEvent[]) => run(...events).views.map((v) => v.id);

describe("the one sheet's views", () => {
  it("closes every view, newest first, and leaves nothing up", () => {
    const order: string[] = [];
    const station = pullSheetMounted(() => { order.push("station"); station.release(); });
    const line = pullSheetMounted(() => { order.push("line"); line.release(); });
    closeSheets();
    expect(order).toEqual(["line", "station"]);
    const again = vi.fn();
    const next = pullSheetMounted(again);
    next.release();
    closeSheets();
    expect(again).not.toHaveBeenCalled();
  });

  it("Back takes only the top view off", () => {
    const closed: string[] = [];
    const station = pullSheetMounted(() => { closed.push("station"); station.release(); });
    const line = pullSheetMounted(() => { closed.push("line"); line.release(); });
    sheetBack();
    expect(closed).toEqual(["line"]);
    sheetBack();
    expect(closed).toEqual(["line", "station"]);
    sheetBack();
    expect(closed).toEqual(["line", "station"]);
  });

  it("brings a view back to the top without a second copy", () => {
    const order: string[] = [];
    const answer = pullSheetMounted(() => { order.push("answer"); answer.release(); });
    const line = pullSheetMounted(() => { order.push("line"); line.release(); });
    raiseSheet(answer.id);
    closeSheets();
    expect(order).toEqual(["answer", "line"]);
  });

  it("puts the next view under the one showing when asked, once and only for a second", () => {
    const order: string[] = [];
    const answer = pullSheetMounted(() => { order.push("answer"); answer.release(); });
    openNextUnderTop(1000);
    const line = pullSheetMounted(() => { order.push("line"); line.release(); }, 1500);
    openNextUnderTop(1000);
    const late = pullSheetMounted(() => { order.push("late"); late.release(); }, 2500);
    closeSheets();
    expect(order).toEqual(["late", "answer", "line"]);
  });

  it("opens the first view on top even when asked to go under", () => {
    expect(order({ type: "OPEN_UNDER", now: 0 }, open(1, undefined, 10), open(2, undefined, 20))).toEqual([1, 2]);
  });

  it("raises a view by its tag, and ignores a tag that is not up", () => {
    expect(order(open(1, "line:7"), open(2), { type: "RAISE_TAG", tag: "line:7" })).toEqual([2, 1]);
    expect(order(open(1, "line:7"), open(2), { type: "RAISE_TAG", tag: "line:Q" })).toEqual([1, 2]);
  });

  it("knows which view shows and whether one waits under it", () => {
    const c = run(open(1), open(2));
    expect(viewPlace(c, 1)).toEqual({ top: false, below: false });
    expect(viewPlace(c, 2)).toEqual({ top: true, below: true });
    expect(viewPlace(c, null)).toEqual({ top: false, below: false });
    expect(viewPlace(run(open(1), open(2), { type: "RELEASE", id: 2 }), 1)).toEqual({ top: true, below: false });
  });
});

describe("the sheet's height", () => {
  it("is the top view's: peek, half or full", () => {
    expect(sheetHeight(run(open(1), { type: "LEVEL", id: 1, level: 0 }))).toBe("peek");
    expect(sheetHeight(run(open(1), { type: "LEVEL", id: 1, level: 1 }))).toBe("half");
    expect(sheetHeight(run(open(1), { type: "LEVEL", id: 1, level: 2 }))).toBe("full");
  });

  it("follows the view on top, and comes back with Back", () => {
    const events: SheetEvent[] = [open(1), { type: "LEVEL", id: 1, level: 2 }, open(2), { type: "LEVEL", id: 2, level: 0 }];
    expect(sheetHeight(run(...events))).toBe("peek");
    expect(sheetHeight(run(...events, { type: "LEVEL", id: 1, level: 1 }))).toBe("peek");
    expect(sheetHeight(run(...events, { type: "RELEASE", id: 2 }))).toBe("full");
  });

  it("sets none for a view that has no levels (the answer) or an empty sheet", () => {
    expect(sheetHeight(run())).toBeNull();
    expect(sheetHeight(run(open(1), { type: "LEVEL", id: 1, level: 2 }, open(2)))).toBeNull();
  });
});

describe("the navigation banner", () => {
  it("shows the newest banner, and the older one again when it ends", () => {
    const walk: SheetEvent = { type: "BANNER", banner: "walk", on: true };
    const follow: SheetEvent = { type: "BANNER", banner: "follow", on: true };
    expect(shownBanner(run())).toBeNull();
    expect(shownBanner(run(walk))).toBe("walk");
    expect(shownBanner(run(walk, follow))).toBe("follow");
    expect(shownBanner(run(walk, follow, { type: "BANNER", banner: "follow", on: false }))).toBe("walk");
    expect(shownBanner(run(walk, follow, walk))).toBe("walk");
  });
});

describe("the left card and the details slot", () => {
  it("keeps the left card's places, changing only what was sent", () => {
    const el = {} as HTMLElement;
    const c = run({ type: "LEFT", column: { slot: el } }, { type: "LEFT", column: { sheet: true } });
    expect(c.column).toEqual({ slot: el, sheet: true, chips: null });
  });

  it("runs the slot rules on SLOT", () => {
    const c = run({ type: "SLOT", action: { type: "showSheet" } }, { type: "SLOT", action: { type: "openDrawer" } }, { type: "SLOT", action: { type: "dismissTop" } });
    expect(c.slot).toEqual({ drawerOpen: false, sheet: true, minimized: false });
  });
});
