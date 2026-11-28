/**
 * Elevator outages turned into walk data (docs/PLAN-notice-walks.md, step 6). The walk the owner approved starts with
 * what is broken, then "if you can use the stairs, nothing changes", then the step-free way from where the rider is.
 * This module gives that walk its facts, read by rules from the MTA's own words, never by a model:
 *
 * - whether the elevator reaches the street or runs inside the station (`serving`);
 * - which elevator entrance in our station data it is, by the corner the MTA names;
 * - the detour, split into journeys ("To access street level: …", "For B/D: …"), each with where it starts, its legs
 *   (ride a line, walk, take a bus from a corner to a corner) and where it ends;
 * - for every station a detour sends people to, its elevator entrance in our data, or "not in our data".
 *
 * Where our data cannot decide (two elevator entrances and no corner to tell them apart, a station name that fits
 * several stations), the answer says it is unsure rather than guess. Pure, so it runs in tests and scripts.
 */
import type { Pt } from "@/lib/map/mapRead";
import { parseCorner, type StreetUnit } from "@/lib/transit/equipment";
import type { Outage } from "./hooks";
import type { StaticSystem } from "./model";

type WalkSystem = Pick<StaticSystem, "stations" | "entrances">;

/** An elevator entrance in public/transit/subway.json. */
interface ElevatorEntrance { stationId: string; name: string; at: Pt }

/** The MTA's street corner: streets as written, corner "NE" / "NW" / "SE" / "SW". */
interface MtaCorner { streets: string[]; corner: string }

type EntranceMatch =
  /** `corner`: the corner of the MTA's intersection decided it. `only`: the station's one elevator entrance, and the MTA lists one street elevator there. */
  | { status: "matched"; entrance: ElevatorEntrance; by: "corner" | "only" }
  | { status: "unsure"; candidates: ElevatorEntrance[]; why: string }
  /** The station has no elevator entrance in our data. */
  | { status: "not-in-data" }
  /** The elevator runs inside the station, so no street entrance is out. */
  | { status: "inside" };

type StationMatch =
  /** `ids`: the stops that fit the name and lines; `elevators`: elevator entrances of that station complex (empty: not in our data). */
  | { status: "found"; ids: string[]; name: string; elevators: ElevatorEntrance[] }
  | { status: "unsure"; candidates: Array<{ id: string; name: string; routes: string }> }
  /** No subway station by that name in our data (a Metro-North stop, say). */
  | { status: "not-in-data" };

export interface StationRef { name: string; lines: string[]; match: StationMatch }

/** Each leg keeps the MTA clause it came from, for the (i) and for checking. */
export type Leg =
  | { kind: "ride"; lines: string[]; toward: string | null; from: StationRef | null; to: StationRef | null; text: string }
  | { kind: "bus"; routes: string[]; toward: string | null; from: string | null; to: string | null; stations: StationRef[]; text: string }
  | { kind: "walk"; to: string | null; station: StationRef | null; text: string }
  | { kind: "transfer"; at: StationRef[]; text: string }
  | { kind: "elevator"; text: string }
  | { kind: "exit"; text: string }
  | { kind: "agent"; text: string }
  | { kind: "note"; text: string };

/** Where the rider is when the journey starts. `train`: already riding in, as "Take a Woodlawn-bound 4 to 170 St" assumes. */
type Start = "street" | "mezzanine" | "platform" | "train";

type JourneyEnd =
  | { kind: "station"; stations: StationRef[] }
  | { kind: "street"; place: string }
  | { kind: "unknown" };

export interface Journey {
  /** The MTA's heading as written ("If you are on the street", "For B/D"), or null. */
  heading: string | null;
  /** What the journey reaches, from the heading ("B/D", "street level"), or null. */
  goal: string | null;
  start: Start | null;
  legs: Leg[];
  end: JourneyEnd;
}

export interface ElevatorWalk {
  id: string;
  station: string;
  where: "street" | "inside";
  corner: MtaCorner | null;
  entrance: EntranceMatch;
  journeys: Journey[];
  /** Every station a journey names, once each. */
  detourStations: StationRef[];
  /** The MTA gives no detour ("Alt route not available"). */
  noDetour: boolean;
}

interface ElevatorWalkOpts {
  /**
   * Compass bearing (0 north, clockwise) from where `streets` meet to a point, or null when unknown. On the phone this
   * is what `cornerLine` works the corner out from (the map's meeting point, then the bearing); scripts and tests read
   * the city's corner table. In Manhattan the bearing follows the street grid, as the MTA's corners do.
   */
  bearingOf?: (at: Pt, streets: string[]) => number | null;
  /** The MTA's street units (`streetUnitsOf` the equipment list, or public/transit/equipment.json), to know a station's other street elevators and their corners. */
  streetUnits?: StreetUnit[];
}

