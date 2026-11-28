import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { slimAlert, type MercuryAlert } from "./alerts";
import { hasFacts, noticeFacts, stationIndex, type Change, type NoticeFacts, type Station, type StationRef } from "./noticeFacts";

// The live MTA subway alerts feed on 2026-11-27 (English text only) and our stations.
const feed = JSON.parse(readFileSync(new URL("./__fixtures__/subway-alerts-2026-11-27.json", import.meta.url), "utf8")) as { header: { timestamp: number }; entity: MercuryAlert[] };
const subway = JSON.parse(readFileSync(new URL("../../../public/transit/subway.json", import.meta.url), "utf8")) as { stations: { features: Array<{ properties: Station }> } };
const stations = subway.stations.features.map((f) => f.properties);
const idx = stationIndex(stations);
const at = Number(feed.header.timestamp);
const alerts = feed.entity.flatMap((e) => slimAlert(e, at, at + 366 * 86_400) ?? []);
const all = alerts.map((a) => noticeFacts(a, idx));

const facts = (n: number): NoticeFacts => {
  const f = all.find((x) => x.id === `lmm:planned_work:${n}`);
  if (!f) throw new Error(`notice ${n} is not in the snapshot`);
  return f;
};
const ids = (refs: StationRef[]) => refs.map((r) => r.id);
const kinds = (f: NoticeFacts) => f.changes.map((c) => `${c.kind} ${c.line}`);
const first = <K extends Change["kind"]>(f: NoticeFacts, kind: K) => f.changes.find((c): c is Extract<Change, { kind: K }> => c.kind === kind)!;

