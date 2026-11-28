import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { slimAlert, type MercuryAlert, type SlimAlert } from "../../../server/features/transit/alerts";
import { hasFacts } from "../../../server/features/transit/noticeFacts";
import type { StaticSystem } from "./model";
import { factsOf, noticeWalk, periodWords, type NoticeWalk, type Trip, type WalkStep } from "./noticeWalk";
import type { TransitAlert } from "./hooks";
import { PATTERNS, fill } from "./walkPatterns";

const sys = JSON.parse(readFileSync("public/transit/subway.json", "utf8")) as StaticSystem;
// The live MTA subway alerts feed on 2026-11-27 (step 2's fixture): 214 notices.
const feed = JSON.parse(readFileSync("server/features/transit/__fixtures__/subway-alerts-2026-11-27.json", "utf8")) as { header: { timestamp: number }; entity: MercuryAlert[] };
const at = Number(feed.header.timestamp);
const alerts: SlimAlert[] = feed.entity.flatMap((e) => slimAlert(e, at, at + 366 * 86_400) ?? []);
const byText = (t: string) => alerts.find((a) => a.text.includes(t))!;
const texts = (w: NoticeWalk) => w.steps.map((s) => s.text);
const stationIds = new Set(sys.stations.features.map((f) => String(f.properties.id)));

/** Every walk the app can show for a notice on a line: no stop picked, then each stop getting off and getting on. */
function everyWalk(a: SlimAlert, route: string): Array<{ trip: Trip; walk: NoticeWalk }> {
  const first = noticeWalk(a, sys, route, null);
  return [{ trip: null, walk: first }, ...first.stops.flatMap((stop) => (["off", "on"] as const).map((mode) => ({ trip: { stop, mode }, walk: noticeWalk(a, sys, route, { stop, mode }) })))];
}

/** What a step names that its map leaves out. */
function missing(s: WalkStep): string[] {
  const m = s.map;
  const out: string[] = [];
  for (const id of s.named.stations) if (!m.stations.includes(id)) out.push(`station ${id}`);
  for (const l of s.named.lines) if (!m.lines.includes(l)) out.push(`line ${l}`);
  for (const b of s.named.buses) if (!(m.bus ?? []).some((x) => x.route === b)) out.push(`bus ${b}`);
  for (const e of s.named.entrances) if (!(m.entrances ?? []).some((x) => x.station === e.station && x.id === e.id)) out.push(`entrance ${e.station}`);
  // A shuttle or a temporary bus is in none of our bus data, so the map needs its stops to draw it.
  for (const b of m.bus ?? []) if (b.shuttle && !b.stops.length) out.push(`stops for the ${b.route} bus`);
  // Every station the map draws is one of ours.
  const drawn = [...m.stations, m.you, ...(m.bus ?? []).flatMap((b) => b.stops.map((x) => x.station)), m.ride?.from, m.ride?.to, ...(m.tracks ?? []).flatMap((t) => [t.from, t.to, ...(t.skip ?? [])]), ...(m.change ?? []).map((c) => c.at), ...(m.walk ?? []).flatMap((w) => [w.from, w.to])];
  for (const id of drawn) if (id !== undefined && !stationIds.has(id)) out.push(`unknown station ${id}`);
  return out;
}

