import { describe, expect, it, vi } from "vitest";
import { closeSheets, openNextUnderTop, pullSheetMounted, raiseSheet } from "./pullSheet";

describe("the phone's one sheet", () => {
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

  it("brings a view back to the top without a second copy", () => {
    const order: string[] = [];
    const answer = pullSheetMounted(() => { order.push("answer"); answer.release(); });
    const line = pullSheetMounted(() => { order.push("line"); line.release(); });
    raiseSheet(answer.id);
    closeSheets();
    expect(order).toEqual(["answer", "line"]);
  });

  it("puts the asked-for view under the one showing, however long it takes to come up, and only that view", () => {
    const order: string[] = [];
    const answer = pullSheetMounted(() => { order.push("answer"); answer.release(); });
    openNextUnderTop("line:7", 1000);
    // Another view first: it still goes on top.
    const station = pullSheetMounted(() => { order.push("station"); station.release(); }, 1100, "map:station");
    // The line's code took eight seconds to load: it still goes under.
    const line = pullSheetMounted(() => { order.push("line"); line.release(); }, 9000, "line:7");
    // Only once.
    const again = pullSheetMounted(() => { order.push("again"); again.release(); }, 9500, "line:7");
    closeSheets();
    expect(order).toEqual(["again", "station", "line", "answer"]);
  });
});
