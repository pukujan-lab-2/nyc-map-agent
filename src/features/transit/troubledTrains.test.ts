import { describe, expect, it } from "vitest";
import type { TransitAlert } from "./hooks";
import type { LiveTrip } from "./model";
import { TROUBLE_AHEAD_STOPS, troubledStations, troubledTrips } from "./troubledTrains";

const trip = (id: string, route: string, stops: string[]): LiveTrip => ({ id, route, dir: 0, stops: stops.map((s, i) => [s, 100 + i * 100] as [string, number]) });
const alert = (over: Partial<TransitAlert>): TransitAlert => ({ id: "a", kind: "delay", type: "Delays", reroute: false, text: "", agency: "MTASBWY", routes: [], stops: [], ...over });
const none = new Set<string>(), nobody = new Map<string, { stop: string }>();

describe("stations a notice puts in trouble", () => {
  it("takes the stations of unplanned delays and detours, as station ids", () => {
    const alerts = [
      alert({ stops: ["A32", "A31N"] }),
      alert({ kind: "notice", reroute: true, stops: ["D15S"] }),
      alert({ kind: "planned", reroute: true, stops: ["F20"] }),
      alert({ kind: "notice", stops: ["G22"] }),
    ];
    expect([...troubledStations(alerts)].sort()).toEqual(["A31", "A32", "D15"]);
    expect(troubledStations(undefined).size).toBe(0);
  });
});

describe("trains in trouble", () => {
  const ahead = trip("ahead", "F", ["F20S", "F21S", "F22S"]);
  const behind = trip("behind", "F", ["F18S", "F19S", "F20S", "F21S"]);
  const far = trip("far", "F", ["F15S", "F16S", "F18S", "F19S", "F20S"]);
  const other = trip("other", "F", ["F20N", "F19N"]);

  it("is quiet when nothing is wrong", () => {
    expect(troubledTrips([ahead, behind, far, other], none, nobody, none).size).toBe(0);
  });

  it("includes every train on a line with a notice, and the held train itself", () => {
    expect([...troubledTrips([ahead, trip("g", "G", ["G22N"])], new Set(["G"]), nobody, none)]).toEqual(["g"]);
    expect([...troubledTrips([ahead, other], none, new Map([["ahead", { stop: "F20S" }]]), none)]).toEqual(["ahead"]);
  });

  it("includes a train with a held train standing at one of its next stops, on the same platform only", () => {
    const held = new Map([["ahead", { stop: "F20S" }]]);
    // `behind` reaches F20S as its third stop; `far` as its fifth; `other` runs the opposite way.
    expect([...troubledTrips([ahead, behind, far, other], none, held, none)].sort()).toEqual(["ahead", "behind"]);
    expect(TROUBLE_AHEAD_STOPS).toBe(3);
  });

  it("includes a train of any line about to reach that platform", () => {
    const held = new Map([["ahead", { stop: "F20S" }]]);
    expect(troubledTrips([ahead, trip("m", "M", ["F19S", "F20S"])], none, held, none).has("m")).toBe(true);
  });

  it("includes a train whose next stops include a station a delay notice names, in either direction", () => {
    const stations = troubledStations([alert({ stops: ["F20"] })]);
    expect([...troubledTrips([ahead, behind, far, other], none, nobody, stations)].sort()).toEqual(["ahead", "behind", "other"]);
  });
});
