import { describe, expect, it, vi } from "vitest";
import { onRestroomPick, requestRestroomPick } from "./restroomPick";

describe("restroom pick request", () => {
  it("falls back when the restrooms feature is off and nothing listens", () => {
    expect(requestRestroomPick(false)).toBe(false);
  });
  it("opens at once when the overlay listens", () => {
    const open = vi.fn();
    const off = onRestroomPick(open);
    expect(requestRestroomPick(true)).toBe(true);
    expect(open).toHaveBeenCalledTimes(1);
    off();
  });
  it("keeps a tap that comes before the lazy overlay loads, and opens the pick once it does", () => {
    expect(requestRestroomPick(true)).toBe(true);
    const open = vi.fn();
    const off = onRestroomPick(open);
    expect(open).toHaveBeenCalledTimes(1);
    off();
    // Consumed: the next registration does not open it again.
    const again = vi.fn();
    onRestroomPick(again)();
    expect(again).not.toHaveBeenCalled();
  });
});
