import { describe, expect, it } from "vitest";
import { CONNECT_AFTER_S, CONNECT_BEFORE_S, connectingStops } from "./connections";
import { DWELL_DEFAULT, DWELL_LONG, defaultDwell, platformKey } from "./dwell";
import { estimateTrain, type LiveTrip, type StaticSystem } from "./model";

const trip = (id: string, route: string, stops: Array<[string, number]>): LiveTrip => ({ id, route, dir: 0, stops });
const at = (m: Map<string, Set<string>>, id: string) => [...(m.get(id) ?? [])];

describe("trains with a connection pulling in across the platform", () => {
  it("pairs a local with the express due on the same platform a little later, and the express with it", () => {
    // 96 St on the 1/2/3 (station 120), downtown.
    const m = connectingStops([trip("local", "1", [["120S", 1000], ["121S", 1100]]), trip("express", "2", [["120S", 1010], ["123S", 1200]])]);
    expect(at(m, "local")).toEqual(["120S"]);   // the express is due 10 s after it: worth waiting for
    expect(at(m, "express")).toEqual(["120S"]); // the local came 10 s before it: still at the platform
  });

  it("only waits for a train due soon, and only counts one that has not long gone", () => {
    const pair = (gap: number) => connectingStops([trip("a", "1", [["120S", 1000]]), trip("b", "2", [["120S", 1000 + gap]])]);
    expect(at(pair(CONNECT_AFTER_S), "a")).toEqual(["120S"]);
    expect(at(pair(CONNECT_AFTER_S + 1), "a")).toEqual([]);
    expect(at(pair(CONNECT_BEFORE_S), "b")).toEqual(["120S"]);
    expect(at(pair(CONNECT_BEFORE_S + 1), "b")).toEqual([]);
  });

  it("does not pair the next train of the same service, the other direction, or a station that is no transfer", () => {
    expect(connectingStops([trip("a", "1", [["120S", 1000]]), trip("b", "1", [["120S", 1010]])]).size).toBe(0);
    expect(connectingStops([trip("a", "1", [["120S", 1000]]), trip("b", "2", [["120N", 1010]])]).size).toBe(0);
    expect(connectingStops([trip("a", "1", [["121S", 1000]]), trip("b", "2", [["121S", 1010]])]).size).toBe(0);
  });

  it("pairs the 7 with the N or W at Queensboro Plaza, which are two stations in the data", () => {
    expect(platformKey("R09N")).toBe(platformKey("718N"));
    expect(platformKey("R09N")).not.toBe(platformKey("718S"));
    const m = connectingStops([trip("seven", "7", [["718N", 1000]]), trip("astoria", "N", [["R09N", 1010]])]);
    expect(at(m, "seven")).toEqual(["718N"]);
    expect(at(m, "astoria")).toEqual(["R09N"]);
  });

  it("looks only at a trip's next three stops", () => {
    const far = trip("a", "1", [["116S", 800], ["117S", 850], ["118S", 900], ["120S", 1000]]);
    expect(connectingStops([far, trip("b", "2", [["120S", 1010]])]).has("a")).toBe(false);
  });
});

describe("how long a train may stop", () => {
  it("is 30 s at an ordinary stop and never over 40 s", () => {
    expect(defaultDwell("XYZ")).toBe(DWELL_DEFAULT);
    expect(DWELL_LONG).toBe(40);
  });

  it("gives a transfer station the long stop only while a connection is pulling in", () => {
    expect(defaultDwell("120")).toBe(DWELL_DEFAULT);
    expect(defaultDwell("120", undefined, true)).toBe(DWELL_LONG);
    expect(defaultDwell("XYZ", undefined, true)).toBe(DWELL_DEFAULT); // not a transfer station
    expect(defaultDwell("XYZ", "Fulton St")).toBe(DWELL_LONG);        // a major complex, connection or not
  });

  it("draws the longer stop for a connecting train when the gap has room for it", () => {
    const sys: StaticSystem = {
      system: "subway",
      routes: { "1": { name: "Broadway-7 Av Local", short: "1", color: "#EE352E", text: "#FFFFFF" } },
      lines: { type: "FeatureCollection", features: [] },
      stations: { type: "FeatureCollection", features: [] },
      shapes: { "1": { c: [[-73.97, 40.79], [-73.97, 40.8]], m: [0, 1113], g: ["underground", "underground"] } },
      stopM: { "1": { "120": 0, "121": 1113 } },
    };
    const t: LiveTrip = { id: "t", route: "1", dir: 0, stops: [["120S", 1000], ["121S", 1200]] };
    // 35 s after arriving: gone without a connection (30 s stop), still there with one (40 s stop).
    expect(estimateTrain(sys, t, 1035)!.stopped).toBeUndefined();
    expect(estimateTrain(sys, t, 1035, undefined, undefined, { connecting: new Set(["120S"]) })!.stopped).toMatchObject({ kind: "at", stop: "120S" });
    expect(estimateTrain(sys, t, 1041, undefined, undefined, { connecting: new Set(["120S"]) })!.stopped).toBeUndefined();
  });
});