describe("notice walks over every saved notice (plan step 3)", () => {
  const lines = alerts.flatMap((a) => a.routes.filter((r) => sys.stopM[r]).map((route) => ({ a, route })));

  it("gives every notice a walk on every line it names", () => {
    expect(alerts.length).toBe(214);
    for (const { a, route } of lines) {
      const w = noticeWalk(a, sys, route, null);
      expect(w.steps.length, `${a.id} on the ${route}`).toBeGreaterThan(0);
      expect(w.read, `${a.id} on the ${route}`).toBe(hasFacts(factsOf(a, sys)));
    }
    // Step 2 read all 214 notices into facts on this snapshot; every one is walked from its facts.
    expect(lines.filter(({ a, route }) => noticeWalk(a, sys, route, null).read).length).toBe(lines.length);
  });

  it("shows on the map every station, line, bus and entrance a step names", () => {
    let steps = 0;
    const gaps: string[] = [];
    for (const { a, route } of lines) {
      for (const { trip, walk } of everyWalk(a, route)) {
        for (const s of walk.steps) {
          steps++;
          for (const m of missing(s)) gaps.push(`${a.id} on the ${route}${trip ? ` (${trip.mode} at ${trip.stop})` : ""}: "${s.text}" names ${m}`);
        }
      }
    }
    expect(gaps).toEqual([]);
    // The preview's audit passed 952 steps over a hand-picked week; this covers every notice, stop and trip.
    expect(steps).toBeGreaterThan(952);
  }, 60_000);

  it("gives guidance, not reasons, and leaves no slot empty", () => {
    for (const { a, route } of lines) {
      for (const { walk } of everyWalk(a, route)) {
        for (const t of texts(walk)) {
          expect(t).not.toMatch(/^Why\b|\bdue to\b|\bbecause\b|\bwhile we\b/i);
          expect(t).not.toMatch(/\{|\bundefined\b|\bnull\b|\s[.,]|on the\.|\s{2}/);
        }
      }
    }
  }, 60_000);

  it("says each step in whole sentences with short forms in full, the same way every time", () => {
    for (const { a, route } of lines) {
      for (const { trip, walk } of everyWalk(a, route)) {
        const again = noticeWalk(a, sys, route, trip);
        walk.steps.forEach((s, i) => {
          expect(s.say, s.text).not.toMatch(/\b(?:St|Av|Sq|Pkwy|Blvd)\.|\.\./);
          expect(s.text).not.toMatch(/\.\./);
          expect(s.say).toMatch(/[.!?]$/);
          expect(again.steps[i].text).toBe(s.text);
          expect(again.steps[i].say).toBe(s.say);
        });
      }
    }
    const seven = noticeWalk(byText("Flushing-bound [7] skips 52 St, 69 St, 74 St-Broadway"), sys, "7", { stop: "710", mode: "off" });
    expect(seven.steps.find((s) => s.say.startsWith("Getting off"))?.say).toBe("Getting off at 74th Street, Broadway: your train won't stop there. Stay on to Junction Boulevard.");
  }, 60_000);

  it("plays only the rider's case, one action a step", () => {
    const seven = byText("Flushing-bound [7] skips 52 St, 69 St, 74 St-Broadway");
    const off = noticeWalk(seven, sys, "7", { stop: "710", mode: "off" });
    expect(texts(off)[0]).toMatch(/^Flushing-bound 7 trains skip 7 stops.*Manhattan-bound 7 trains still stop there\. If you aren't getting on or off at one of these stops, nothing changes for you\.$/);
    expect(texts(off)).toContain("Getting off at 74 Street-Broadway: your train won't stop there. Stay on to Junction Boulevard.");
    // Platform notes for other stops are said once in the lead, not as the rider's steps.
    expect(texts(off).filter((t) => t.startsWith("Getting"))).toHaveLength(1);
    expect(texts(off)).toContain("There, change to a Manhattan-bound 7.");
    expect(texts(off)).toContain("Ride it to 74 Street-Broadway.");
    expect(texts(off).join(" ")).not.toMatch(/Getting on/);
    const on = noticeWalk(seven, sys, "7", { stop: "710", mode: "on" });
    expect(texts(on)).toContain("Getting on at 74 Street-Broadway: board a Manhattan-bound 7 and ride to 61 Street-Woodside.");
    expect(texts(on)).toContain("There, change to a Flushing-bound 7.");
    expect(texts(on).join(" ")).not.toMatch(/Getting off/);
  });

  it("doubles back on the other direction when the MTA names no station to change at", () => {
    const one = byText("downtown [1] skips 125 St");
    const w = noticeWalk({ ...one, description: "" }, sys, "1", { stop: "117", mode: "off" });
    expect(texts(w)).toEqual([
      "Downtown 1 trains skip 125 Street, 116 Street-Columbia University, Cathedral Parkway (110 Street) and 103 Street. Uptown 1 trains still stop there. If you aren't getting on or off at one of these stops, nothing changes for you.",
      "Getting off at 116 Street-Columbia University: your train won't stop there. Stay on to the next stop, 96 Street.",
      "At 96 Street, go to the platform for uptown 1 trains.",
      "Take an uptown 1 back 3 stops and get off at 116 Street-Columbia University.",
      "When: December 4 to 7, December 11 to 14, and December 18 to 21, Friday 11:45 PM to Monday 5:00 AM.",
    ]);
    const s = w.steps[1].map;
    expect(s.ride).toMatchObject({ line: "1", to: "120", toward: "downtown" });
    expect(s.tracks?.[0].skip).toContain("117");
    expect(w.steps[3].map.ride).toEqual({ line: "1", from: "120", to: "117", toward: "uptown" });
  });

  it("walks the shuttle bus with the MTA's corners, and says so when the notice gives none", () => {
    const four = alerts.find((a) => /no \[4\] service between 161 St-Yankee Stadium and Woodlawn/.test(a.text))!;
    const w = noticeWalk(four, sys, "4", { stop: "412", mode: "off" });
    expect(texts(w)).toContain("Ride the 4 to 161 Street-Yankee Stadium and go up to the street.");
    const bus = w.steps.find((s) => s.map.bus)!;
    expect(bus.map.bus?.[0].shuttle).toBe(true);
    expect(texts(w).some((t) => /^Get off the bus at 170 Street/.test(t))).toBe(true);
  });

  it("says our data cannot tell which entrance is closed, rather than guessing one", () => {
    const e = byText("Enter 5 Av/53 St");
    const w = noticeWalk(e, sys, "E", null);
    expect(texts(w)[0]).toMatch(/^At 5 Avenue\/53 Street: enter 5 Av\/53 St E, F Station at 5 Av only, Madison Av side of station is exit only\. Our map can't show which entrance is closed/);
    expect(w.steps[0].map.entrances).toEqual([{ station: "F12", id: null, state: "closed" }]);
  });

  it("says a notice on several lines once", () => {
    const w = noticeWalk(byText("Uptown [2][3] trains are running with delays"), sys, "2", null);
    expect(texts(w)).toEqual(["Uptown 2 and 3 trains are delayed near 14 Street."]);
  });
});

describe("notices as the phone keeps them", () => {
  // The 1's shuttle with the MTA's per-station corners, as the live site served it on 2026-11-08 (an older payload
  // with no facts from the server): the phone reads the facts itself.
  const live = JSON.parse(readFileSync("src/features/transit/alertDiagram.fixtures.json", "utf8")) as Record<string, TransitAlert>;
  it("reads an older notice the rules cannot place in the MTA's own words, without its reason", () => {
    // "Dyckman St, Upper Manhattan" matches none of our stations, so the walk does not guess one.
    const w = noticeWalk(live.oneCorners, sys, "1", null);
    expect(w.read).toBe(false);
    expect(w.stops).toEqual([]);
    expect(w.steps[0].text).toMatch(/^No 1 between/);
    expect(w.steps.length).toBeGreaterThan(1);
    for (const s of w.steps) expect(s.text).not.toMatch(/What's happening|Why:/i);
  });

  it("walks an older notice the rules can read from its text alone", () => {
    const w = noticeWalk(live.aSkip, sys, "A", { stop: "A17", mode: "off" });
    expect(w.read).toBe(true);
    expect(w.steps[1].text).toMatch(/^Getting off at /);
    for (const s of w.steps) expect(missing(s)).toEqual([]);
  });

  it("says when in full words", () => {
    expect(periodWords("Beginning Nov 7, Sat 12:30 AM until Nov 16, Mon 5:00 AM")).toBe("Beginning November 7, Saturday 12:30 AM until November 16, Monday 5:00 AM");
  });
});

describe("sentence patterns", () => {
  it("fills slots and keeps every key's words", () => {
    expect(fill("skip.off", { you: "74 Street-Broadway", next: "82 Street" })).toBe("Getting off at 74 Street-Broadway: your train won't stop there. Stay on to the next stop, 82 Street.");
    for (const [k, v] of Object.entries(PATTERNS)) expect(v, k).not.toMatch(/\bWhy\b|\bbecause\b/);
  });
});
