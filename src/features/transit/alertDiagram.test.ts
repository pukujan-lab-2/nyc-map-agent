import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { alertDiagram, cleanAlertText, isGap, shortNotice, type AlertDiagram, type DiagramStop } from "./alertDiagram";
import type { TransitAlert } from "./hooks";
import type { StaticSystem } from "./model";

const sys = JSON.parse(readFileSync("public/transit/subway.json", "utf8")) as StaticSystem;
// MTA alerts as the live site served them on 2026-11-07, cut before "What's happening?".
const live = JSON.parse(readFileSync(new URL("./alertDiagram.fixtures.json", import.meta.url), "utf8")) as Record<"aSkip" | "dLocal" | "oneShuttle" | "jSuspended" | "aBranch", TransitAlert>;

const stops = (d: AlertDiagram) => d.rows.filter((r): r is DiagramStop => !isGap(r));
const states = (d: AlertDiagram) => stops(d).map((r) => `${r.name}:${r.state}`);

describe("alertDiagram", () => {
  it("draws a skip-stop notice in travel order, with where to change", () => {
    const d = alertDiagram(live.aSkip, sys, "A")!;
    expect(d.kind).toBe("skip");
    expect(d.heading).toBe("Uptown A");
    // Uptown: 59 St at the top, riding up to 125 St.
    expect(states(d)).toEqual([
      "59 St-Columbus Circle:transfer", "72 St:skip", "81 St-Museum of Natural History:skip", "86 St:skip", "96 St:skip",
      "103 St:skip", "Cathedral Pkwy (110 St):skip", "116 St:skip", "125 St:transfer",
    ]);
    expect(d.steps.map((s) => s.text)).toEqual([
      "Uptown A trains skip 7 stops, 72 Street to 116 Street.",
      "Going to these stops: ride to 125 Street and change to a downtown A or D.",
      "Starting at these stops: take the A or D to 59 Street-Columbus Circle and change to an uptown A.",
    ]);
    expect(d.steps[1].ids).toEqual(["A15"]);
    expect(d.steps[2].ids).toEqual(["A24"]);
  });

  it("draws a run-local notice on the track that has the local stops", () => {
    const d = alertDiagram(live.dLocal, sys, "D")!;
    expect(d.kind).toBe("local");
    expect(d.heading).toBe("Downtown D");
    // Downtown: 125 St at the top; the D's usual stops stay plain, the new ones are marked.
    expect(states(d)[0]).toBe("125 St:open");
    expect(states(d).at(-1)).toBe("59 St-Columbus Circle:open");
    expect(stops(d).filter((r) => r.state === "local")).toHaveLength(7);
    expect(d.steps.map((s) => s.text)).toEqual([
      "Downtown D trains run local from 125 Street to 59 Street-Columbus Circle.",
      "They also stop at 7 stops, 116 Street to 72 Street.",
    ]);
  });

  it("draws a shuttle bus over a suspended stretch, and the station off the line to change at", () => {
    const d = alertDiagram(live.oneShuttle, sys, "1")!;
    expect(d.kind).toBe("shuttle");
    expect(d.heading).toBe("No 1 trains");
    // North at the top: Van Cortlandt Park down to Dyckman St, where the 1 still runs.
    expect(states(d).slice(0, 7)).toEqual([
      "Van Cortlandt Park-242 St:shuttle", "238 St:shuttle", "231 St:shuttle", "Marble Hill-225 St:shuttle", "215 St:shuttle", "207 St:shuttle", "Dyckman St:transfer",
    ]);
    expect(stops(d).at(-1)).toMatchObject({ name: "Inwood-207 St", state: "transfer", off: ["A"] });
    expect(d.steps.map((s) => s.text)).toEqual([
      "No 1 trains between Dyckman Street and Van Cortlandt Park-242 Street.",
      "Take the free shuttle bus instead.",
      "Change at Dyckman Street for the 1, or at Inwood-207 Street for the A.",
    ]);
    // The walk lights the closed stretch, then the bus with its ends, then both places to change.
    expect(d.steps[0].ids).not.toContain("109");
    expect(d.steps[1].ids).toContain("109");
    expect(d.steps[2].ids).toEqual(["109", "A02"]);
  });

  it("keeps a part suspension with no bus closed, and the bus stretch as a bus", () => {
    const d = alertDiagram(live.jSuspended, sys, "J")!;
    const byName = Object.fromEntries(stops(d).map((r) => [r.name, r.state]));
    expect(byName["Marcy Av"]).toBe("shuttle");
    expect(byName["Canal St"]).toBe("closed");
    expect(byName["Broad St"]).toBe("closed");
    expect(d.steps[1].text).toBe("Take the free shuttle bus between Myrtle Avenue and Delancey Street-Essex Street.");
  });

  it("follows a branch the line's track order leaves out (the A to Lefferts Blvd)", () => {
    const d = alertDiagram(live.aBranch, sys, "A")!;
    expect(states(d)).toEqual(["Rockaway Blvd:transfer", "104 St:shuttle", "111 St:shuttle", "Ozone Park-Lefferts Blvd:shuttle"]);
  });

  it("has nothing to draw for a notice with no stations", () => {
    const delay: TransitAlert = { id: "d", kind: "delay", type: "Delays", reroute: false, text: "[SIR] trains are running with delays in both directions because of late ferry arrivals.", agency: "MTASBWY", routes: ["SI"], stops: [] };
    expect(alertDiagram(delay, sys, "SI")).toBeNull();
    // Station names the line does not have: nothing to draw either.
    expect(alertDiagram({ ...delay, routes: ["A"], text: "Uptown [A] skips Nowhere St" }, sys, "A")).toBeNull();
  });
});

describe("notice text", () => {
  it("reads MTA bullets and icons as words", () => {
    expect(cleanAlertText("take the [4][5] or [6] to 59 St [accessibility icon] and transfer")).toBe("take the 4, 5 or 6 to 59 St and transfer");
    expect(cleanAlertText("[shuttle bus icon] Free shuttle buses")).toBe("shuttle Free shuttle buses");
  });

  it("trims a long notice to its first sentences", () => {
    const text = "[A] trains are running with delays in both directions while we conduct track maintenance along the line in Manhattan. Planned work reminder: in Manhattan, uptown A local skips 72 St, 81 St and 86 St. Expect longer waits.";
    expect(shortNotice(text)).toBe("A trains are running with delays in both directions while we conduct track maintenance along the line in Manhattan.");
  });
});
