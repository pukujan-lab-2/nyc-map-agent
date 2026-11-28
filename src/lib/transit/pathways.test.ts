import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PATH_MODES, route, toPlatform, toStreet, type Pathways } from "./pathways";

const data = JSON.parse(readFileSync("public/transit/pathways.json", "utf8")) as Pathways;
const platforms = Object.entries(data.nodes).filter(([, n]) => n.kind === "p").map(([id]) => id);
const metres = (a: [number, number], b: [number, number]): number =>
  Math.hypot((b[0] - a[0]) * 111_320 * Math.cos((a[1] * Math.PI) / 180), (b[1] - a[1]) * 110_540);

describe("the station connections file", () => {
  it("holds the MTA draft: 3,810 pathways between 371 platforms, 985 entrances and 844 points inside", () => {
    expect(data.paths).toHaveLength(3810);
    const kinds = Object.values(data.nodes).reduce<Record<string, number>>((n, x) => ({ ...n, [x.kind]: (n[x.kind] ?? 0) + 1 }), {});
    expect(kinds).toEqual({ p: 371, e: 985, n: 844 });
  });

  it("names both ends of every pathway and gives each a mode it knows", () => {
    for (const [from, to, mode] of data.paths) {
      expect(data.nodes[from], from).toBeDefined();
      expect(data.nodes[to], to).toBeDefined();
      expect(PATH_MODES[mode]).toBeDefined();
    }
  });

  it("places no entrance far from the station it belongs to (five slips in the draft are left without a place)", () => {
    const unplaced = Object.values(data.nodes).filter((n) => n.kind === "e" && !n.at);
    expect(unplaced).toHaveLength(5);
    expect(unplaced.map((n) => n.name)).toContain("WTC Cortlandt St Uptown 1 Oculus @ Fulton St");
    // Every entrance still placed is within a kilometre of some platform.
    const placed = platforms.map((id) => data.nodes[id].at).filter((at): at is [number, number] => !!at);
    for (const n of Object.values(data.nodes)) {
      if (n.kind === "e" && n.at) expect(Math.min(...placed.map((p) => metres(p, n.at!))), n.name).toBeLessThan(1000);
    }
  });
});

describe("the two step-free routes we filmed on 2026-11-13", () => {
  it("14 St-Union Sq, uptown N/Q/R/W platform to the street: the same two elevators and signs", () => {
    const steps = toStreet(data, "R20N")!;
    expect(steps.map((s) => [s.mode, s.equipment])).toEqual([["elevator", "EL219"], ["walkway", "W2"], ["exit gate", "R221"], ["elevator", "EL217"]]);
    expect(steps[1].sign).toContain("Elevator to L");
    expect(steps[2].sign).toBe("Exit 14 St & 4 Av");
    expect(steps[3].sign).toContain("NE corner");
  });

  it("Cortlandt St, the Broadway and Dey St elevator to the uptown R/W platform", () => {
    const entrance = Object.entries(data.nodes).find(([, n]) => n.kind === "e" && n.name.startsWith("Cortlandt St R/W") && n.name.includes("(EL728X)"))![0];
    const steps = toPlatform(data, entrance, "R25N")!;
    expect(steps.map((s) => s.equipment)).toEqual(["EL728X", "EL728X", "1", "A049A", "EL727X"]);
    expect(steps[4].sign).toBe("Elevator to Uptown & Queens");
    expect(steps[4].to).toBe("R25N");
  });
});

describe("routes through every station (no true answer needed)", () => {
  it("never puts stairs or an escalator in a step-free route", () => {
    for (const p of platforms) for (const s of toStreet(data, p) ?? []) expect(["stairs", "escalator"], `${p} via ${s.equipment}`).not.toContain(s.mode);
  });

  it("finds a step-free way out for 240 platforms, and some way out for all but one", () => {
    expect(platforms.filter((p) => toStreet(data, p)).length).toBe(240);
    expect(platforms.filter((p) => toStreet(data, p, { stepFree: false })).length).toBe(370);
  });

  it("is never shorter with stairs forbidden than with them allowed", () => {
    for (const p of platforms) {
      const free = toStreet(data, p), any = toStreet(data, p, { stepFree: false });
      if (free) { expect(any, p).not.toBeNull(); expect(free.length).toBeGreaterThanOrEqual(any!.length); }
    }
  });

  it("goes round an elevator that is out of service, or says there is no way", () => {
    for (const p of platforms) {
      const free = toStreet(data, p);
      const lift = free?.find((s) => s.mode === "elevator");
      if (!lift) continue;
      const again = toStreet(data, p, { outOfService: [lift.equipment] });
      for (const s of again ?? []) expect(s.equipment, p).not.toBe(lift.equipment);
      if (again) expect(again.length).toBeGreaterThanOrEqual(free!.length);
    }
    // Union Sq's uptown N/Q/R/W platform has one elevator up and the station one elevator to the street.
    expect(toStreet(data, "R20N", { outOfService: ["EL219"] })).toBeNull();
    expect(toStreet(data, "R20N", { outOfService: ["EL217"] })).toBeNull();
  });

  it("ends every route at a street entrance, each step starting where the last one ended", () => {
    for (const p of platforms) {
      const steps = toStreet(data, p);
      if (!steps) continue;
      expect(data.nodes[steps[steps.length - 1].to].kind).toBe("e");
      let at = p;
      for (const s of steps) {
        expect(data.paths.some(([a, b, , both, , , eq]) => eq === s.equipment && ((a === at && b === s.to) || (both === 1 && b === at && a === s.to))), `${at} to ${s.to}`).toBe(true);
        at = s.to;
      }
    }
  });

  it("finds no route from a point to itself or to nowhere", () => {
    expect(route(data, "R20N", (id) => id === "R20N")).toBeNull();
    expect(route(data, "R20N", () => false)).toBeNull();
    expect(route(data, "not-a-stop", (_, n) => n?.kind === "e")).toBeNull();
  });
});
