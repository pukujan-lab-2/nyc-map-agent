import { describe, expect, it } from "vitest";
import { askKokoro } from "./say";

describe("askKokoro", () => {
  it("asks whenever the speech server is up", () => {
    expect(askKokoro(true, false, true)).toBe(true);
    expect(askKokoro(true, true, false)).toBe(true);
  });

  it("with the server marked down, asks only for a kept line with no signal, where the phone's copy answers", () => {
    expect(askKokoro(false, true, false)).toBe(true);
    // A notice's steps are kept (#218): with a signal they go to the browser voice at once, not one failed wait a step.
    expect(askKokoro(false, true, true)).toBe(false);
    expect(askKokoro(false, false, false)).toBe(false);
  });
});
