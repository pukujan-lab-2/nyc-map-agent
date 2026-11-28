import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/store/MapStateContext", () => ({ useMapState: () => ({ seedChat: () => {}, setChatOpen: () => {} }) }));
vi.mock("./hooks", () => ({ useTransitData: () => ({}), useAlerts: () => ({ data: undefined }), useAlertsBetween: () => ({ data: undefined, isLoading: false }), useNow: () => 0 }));

const { LinePanel } = await import("./LinePanel");
const { sendScreen } = await import("@/lib/screen/screenSpace");
const render = () => renderToStaticMarkup(<LinePanel map={undefined} route="A" onFollow={() => {}} />);

describe("line panel and the answer (docs/PDD.md, Screen space)", () => {
  // Server rendering runs no effects, so the test reports the open line itself.
  beforeEach(() => sendScreen({ type: "LINE", on: true }));
  afterEach(() => { sendScreen({ type: "ANSWER", on: false }); sendScreen({ type: "LINE", on: false }); sendScreen({ type: "SIZE", size: "phone" }); });

  // One sheet (owner, 2026-11-27): the line is a view over the answer, not a pill folded beside it.
  it("is a view of the one sheet while an answer is open", () => {
    sendScreen({ type: "ANSWER", on: true });
    const html = render();
    expect(html).toMatch(/<section data-testid="line-panel"[^>]*class="task-panel pull-sheet"/);
    expect(html).toContain('data-testid="line-body"');
  });

  it("opens as a sheet over the chat on a phone with no answer", () => {
    const html = render();
    expect(html).toMatch(/<section data-testid="line-panel" data-level="1"[^>]*class="task-panel pull-sheet"/);
    expect(html).toMatch(/data-testid="line-body" class="pull-sheet-body/);
    expect(html).toContain("Follow a train");
  });

  it("never docks to the right from 640 px: it is the same sheet view, which PullSheet puts in the left card", () => {
    sendScreen({ type: "SIZE", size: "wide" });
    sendScreen({ type: "ANSWER", on: true });
    const html = render();
    expect(html).toMatch(/data-testid="line-body" class="pull-sheet-body/);
    expect(html).not.toContain("sm:left-auto");
  });

  it("shows four time buttons with the one for the New York time now picked, and its dates under them", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-27T03:10:00Z")); // Thursday 10:10 PM in New York
    try {
      const html = render();
      const buttons = [...html.matchAll(/<button type="button" aria-pressed="(true|false)" data-period="(\w+)"/g)].map((m) => [m[2], m[1]]);
      expect(buttons).toEqual([["day", "false"], ["night", "true"], ["weekendDay", "false"], ["weekendNight", "false"]]);
      expect(html).toContain("Now, until Fri 6 AM");
    } finally {
      vi.useRealTimers();
    }
  });
});