describe("notice facts over the 2026-11-27 snapshot", () => {
  it("turns at least 95% of the notices into facts with every station found", () => {
    // 165 of 173 was the bar the plan set; the snapshot holds every notice that has not ended (214 that night).
    const good = all.filter(hasFacts);
    expect(all.length).toBeGreaterThanOrEqual(173);
    expect(good.length / all.length).toBeGreaterThanOrEqual(0.95);
  });

  it("places every station a change names on that change's line", () => {
    const routes = new Map(stations.map((s) => [s.id, new Set(s.routes.split(" "))]));
    const on = (line: string, id: string) => [line, `${line}X`, line[0]].some((r) => routes.get(id)?.has(r));
    const wrong: string[] = [];
    for (const f of all) {
      for (const c of f.changes) {
        // Extra stops are stations a line does not usually serve; a line that runs where another one is out goes beyond its own stops.
        if (c.kind === "extraStops" || c.kind === "runs" || c.kind === "replacedBy") continue;
        const lines = [c.line, ...(c.kind === "reroute" ? c.via : [])];
        const refs = [
          ...("stations" in c ? c.stations : []), ...(c.kind === "express" ? [c.from, c.to, ...(c.skips ?? [])] : []),
          ...(c.kind === "suspended" || c.kind === "local" ? [c.from, c.to] : []), ...(c.kind === "sections" ? c.sections.flat() : []),
          ...(c.kind === "shortTurn" ? [c.lastStop] : []), ...(c.kind === "reroute" ? [c.from, c.to, ...(c.stops ?? [])].flatMap((r) => (r ? [r] : [])) : []),
        ];
        for (const r of refs) if (r.id && !lines.some((l) => on(l, r.id!))) wrong.push(`${f.id} ${c.kind} ${c.line} ${r.name}=${r.id}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it("leaves the reason out", () => {
    const text = JSON.stringify(all.map((f) => [f.changes, f.advice, f.leftover]));
    expect(text).not.toMatch(/What's happening|We're replacing tracks|Track maintenance|Signal maintenance/);
  });
});

describe("notice facts from real notices", () => {
  it("keeps the 7's weekend skip of 74 St-Broadway with both weekends", () => {
    const f = facts(36304);
    const skip = first(f, "skip");
    expect(skip).toMatchObject({ line: "7", toward: "Flushing" });
    expect(ids(skip.stations)).toEqual(["713", "711", "710", "709", "708", "706", "705"]);
    expect(f.when.windows).toHaveLength(2);
    // "Woodside-61 St" in the notice is "61 St-Woodside" in our data.
    const to = f.advice.find((a) => a.case === "to")!;
    expect(ids(to.take!.to)).toEqual(["712", "707", "702"]);
    expect(to.transfer!.lines).toEqual([{ line: "7", toward: "Manhattan" }]);
  });

  it("keeps the 52 St skip's paused windows and its platform change", () => {
    const f = facts(31498);
    expect(ids(first(f, "skip").stations)).toEqual(["713", "711"]);
    expect(f.when.windows.length).toBeGreaterThan(1);
    expect(first(f, "platform")).toMatchObject({ line: "7", boardFrom: "Manhattan-bound platform", stations: [{ name: "Woodside-61 St", id: "712" }] });
  });

  it("reads advice given per station (\"For service from Sutphin Blvd, take…\")", () => {
    const f = facts(36713);
    expect(first(f, "skip")).toMatchObject({ line: "F", toward: "Jamaica" });
    expect(ids(first(f, "skip").stations)).toEqual(["F05", "F04"]);
    const to = f.advice.find((a) => a.case === "to")!;
    expect(to.stations).toEqual([]);
    expect(ids(to.take!.to)).toEqual(["F03"]);
    const from = f.advice.filter((a) => a.case === "from");
    expect(from.map((a) => ids(a.stations))).toEqual([["F05"], ["F04"]]);
    expect(from[0].take!.lines.map((d) => d.line)).toEqual(["E", "F"]);
    expect(from[1].take!.lines.map((d) => d.line)).toEqual(["F"]);
    expect(ids(from[1].take!.to)).toEqual(["F06"]);
  });

  it("reads advice for \"these stations\" in both directions, with any downtown train", () => {
    const f = facts(36739);
    expect(kinds(f)).toEqual(["skip N", "skip Q"]);
    const [to, from] = f.advice;
    expect(to).toMatchObject({ case: "to", stations: [] });
    expect(ids(to.take!.to)).toEqual(["R20", "R17"]);
    expect(to.transfer!.lines).toEqual([{ line: null, toward: "downtown" }]);
    expect(from.take!.lines).toEqual([{ line: null, toward: "downtown" }]);
    expect(from.transfer!.lines).toEqual([{ line: "N", toward: "uptown" }, { line: "Q", toward: "uptown" }]);
  });

  it("carries the named stations into \"For service from these stations\"", () => {
    const f = facts(36743);
    const to = f.advice.find((a) => a.case === "to")!;
    const from = f.advice.find((a) => a.case === "from")!;
    expect(ids(to.stations)).toEqual(["R32", "R33", "R34", "R35"]);
    expect(from.stations).toEqual(to.stations);
    expect(first(f, "express")).toMatchObject({ line: "R", toward: "Bay Ridge", from: { id: "R23" }, to: { id: "R36" }, skips: [{ id: "R30" }] });
  });

  it("keeps a direction per line in one headline", () => {
    const f = facts(36723);
    expect(f.changes.map((c) => [c.line, c.toward])).toEqual([["F", "Coney Island"], ["G", "Church Av"]]);
    const to = f.advice.find((a) => a.case === "to")!;
    expect(to.transfer!.lines).toEqual([{ line: "F", toward: "Manhattan" }, { line: "G", toward: "Court Square" }]);
  });

  it("reads a reroute with the stops it makes", () => {
    const f = facts(36742);
    const r = first(f, "reroute");
    expect(r).toMatchObject({ line: "Q", toward: "Coney Island", via: ["R"], from: { id: "R23" }, to: { id: "R30" } });
    expect(ids(r.stops!)).toEqual(["R24", "R25", "R26", "R27", "R28", "R29"]);
    expect(first(f, "platform")).toMatchObject({ toward: "downtown", boardFrom: "R platform" });
  });

  it("reads a gap, the line's two sections and a note about another platform", () => {
    const f = facts(36548);
    expect(first(f, "suspended")).toMatchObject({ line: "N", from: { id: "R09" }, to: { id: "R16" } });
    expect(first(f, "sections").sections.map(ids)).toEqual([["R01", "R09"], ["D43", "R16"]]);
    expect(first(f, "platform")).toMatchObject({ note: true, boardFrom: "Manhattan-bound platform", stations: [{ id: "R09" }] });
    const lex = f.advice.find((a) => a.stations.some((s) => s.id === "R11"))!;
    expect(lex.nearby).toEqual({ stations: [{ name: "59 St", id: "629" }], lines: ["4", "6"] });
  });

  it("reads which bus, from which corner, toward which end", () => {
    const f = facts(36693);
    expect(first(f, "suspended")).toMatchObject({ line: "5", from: { id: "501" }, to: { id: "213" } });
    expect(f.buses).toEqual([{ routes: ["T113"], shuttle: true, between: [{ name: "Dyre Av", id: "501" }, { name: "E 180 St", id: "213" }] }]);
    expect(f.busStops).toContainEqual({ station: { name: "Morris Park", id: "505" }, corner: "Morris Park Av at Hone Av", toward: { name: "E 180 St", id: "213" } });
    expect(f.transfers).toEqual([{ at: [{ name: "E 180 St", id: "213" }], lines: [{ line: "2", toward: null }], bus: true }]);
  });

  it("reads a boarding-platform change with its stations from the text", () => {
    expect(first(facts(36803), "platform")).toMatchObject({ line: "SI", boardFrom: "Tottenville-bound platform", stations: [{ id: "S24" }, { id: "S25" }, { id: "S26" }] });
  });

  it("reads an entrance closure", () => {
    const f = facts(33366);
    expect(kinds(f)).toEqual(["entrance E", "entrance F"]);
    expect(first(f, "entrance").stations).toEqual([{ name: "5 Av/53 St", id: "F12" }]);
  });

  it("gives each station of a closure notice only its own lines", () => {
    const byLine = Object.fromEntries(facts(36748).changes.flatMap((c) => (c.kind === "entrance" ? [[c.line, ids(c.stations)]] : [])));
    expect(byLine["2"]).toEqual(["128"]);
    expect(byLine["1"]).toEqual(["128", "125"]);
    expect(byLine.C).toEqual(["A24", "A22"]);
  });

  it("reads another line standing in, and fewer trains", () => {
    expect(first(facts(36211), "replacedBy")).toMatchObject({ line: "F", by: "G", from: { id: "F20" }, to: { id: "D43" } });
    expect(first(facts(36705), "frequency")).toMatchObject({ line: "2", everyMin: 15 });
    expect(first(facts(36498), "replacedBy")).toMatchObject({ line: "3", by: "2", from: { id: "128" }, to: { id: "224" } });
  });

  it("reads trains that end early at a stop, with the transfer to continue", () => {
    const f = facts(36513);
    expect(first(f, "shortTurn").lastStop).toEqual({ name: "167 St", id: "413" });
    expect(f.transfers[0]).toEqual({ at: [{ name: "167 St", id: "413" }], lines: [{ line: "4", toward: "Woodlawn" }] });
  });
});

describe("station names", () => {
  const find = (name: string, routes: string) => {
    const f = noticeFacts({ ...alerts[0], id: "t", routes: routes.split(" "), stops: [], text: `In Queens, [${routes.split(" ")[0]}] skips ${name}`, description: "", alternatives: [] }, idx);
    return f.changes[0] && "stations" in f.changes[0] ? f.changes[0].stations[0].id : undefined;
  };
  it("matches the MTA's other spellings of our station names", () => {
    expect(find("Woodside-61 St", "7")).toBe("712");
    expect(find("Jackson Heights-Roosevelt Av", "E")).toBe("G14");
    expect(find("4 Av/9 St", "F")).toBe("F23");
    expect(find("Court Square", "G")).toBe("G22");
    expect(find("Bedford Pk Blvd", "D")).toBe("D03");
    expect(find("161 St", "4")).toBe("414");
    expect(find("Cathedral Pkwy-110 St", "1")).toBe("118");
  });
  it("picks the station on the notice's line when names repeat", () => {
    expect(find("86 St", "1")).toBe("121");
    expect(find("86 St", "Q")).toBe("Q04");
    expect(find("Chambers St", "J")).toBe("M21");
  });
  it("leaves a name no station matches unresolved", () => {
    const f = noticeFacts({ ...alerts[0], id: "t", routes: ["7"], stops: [], text: "In Queens, [7] skips Nowhere Pl", description: "", alternatives: [] }, idx);
    expect(f.unresolved).toEqual(["Nowhere Pl"]);
    expect(hasFacts(f)).toBe(false);
  });
});
