import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { resolveFlags } from "@/lib/flags/registry";
import { LiveCallPanel } from "./LiveCallPanel";

const noop = () => {};

describe("the live call in the sheet (pilot)", () => {
  it("is off unless the owner turns it on with ?flags=+liveCall", () => {
    expect(resolveFlags({ advancedMode: false }).liveCall).toBe(false);
    expect(resolveFlags({ advancedMode: true }).liveCall).toBe(false);
    expect(resolveFlags({ advancedMode: false, url: "+liveCall" }).liveCall).toBe(true);
  });

  it("shows Mute and End call, with Mute waiting until the call is up", () => {
    const connecting = renderToStaticMarkup(<LiveCallPanel status="connecting" muted={false} onMute={noop} onEnd={noop} />);
    expect(connecting).toContain("Connecting…");
    expect(connecting).toMatch(/<button[^>]* disabled=""[^>]*>.*Mute/);
    expect(connecting).toContain("End call");
    const live = renderToStaticMarkup(<LiveCallPanel status="live" muted={false} onMute={noop} onEnd={noop} />);
    expect(live).toContain("On a call");
    expect(live).not.toContain(' disabled=""');
    const muted = renderToStaticMarkup(<LiveCallPanel status="live" muted onMute={noop} onEnd={noop} />);
    expect(muted).toContain("Muted");
    expect(muted).toContain("Unmute");
    expect(muted).toContain('aria-pressed="true"');
  });
});
