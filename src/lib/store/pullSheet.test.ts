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
});
