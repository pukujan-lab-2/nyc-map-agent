import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { alertDiagram, cleanAlertText, isGap, shuttleCorners, type AlertDiagram, type DiagramStop } from "./alertDiagram";
import { shuttleFeatures } from "./alertFocus";
import { lineNotices } from "./lineNotices";
import type { TransitAlert } from "./hooks";
import type { StaticSystem } from "./model";

const sys = JSON.parse(readFileSync("public/transit/subway.json", "utf8")) as StaticSystem;
// MTA alerts as the live site served them on 2026-11-07, cut before "What's happening?".
// oneCorners, jCorners and sevenMain are from 2026-11-08 and carry the MTA's per-station shuttle notes.
const live = JSON.parse(readFileSync(new URL("./alertDiagram.fixtures.json", import.meta.url), "utf8")) as Record<"aSkip" | "dLocal" | "oneShuttle" | "jSuspended" | "aBranch" | "oneCorners" | "jCorners" | "sevenMain", TransitAlert>;

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
  });

  it("shows both transfers to 74 St-Broadway and only marks the Flushing-bound express as skipped", () => {
    const a: TransitAlert = {
      id: "seven-express", kind: "planned", type: "Planned - Stops Skipped", reroute: true, agency: "MTASBWY", routes: ["7", "7X"],
      text: "In Queens, all Manhattan-bound [7][7X] local/express trains stop at 74 St-Broadway",
      description: [
        "Flushing-bound [7X] express trains skip 74 St-Broadway.",
        "Flushing-bound [7] local trains will continue to stop at 74 St-Broadway.",
        "",
        "For service to 74 St-Broadway and/or transfer to Jackson Hts-Roosevelt Av [E][F][M][R], transfer at Woodside-61 St to a Flushing-bound [7] local.",
        "",
        "Additional travel alternatives:",
        "For service to this station, take the [7X] to Junction Blvd and transfer to a Manhattan-bound [7][7X].",
      ].join("\n"),
      changes: [], skipNames: ["74 St-Broadway"], stops: ["710"],
    };
    const d = alertDiagram(a, sys, "7")!;
    expect(stops(d).filter((r) => r.state === "transfer").map((r) => r.name)).toEqual(["61 St-Woodside", "Junction Blvd"]);
    expect(lineNotices("7", [a], [], sys, 200)[0].stations[0].label).toBe("74 St-Broadway · Flushing-bound 7X express skipped");
  });

  it("draws a run-local notice on the track that has the local stops", () => {
    const d = alertDiagram(live.dLocal, sys, "D")!;
    expect(d.kind).toBe("local");
    expect(d.heading).toBe("Downtown D");
    // Downtown: 125 St at the top; the D's usual stops stay plain, the new ones are marked.
    expect(states(d)[0]).toBe("125 St:open");
    expect(states(d).at(-1)).toBe("59 St-Columbus Circle:open");
    expect(stops(d).filter((r) => r.state === "local")).toHaveLength(7);
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
    // This copy of the notice has no station notes: the guide says so rather than guess a corner.
  });

  it("keeps a part suspension with no bus closed, and the bus stretch as a bus", () => {
    const d = alertDiagram(live.jSuspended, sys, "J")!;
    const byName = Object.fromEntries(stops(d).map((r) => [r.name, r.state]));
    expect(byName["Marcy Av"]).toBe("shuttle");
    expect(byName["Canal St"]).toBe("closed");
    expect(byName["Broad St"]).toBe("closed");
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

describe("shuttle bus corners", () => {
  it("reads the station notes as corners", () => {
    const corners = shuttleCorners(live.oneCorners, sys);
    expect(corners.get("101")).toEqual([{ text: "Broadway at 242 Street" }]);
    expect(corners.get("109")).toEqual([{ text: "Broadway at Dyckman Street", note: "for the A" }, { text: "Nagle Avenue at Dyckman Street", note: "for the 1" }]);
  });

});

describe("notice text", () => {
  it("reads MTA bullets and icons as words", () => {
    expect(cleanAlertText("take the [4][5] or [6] to 59 St [accessibility icon] and transfer")).toBe("take the 4, 5 or 6 to 59 St and transfer");
    expect(cleanAlertText("[shuttle bus icon] Free shuttle buses")).toBe("shuttle Free shuttle buses");
  });

});

describe("a shuttle notice's bus stops", () => {
  const name = (id: string) => String(sys.stations.features.find((f) => f.properties.id === id)?.properties.name ?? "");
  const at = (id: string) => sys.stations.features.find((f) => f.properties.id === id)?.geometry.coordinates as [number, number] | undefined;

  it("lists the bus's stations end to end, on a branch the line's track order does not hold", () => {
    const d = alertDiagram(live.aBranch, sys, "A")!;
    expect(d.kind).toBe("shuttle");
    expect(d.bus!.map(name)).toEqual(["Rockaway Blvd", "104 St", "111 St", "Ozone Park-Lefferts Blvd"]);
  });

  it("gives no bus stations when no bus runs", () => {
    expect(alertDiagram(live.aSkip, sys, "A")!.bus).toBeUndefined();
  });

  it("draws a line through the stops and names the place to change", () => {
    const d = alertDiagram(live.aBranch, sys, "A")!;
    const g = shuttleFeatures({ stops: d.bus!.map((id, i) => ({ id, change: i === 0, corners: i === 1 ? ["Liberty Avenue at 104 Street"] : [] })) }, at);
    expect(g.line).toHaveLength(4);
    expect(g.stops.map((x) => x.label)).toEqual(["Change here", "Liberty Avenue at 104 Street", "", ""]);
    // The frame holds every stop, not only the first.
    expect(g.bounds![0][0]).toBeLessThan(g.bounds![1][0]);
    expect(shuttleFeatures(null, at)).toEqual({ line: [], stops: [], bounds: null });
  });
});

// Notices that take no train away but name their stations are drawn too (owner, 2026-11-14).
describe("a notice that names its stations", () => {
  const notice = (over: Partial<TransitAlert>): TransitAlert => ({ id: "t", kind: "notice", type: "", reroute: false, text: "", agency: "MTASBWY", routes: ["1"], stops: [], ...over });

  it("draws a boarding change, and does not take the platform's direction for a station or for the train's", () => {
    const d = alertDiagram(notice({ type: "Boarding Change", routes: ["M"], text: "In Queens, all [M] trains at Fresh Pond Rd, Forest Av and Seneca Av board from the Metropolitan Av-bound platform" }), sys, "M")!;
    expect(d.kind).toBe("named");
    expect(d.heading).toBe("M");
    expect(d.tag).toBe("Boarding change");
    expect(states(d).filter((x) => x.endsWith(":noted"))).toEqual(["Seneca Av:noted", "Forest Av:noted", "Fresh Pond Rd:noted"]);
  });

  it("marks the extra stops of an express running local, on the track that has them", () => {
    const d = alertDiagram(notice({ kind: "planned", type: "Planned - Express to Local", routes: ["A"], text: "In Manhattan, uptown [A] stops at 23 St and 50 St" }), sys, "A")!;
    expect(d.heading).toBe("Uptown A");
    expect(states(d)).toEqual(["14 St:open", "23 St:local", "34 St-Penn Station:open", "42 St-Port Authority Bus Terminal:open", "50 St:local", "59 St-Columbus Circle:open"]);
  });

  it("draws the one station a delay or a station notice is at", () => {
    const d = alertDiagram(notice({ kind: "delay", type: "Delays", routes: ["4", "5"], text: "Downtown [4][5] trains are delayed while we request EMS for someone in need at 138 St-Grand Concourse." }), sys, "4")!;
    expect(d.tag).toBe("Delays");
    expect(states(d).filter((x) => !x.endsWith(":open"))).toEqual(["138 St-Grand Concourse:noted"]);
  });

  it("stays plain when no station is named, or the name fits two stations of the line", () => {
    expect(alertDiagram(notice({ kind: "planned", type: "Reduced Service", text: "[1] runs every 8 minutes" }), sys, "1")).toBeNull();
    expect(alertDiagram(notice({ kind: "delay", routes: ["R"], text: "Bay Ridge-bound [R] trains are running with delays after we addressed a door problem on a train at 36 St." }), sys, "R")).toBeNull();
  });
});