const INSIDE = /\b(mezzanine|platform|landing|concourse|bridge|passageway|control area)\b/i;

/** "161 St & River Ave (NE corner) to mezzanine" is a street elevator; "B/D mezzanine to … platform" is inside. */
export function elevatorWhere(serving: string): "street" | "inside" {
  const s = serving.trim();
  if (/^street\b/i.test(s)) return "street";
  const from = s.split(/\s+(?:to|for|providing)\s+/i)[0];
  return INSIDE.test(from) ? "inside" : "street";
}

const CORNER_OF = /\b(NE|NW|SE|SW)\s+corner\s+of\s+(.+?)(?:\)|\s+(?:to|for|providing)\s+|[.,]|$)/i;

/** The corner the MTA names, in either wording: "161 St & River Ave (NE corner)" or "(NW corner of 7 Ave and 9 Street)". */
export function mtaCorner(serving: string): MtaCorner | null {
  const a = parseCorner(serving);
  if (a) return { streets: a.streets.map((s) => s.replace(/^street\s*\(?/i, "").trim()).filter(Boolean), corner: a.corner };
  const m = CORNER_OF.exec(serving);
  if (!m) return null;
  const streets = m[2].split(/\s*(?:&|\band\b)\s*/i).map((s) => s.trim()).filter(Boolean);
  return streets.length ? { streets, corner: m[1].toUpperCase() } : null;
}

/**
 * The equipment list's street units with their corners, read in both of the MTA's wordings. public/transit/equipment.json
 * reads only "(NE corner)", so it lacks E 149 St's "SW corner of Southern Blvd and E 149 St"; pass this where the list is at hand.
 */
export function streetUnitsOf(rows: Array<Record<string, string | undefined>>): StreetUnit[] {
  return rows.flatMap((r) => {
    const serving = String(r.serving ?? "");
    const c = r.isactive === "N" || elevatorWhere(serving) === "inside" ? null : mtaCorner(serving);
    if (!c) return [];
    const stops = String(r.elevatorsgtfsstopid ?? "").split(/[/,; ]+/).filter(Boolean);
    return [{ id: String(r.equipmentno), type: r.equipmenttype === "EL" ? "EL" : "ES", stops, serving, streets: c.streets, corner: c.corner }];
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Our station data

const parts = (id: string) => id.split(/;\s*/).map((s) => s.trim()).filter(Boolean);

function metres(a: Pt, b: Pt): number {
  const kx = 111_320 * Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
  return Math.hypot((a[0] - b[0]) * kx, (a[1] - b[1]) * 111_320);
}

/** Elevator entrances of these stops. A shared mezzanine lists both stations ("A12; D13"). */
function elevatorsOf(sys: WalkSystem, stopIds: string[]): ElevatorEntrance[] {
  const want = new Set(stopIds);
  const out: ElevatorEntrance[] = [];
  for (const f of sys.entrances?.features ?? []) {
    if (!/elevator/i.test(f.properties.kind)) continue;
    const hit = parts(String(f.properties.id)).find((id) => want.has(id));
    if (hit) out.push({ stationId: hit, name: String(f.properties.name ?? ""), at: f.geometry.coordinates as Pt });
  }
  return out;
}

const WORDS: Array<[RegExp, string]> = [
  [/[’‘]/g, "'"], [/\s*[–—]\s*/g, "-"], [/\s*-\s*/g, "-"], [/\s*\/\s*/g, "-"], [/\bb'way\b/g, "broadway"],
  [/\bavenues?\b|\bave\b|\bavs\b/g, "av"], [/\bstreets?\b/g, "st"], [/\bboulevard\b/g, "blvd"], [/\bparkway\b/g, "pkwy"],
  [/\bsquare\b/g, "sq"], [/\bheights\b/g, "hts"], [/\bcent(?:er|re)\b/g, "ctr"], [/\beast\b/g, "e"], [/\bwest\b/g, "w"],
  [/\bplace\b/g, "pl"], [/\broad\b/g, "rd"], [/\s+station$/g, ""], [/\s+/g, " "],
];
function norm(name: string): string {
  let s = name.toLowerCase().trim();
  for (const [re, to] of WORDS) s = s.replace(re, to);
  return s.trim();
}

/** Names the MTA's detour text uses for a station that our data names otherwise. */
const ALIASES: Record<string, string> = { "yankee stadium-161 st": "161 st-yankee stadium" };

type StationFeature = { id: string; name: string; routes: string; at: Pt; key: string };
const INDEX = new WeakMap<WalkSystem, StationFeature[]>();
function stationsOf(sys: WalkSystem): StationFeature[] {
  let list = INDEX.get(sys);
  if (!list) {
    list = (sys.stations?.features ?? []).map((f) => ({
      id: String(f.properties.id), name: String(f.properties.name), routes: String(f.properties.routes ?? ""),
      at: f.geometry.coordinates as Pt, key: norm(String(f.properties.name)),
    }));
    INDEX.set(sys, list);
  }
  return list;
}

/** Stops of one complex sit within a couple of hundred metres (Grand Central: 226 m); the two 170 St stations, 380 m apart, are two places. */
const COMPLEX_M = 250;

/** Our station for a name in the MTA's text, kept to the lines it names; unsure when several places fit. */
export function findStation(sys: WalkSystem, name: string, lines: string[] = []): StationRef {
  const all = stationsOf(sys);
  const key = ALIASES[norm(name)] ?? norm(name);
  const byLines = (list: StationFeature[]) => (lines.length ? list.filter((s) => s.routes.split(" ").some((r) => lines.includes(r.replace(/X$/, "")))) : list);
  const exact = all.filter((s) => s.key === key);
  const partial = all.filter((s) => s.key !== key && (s.key.split("-").includes(key) || s.key.startsWith(`${key}-`) || s.key.startsWith(`${key} `)));
  let fits = byLines(exact);
  if (!fits.length) fits = byLines(partial);
  const ref = (match: StationMatch): StationRef => ({ name, lines, match });
  if (!fits.length) {
    const named = exact.length ? exact : partial;
    return ref(named.length ? { status: "unsure", candidates: named.map(({ id, name: n, routes }) => ({ id, name: n, routes })) } : { status: "not-in-data" });
  }
  if (fits.some((s) => metres(s.at, fits[0].at) > COMPLEX_M)) {
    return ref({ status: "unsure", candidates: fits.map(({ id, name: n, routes }) => ({ id, name: n, routes })) });
  }
  // The complex: every stop of the same name close by, so 161 St's 4 platform finds the elevator listed under the B/D.
  const complex = all.filter((s) => (s.key === fits[0].key || fits.some((f) => f.id === s.id)) && metres(s.at, fits[0].at) <= COMPLEX_M);
  return ref({ status: "found", ids: fits.map((s) => s.id), name: fits[0].name, elevators: elevatorsOf(sys, complex.map((s) => s.id)) });
}

// ---------------------------------------------------------------------------------------------------------------------
// Which entrance is out

/** The outage's own station stops: the equipment list's GTFS ids, or our station by name and lines. */
function stopsOf(sys: WalkSystem, o: Outage): string[] {
  if (o.stops.length) return o.stops;
  const s = findStation(sys, o.station, o.routes);
  return s.match.status === "found" ? s.match.ids : [];
}

const GENERIC = /^(?:st|sts|av|ave|avs|avenue|street|e|w|n|s|east|west|north|south|the|of|and|pl|blvd|rd|sq|ctr|station|bus|terminal)$/;
/** Name tokens, so "42St/Port Authority-Bus Terminal" meets "42 St-Port Authority Bus Terminal" and "8th Ave" meets "8 Av". */
function tokens(s: string): string[] {
  return s.toLowerCase().replace(/(\d+)(?:st|nd|rd|th)\b/g, "$1").replace(/(\d)([a-z])/g, "$1 $2").split(/[^a-z0-9]+/).filter((w) => w && !GENERIC.test(w));
}

/**
 * The equipment list names a whole complex's stops (Fulton St lists the WTC Cortlandt stop too), so an elevator
 * entrance counts only when its station name shares the most words with the MTA's station name.
 */
function byName(cands: ElevatorEntrance[], station: string): ElevatorEntrance[] {
  const want = new Set(tokens(station));
  const score = (e: ElevatorEntrance) => tokens(e.name).filter((t) => want.has(t)).length;
  const best = Math.max(0, ...cands.map(score));
  return best ? cands.filter((e) => score(e) === best) : [];
}

const CENTRE: Record<string, number> = { NE: 45, SE: 135, SW: 225, NW: 315 };
const quadrant = (b: number) => ["NE", "SE", "SW", "NW"][Math.floor((((b % 360) + 360) % 360) / 90)];
const turn = (a: number, b: number) => { const d = Math.abs((((a - b) % 360) + 360) % 360); return Math.min(d, 360 - d); };

/** Every way to give each corner its own entrance (a handful at most: a station has two to four street elevators). */
function assignments(n: number, k: number): number[][] {
  if (!k) return [[]];
  const out: number[][] = [];
  for (const rest of assignments(n, k - 1)) for (let i = 0; i < n; i++) if (!rest.includes(i)) out.push([...rest, i]);
  return out;
}

const sameStreets = (a: string[], b: string[]) => {
  const want = new Set(a.flatMap(tokens));
  return b.length === a.length && b.every((s) => tokens(s).some((t) => want.has(t)));
};

function matchEntrance(sys: WalkSystem, o: Outage, opts: ElevatorWalkOpts = {}): EntranceMatch {
  if (elevatorWhere(o.serving) === "inside") return { status: "inside" };
  const stops = stopsOf(sys, o);
  const candidates = byName(elevatorsOf(sys, stops), o.station);
  if (!candidates.length) return { status: "not-in-data" };
  const corner = mtaCorner(o.serving);
  const mine = new Set(stops);
  const streetElevators = opts.streetUnits?.filter((u) => u.type === "EL" && u.stops.some((s) => mine.has(s))) ?? [];
  if (corner && opts.bearingOf) {
    const bearings = candidates.map((e) => opts.bearingOf!(e.at, corner.streets));
    const hits = candidates.filter((_, i) => bearings[i] !== null && quadrant(bearings[i]) === corner.corner);
    if (hits.length === 1) return { status: "matched", entrance: hits[0], by: "corner" };
    // A bearing near a quarter line can land on the next corner (231 St's SW elevator reads NW). When the MTA lists
    // one street elevator per entrance at this crossing, give each corner the entrance nearest it; take that only
    // when the best way of pairing them is clearly better than the next.
    const near = candidates.map((e, i) => ({ e, b: bearings[i] })).filter((x): x is { e: ElevatorEntrance; b: number } => x.b !== null);
    const corners = [...new Set([corner.corner, ...streetElevators.filter((u) => u.corner && sameStreets(corner.streets, u.streets)).map((u) => u.corner)])];
    if (!hits.length && near.length >= 2 && corners.length === near.length && corners.length <= 4) {
      const cost = (pick: number[]) => pick.reduce((sum, i, c) => sum + turn(near[i].b, CENTRE[corners[c]]), 0);
      const ranked = assignments(near.length, corners.length).map((pick) => ({ pick, cost: cost(pick) })).sort((x, y) => x.cost - y.cost);
      const best = ranked[0];
      if (ranked.length > 1 && ranked[1].cost - best.cost >= 90 && turn(near[best.pick[0]].b, CENTRE[corner.corner]) < 90) {
        return { status: "matched", entrance: near[best.pick[0]].e, by: "corner" };
      }
    }
    if (bearings.every((b) => b !== null) && !hits.length && candidates.length === 1) {
      return { status: "unsure", candidates, why: `our one elevator entrance here is on the ${quadrant(bearings[0])} corner, the MTA says ${corner.corner}` };
    }
    if (hits.length > 1) return { status: "unsure", candidates, why: `${hits.length} elevator entrances on the ${corner.corner} corner` };
  }
  if (candidates.length === 1) {
    if (streetElevators.length <= 1) return { status: "matched", entrance: candidates[0], by: "only" };
    return { status: "unsure", candidates, why: `one elevator entrance in our data, ${streetElevators.length} street elevators at the MTA` };
  }
  return { status: "unsure", candidates, why: corner ? `${candidates.length} elevator entrances and the corner does not decide` : `${candidates.length} elevator entrances and the MTA names no corner` };
}

// ---------------------------------------------------------------------------------------------------------------------
// The detour, read from the MTA's alternative route

const LINE = /^(?:[1-7]|[A-GJLMNQRWZ]|S|SIR|GS|H)X?$/;
const LINE_RUN = /^[ABCDEFGJLMNQRWZ]{2,5}$/; // "NQRW", "BD"
const BUS = /\b(?:Bx|BM|QM|B|M|Q|S|X)\d{1,3}[A-Z]?(?:[- ]SBS|\+)?(?![A-Za-z0-9])/g;

/** Lines named in a phrase ("downtown A, C or E", "Church Av-bound F or G train", "southbound NQRW"). */
function linesIn(s: string): string[] {
  const out: string[] = [];
  for (const raw of s.replace(BUS, " ").split(/[\s,/()]+/)) {
    const t = raw.replace(/[.:]$/, "");
    if (LINE.test(t)) out.push(t);
    else if (LINE_RUN.test(t)) out.push(...t.split(""));
  }
  return [...new Set(out)];
}

/** "the 170 St 4 station" → name "170 St", lines ["4"]; "47-50 Sts/Rockefeller Ctr B/D/F/M" → lines B D F M. */
function nameAndLines(s: string): { name: string; lines: string[] } {
  const words = s.replace(/^(?:the|access(?: to)?)\s+/i, "").replace(/\s+(?:station|stn)\.?$/i, "").replace(/\s*\(([A-Z0-9])\)/g, " $1").trim().split(/\s+/);
  const lines: string[] = [];
  while (words.length > 1) {
    const last = words[words.length - 1].split("/");
    if (!last.every((t) => LINE.test(t))) break;
    lines.unshift(...last);
    words.pop();
  }
  return { name: words.join(" "), lines };
}

/** A station named after "for" / "at" / "to", with its lines: retried with the last word back when "Avenue H" lost its H. */
function stationNamed(sys: WalkSystem, phrase: string, lines: string[] = []): StationRef {
  const nl = nameAndLines(phrase);
  const ref = findStation(sys, nl.name, nl.lines.length ? nl.lines : lines);
  if (ref.match.status === "not-in-data" && nl.lines.length) {
    const whole = findStation(sys, phrase.replace(/^the\s+/i, "").replace(/\s+station$/i, ""), lines);
    if (whole.match.status !== "not-in-data") return whole;
  }
  return ref;
}

/** Cut a place at the words that follow it. Station names keep their "and" only where none is ("Grand Concourse and E 161 St" is a corner). */
const cutPlace = (s: string, keepAnd = false) =>
  s.split(keepAnd ? /\s+(?:for|then|where|if|via)\b|\s+to\s+(?=access\b)|\s*[.;(]|,\s/i : /\s+(?:and|for|then|where|if|via)\b|\s+or\s+(?=to\b|at\b)|\s*[.,;(]|\s+(?<!Penn\s)station\b/i)[0].trim();

/** The station a "for …" phrase names, or one place given lines ("to Tremont Av for B/D service"). */
function forStation(sys: WalkSystem, place: string | null, tail: string): StationRef | null {
  const service = /^(?:for\s+)?(?:access\s+to\s+)?([A-Z0-9/, ]+?)\s+service\b(?:.*?\bat\s+(?:the\s+)?(.+?)(?:\s+station)?$)?/i.exec(tail);
  if (service && linesIn(service[1]).length) {
    if (service[2]) return stationNamed(sys, service[2], linesIn(service[1]));
    return place ? findStation(sys, place, linesIn(service[1])) : null;
  }
  const where = /^where\s+(.+?)\s+service\s+is\s+available/i.exec(tail);
  if (where && place) return findStation(sys, place, linesIn(where[1]));
  const named = /^(?:for|to)\s+(?:access\s+(?:to\s+)?)?(?:the\s+)?(.+?)$/i.exec(tail);
  if (named && !/\bonward\b|\bservice\b|^subway$|^station$/i.test(named[1])) return stationNamed(sys, named[1]);
  return null;
}

function rideLeg(sys: WalkSystem, c: string): Leg | null {
  const at = /^take\s+(?:a|an|the)\s+(.+?)\s+train\s+at\s+(.+?)(?:\s+station)?$/i.exec(c);
  if (at && linesIn(at[1]).length) return { kind: "ride", lines: linesIn(at[1]), toward: null, from: stationNamed(sys, at[2], linesIn(at[1])), to: null, text: c };
  const m = /\b(?:(?:take|board|ride)\s+(?:a|an|the)|transfer(?:\s+(?:across the platform|cross-platform|via the platform))?\s+(?:to|for)(?:\s+(?:a|an|the))?)\s+(.+?)(?:\s+trains?)?(?:\s+from\s+(.+?))?(?:\s+to\s+(.+))?$/i.exec(c);
  if (!m || /\belevator\b/i.test(m[1]) || m[1].match(BUS)) return null;
  m[1] = m[1].replace(/\s+service$/i, "");
  const lines = linesIn(m[1]);
  if (!lines.length && !/\btrain\b/i.test(c)) return null;
  const words = m[1].split(/\s+/);
  const firstLine = words.findIndex((w) => linesIn(w).length);
  const toward = firstLine > 0 ? words.slice(0, firstLine).join(" ").replace(/,$/, "") : lines.length ? null : m[1];
  const to = m[3] ? cutPlace(m[3]) : null;
  return {
    kind: "ride", lines, toward,
    from: m[2] ? findStation(sys, cutPlace(m[2]), lines) : null,
    to: to ? findStation(sys, to, lines) : null,
    text: c,
  };
}

function busLeg(sys: WalkSystem, c: string): Leg | null {
  const routes = [...c.matchAll(BUS)].map((r) => r[0].replace(/\s+SBS$/, "-SBS"));
  if (!routes.length || !/\b(?:take|board|transfer to|ride)\b/i.test(c)) return null;
  const first = c.search(BUS);
  const lastRoute = [...c.matchAll(BUS)].pop()!;
  const before = c.slice(0, first).replace(/^.*?\b(?:take|board|transfer to|ride)\s+(?:a|an|the)?\s*/i, "").trim();
  let rest = c.slice((lastRoute.index ?? 0) + lastRoute[0].length).replace(/^\s*(?:bus(?:es)?|SBS)\b/i, "").trim();
  let from: string | null = null;
  const paren = /^\(([^)]+)\)\s*/.exec(rest);
  if (paren) { from = paren[1].trim(); rest = rest.slice(paren[0].length); }
  const fromAt = /^from\s+(.+?)\s+(?=to\b)/i.exec(rest);
  if (fromAt) { from = fromAt[1].replace(/\s*\(.*?\)\s*/g, " ").trim(); rest = rest.slice(fromAt[0].length); }
  const toM = /\bto\s+(.+)$/i.exec(rest.replace(/^\d+\s+stops?\s*(?:\([^)]*\))?\s*/i, ""));
  const toText = toM ? toM[1] : "";
  const to = toText ? cutPlace(toText, true) : null;
  const tail = toText.slice(to?.length ?? 0).replace(/^[\s,]+/, "");
  const stations: StationRef[] = [];
  if (to && /\bstation$/i.test(to)) stations.push(stationNamed(sys, to));
  else {
    const s = forStation(sys, to, tail);
    if (s) stations.push(s);
  }
  return {
    kind: "bus", routes, toward: before ? before.replace(/\s+or$/i, "") : null, from,
    to: to && /\bstation$/i.test(to) ? to.replace(/\s+station$/i, "") : to, stations, text: c,
  };
}

/** "Exit at 170 St for the 170 St 4 station, at Fordham Rd for the Fordham Rd 4 station, or at …": where to leave the bus. */
function busStops(sys: WalkSystem, c: string, bus: Extract<Leg, { kind: "bus" }>): boolean {
  if (!/^exit\s+(?:the\s+bus\s+)?at\b/i.test(c)) return false;
  const hits = [...c.matchAll(/\bat\s+(.+?)\s+for\s+(?:the\s+)?(.+?)(?=,|\s+or\s+at\b|$)/gi)];
  if (hits.length) {
    for (const h of hits) bus.stations.push(stationNamed(sys, h[2]));
    bus.to ??= hits[0][1].trim();
  } else {
    bus.to = cutPlace(c.replace(/^exit\s+(?:the\s+bus\s+)?at\s+/i, ""), true);
  }
  return true;
}

function walkLeg(sys: WalkSystem, c: string): Leg | null {
  if (!/^(?:proceed|go|travel|walk|head|cross|follow|continue|north|south|east|west|take\s+(?!a\b|an\b|the\b))\b/i.test(c)) return null;
  const toM = /\bto\s+(?:get\s+to\s+)?(?:the\s+)?(.+)$/i.exec(c);
  if (!toM) return { kind: "walk", to: null, station: null, text: c };
  const to = cutPlace(toM[1], true);
  const tail = toM[1].slice(to.length).replace(/^[\s,]+/, "");
  let station: StationRef | null = null;
  if (/\bstation$/i.test(to) && !/^station$/i.test(to)) station = stationNamed(sys, to);
  else station = forStation(sys, to, tail);
  return { kind: "walk", to: /^station$/i.test(to) ? null : to.replace(/\s+station$/i, ""), station, text: c };
}

function transferAt(sys: WalkSystem, c: string): Leg | null {
  const m = /^transfer\s+at\s+(?:either\s+)?(.+?)(?:\s+for\s+(.+))?$/i.exec(c);
  if (!m) return null;
  // "for onward 4, 5, 6 service" says which 125 St.
  const lines = m[2] ? linesIn(m[2].replace(/\bservice\b.*$/i, "")) : [];
  return { kind: "transfer", at: m[1].split(/\s*(?:,|\bor\b)\s*/).filter(Boolean).map((n) => findStation(sys, cutPlace(n), lines)), text: c };
}

function legsOf(sys: WalkSystem, clause: string, prev: Leg | undefined): Leg[] {
  const c = clause.replace(/^(?:then|and|also),?\s+/i, "").replace(/[.,;:]+$/, "").replace(/\s*\(([A-Z0-9])\)(?=\s+station\b)/gi, " $1").trim();
  if (!c) return [];
  // "To access the Yankees-E 153 St station, travel south on River Av to 157 St": a walk to that station.
  const target = /^to\s+access\s+(?:the\s+)?(.+?\s+station),\s*(.+)$/i.exec(c);
  if (target) {
    const walk = walkLeg(sys, target[2]);
    if (walk?.kind === "walk") return [{ ...walk, station: walk.station ?? stationNamed(sys, target[1]) }];
  }
  if (/station agent|helppoint|autogate|re-enter/i.test(c)) return [{ kind: "agent", text: c }];
  if (prev?.kind === "bus" && busStops(sys, c, prev)) return [];
  const alight = /^for\s+(.+?),\s+exit\s+the\s+bus\s+at\s+(.+)$/i.exec(c);
  if (alight && prev?.kind === "bus") {
    prev.stations.push(stationNamed(sys, alight[1]));
    prev.to ??= alight[2];
    return [];
  }
  const enter = /^enter\s+(?:the\s+)?(.+?\s+station)\b/i.exec(c);
  if (enter) return [{ kind: "walk", to: null, station: stationNamed(sys, enter[1]), text: c }];
  const legs: Leg[] = [];
  if (/^(?:use|take)\s+(?:the\s+|an?\s+)?(?:nearby\s+|adjacent\s+|another\s+)?(?:elevators?|EL\d+)\b/i.test(c)) legs.push({ kind: "elevator", text: c });
  const ride = busLeg(sys, c) ?? rideLeg(sys, c) ?? transferAt(sys, c);
  if (ride) return [...legs, ride];
  if (legs.length) return legs;
  if (/^exit\s+(?:the\s+)?station$|^exit\s+through\s+the\s+faregates?/i.test(c)) return [{ kind: "exit", text: c }];
  const walk = walkLeg(sys, c);
  // "… and proceed west to the station": the station the walk is already heading for.
  if (walk?.kind === "walk" && !walk.to && !walk.station && /\bto\s+the\s+station$/i.test(c) && prev?.kind === "walk") return [{ ...walk, station: prev.station }];
  if (walk) return [walk];
  if (prev?.kind === "walk" && /^(?:north|south|east|west)\b/i.test(c)) return [{ kind: "walk", to: null, station: null, text: c }];
  // "Take Meeker Av to Metropolitan Av, and Metropolitan Av to Lorimer St": the walk goes on.
  const on = /^([A-Z0-9][^,]*?)\s+to\s+([A-Z0-9][^,]*)$/.exec(c);
  if (prev?.kind === "walk" && on) return [{ kind: "walk", to: on[2], station: null, text: c }];
  return [{ kind: "note", text: c }];
}

/** The MTA's text in sentences: line breaks inside a sentence joined, "St. Nicholas" kept whole. */
function sentences(text: string): string[] {
  const lines = text.replace(/\r/g, "").replace(/[’‘]/g, "'").replace(/[–—]/g, "-").replace(/(\d)or\b/g, "$1 or").split("\n").map((l) => l.trim()).filter(Boolean);
  const joined: string[] = [];
  for (const l of lines) {
    const prev = joined[joined.length - 1];
    if (prev !== undefined && !/[.:!?]$/.test(prev) && !/^(?:If you|For |To )/.test(l)) joined[joined.length - 1] = `${prev} ${l}`;
    else joined.push(l);
  }
  return joined.flatMap((l) =>
    l.replace(/\bSt\.\s+(?=(?:Nicholas|George|Mark|James|Lawrence|Albans|Edward|John|Felix|Ann|Paul|Peter|Mary|Clair)\b)/g, "St ")
      .replace(/,\s+Or,?\s+/g, ". Or, ")
      .split(/(?<=[.!?:])\s+(?=[A-Z(])/),
  ).map((s) => s.trim()).filter(Boolean);
}

const SKIP = /out of service for replacement|read on for alternatives|^note that\b/i;
const IF_ON = /^If you(?:'re| are)\s+(?:on|at|in)\s+(?:the\s+)?(?:on the\s+)?([^:]+?)(?:\s+level)?:\s*/i;
const HEADING = /^((?:For|To access|To)\s[^:,]{1,60}|[A-Z][^:,]{2,40}):\s*/;
const HEADING_COMMA = /^(For\s+(?:[A-Z0-9/]+|[^,]{1,60}?\bservice\b[^,]{0,40})|To exit(?: the station)?),\s*/;
const CLAUSES = /\s*;\s*|\.\s+|\s+then,?\s+|,?\s+and then\s+|,\s+and\s+(?=[a-z])|\s+and\s+(?=(?:take|use|proceed|transfer|exit|travel|follow|cross|board|go|head|walk|change)\b)/i;

function startFrom(where: string): Start | null {
  if (/street/i.test(where)) return "street";
  if (/mezzanine|concourse|landing|control/i.test(where)) return "mezzanine";
  if (/platform/i.test(where)) return "platform";
  return null;
}

function endOf(legs: Leg[]): JourneyEnd {
  for (let i = legs.length - 1; i >= 0; i--) {
    const l = legs[i];
    if (l.kind === "ride" && (l.to || l.from)) return { kind: "station", stations: [(l.to ?? l.from)!] };
    if (l.kind === "bus" && l.stations.length) return { kind: "station", stations: l.stations };
    if (l.kind === "bus" && l.to) return { kind: "street", place: l.to };
    if (l.kind === "walk" && l.station) return { kind: "station", stations: [l.station] };
    if (l.kind === "walk" && l.to) return { kind: "street", place: l.to };
    if (l.kind === "transfer" && l.at.length) return { kind: "station", stations: l.at };
  }
  return { kind: "unknown" };
}

/** Where a journey with no "If you are on the …" heading starts, from its first leg. */
function startOf(legs: Leg[]): Start | null {
  const first = legs.find((l) => l.kind !== "note");
  if (!first) return null;
  if (first.kind === "ride" || first.kind === "transfer") return "train";
  if (first.kind === "walk" || first.kind === "bus") return "street";
  if (first.kind === "exit" || first.kind === "agent") return "mezzanine";
  return null;
}

/** The MTA's alternative route as journeys, one per heading and per "Or" alternative. */
function detourJourneys(sys: WalkSystem, alternative: string): Journey[] {
  type Draft = { heading: string | null; goal: string | null; start: Start | null; explicit: boolean; legs: Leg[]; branchAt: number };
  const out: Draft[] = [];
  let cur: Draft = { heading: null, goal: null, start: null, explicit: false, legs: [], branchAt: 0 };
  const open = (d: Draft) => { if (cur.legs.length) out.push(cur); cur = d; };
  for (let s of sentences(alternative)) {
    if (SKIP.test(s)) continue;
    const on = IF_ON.exec(s);
    if (on) {
      open({ heading: s.slice(0, on[0].length).replace(/:\s*$/, ""), goal: null, start: startFrom(on[1]), explicit: true, legs: [], branchAt: 0 });
      s = s.slice(on[0].length);
    } else if (/^then,?\s+either:?$/i.test(s)) {
      cur.branchAt = cur.legs.length;
      continue;
    } else if (/^(?:or|alternatively),?\s+/i.test(s)) {
      const keep = cur.legs.slice(0, cur.branchAt);
      open({ ...cur, legs: keep });
      // An "Or" that comes right after a heading with nothing yet still opens a journey of its own.
      if (!keep.length) out.push({ ...cur, legs: [] });
      s = s.replace(/^(?:or|alternatively),?\s+/i, "");
    } else {
      const h = HEADING.exec(s) ?? HEADING_COMMA.exec(s);
      if (h && !/^then\b/i.test(h[1])) {
        const inherit = cur.explicit ? cur.start : null;
        open({ heading: h[1], goal: h[1].replace(/^(?:for|to access|to)\s+/i, "").replace(/^access to\s+/i, ""), start: inherit, explicit: cur.explicit, legs: [], branchAt: 0 });
        s = s.slice(h[0].length);
      }
    }
    // "… then either: Take a Queens-bound R …" branches after this sentence.
    const either = /,?\s*\bthen,?\s+either:?$/i;
    const branches = either.test(s);
    for (const clause of s.replace(either, "").split(CLAUSES)) cur.legs.push(...legsOf(sys, clause, cur.legs[cur.legs.length - 1]));
    if (branches) cur.branchAt = cur.legs.length;
  }
  if (cur.legs.length) out.push(cur);
  return out.filter((d) => d.legs.length).map((d) => ({
    heading: d.heading, goal: d.goal, start: d.start ?? startOf(d.legs), legs: d.legs, end: endOf(d.legs),
  }));
}

function stationsIn(journeys: Journey[]): StationRef[] {
  const seen = new Map<string, StationRef>();
  const add = (r: StationRef | null) => { if (r) seen.set(`${norm(r.name)}|${r.lines.join(",")}`, seen.get(`${norm(r.name)}|${r.lines.join(",")}`) ?? r); };
  for (const j of journeys) {
    for (const l of j.legs) {
      if (l.kind === "ride") { add(l.from); add(l.to); }
      if (l.kind === "bus") l.stations.forEach(add);
      if (l.kind === "walk") add(l.station);
      if (l.kind === "transfer") l.at.forEach(add);
    }
  }
  return [...seen.values()];
}

/** The walk's facts for one elevator outage. */
export function elevatorWalk(o: Outage, sys: WalkSystem, opts: ElevatorWalkOpts = {}): ElevatorWalk {
  const noDetour = !o.alternative.trim() || /alt(?:ernative)? route not available/i.test(o.alternative);
  const journeys = noDetour ? [] : detourJourneys(sys, o.alternative);
  return {
    id: o.id,
    station: o.station,
    where: elevatorWhere(o.serving),
    corner: mtaCorner(o.serving),
    entrance: matchEntrance(sys, o, opts),
    journeys,
    detourStations: stationsIn(journeys),
    noDetour,
  };
}
