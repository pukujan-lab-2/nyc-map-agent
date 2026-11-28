import { formatStationName, formatStreetText } from "@/lib/streetName";
import { sameStation, towardEnd } from "@/lib/transit/serviceChanges";
import { namedStations, noticeSkips, routeEnds, skippedStations } from "./alertFocus";
import type { TransitAlert } from "./hooks";
import { stationOf, type StaticSystem } from "./model";

/**
 * A service notice as a small line diagram (owner, 2026-11-07: "reading these
 * things are still hard … i wish there was option for graph walk"): the
 * affected stretch in travel order and what happens at each station. The
 * steps read under it are the notice walk's (`noticeWalk.ts`), built from the
 * notice's facts and fixed sentences (plan step 3). Pure.
 */
/** "noted": the notice is about this station, and trains still stop there; the diagram's `tag` says what. */
export type StopState = "skip" | "closed" | "shuttle" | "local" | "transfer" | "noted" | "open";
export interface DiagramStop {
  id: string; name: string; state: StopState;
  /** Lines to change to, for a station off this line. */
  off?: string[];
  /** Where the shuttle bus stops for this station, from the MTA's own note. */
  corners?: Corner[];
}
/** "Broadway at 231 Street", with "northbound", "toward Lefferts Boulevard" or "for the A" when the note gives one. */
export interface Corner { text: string; note?: string }
/** Stations left out between two rows. */
export interface DiagramGap { gap: number }
export type DiagramRow = DiagramStop | DiagramGap;
export interface AlertDiagram {
  kind: "skip" | "suspended" | "shuttle" | "local" | "named";
  /** What a "noted" station's tag says: "No live times", "Boarding change", "Delays", "Affected". */
  tag?: string;
  /** Who it is for: "Uptown A", "Both ways", "No 1 trains". */
  heading: string;
  /** Top to bottom in the direction of travel; north at the top when it is both ways. */
  rows: DiagramRow[];
  /** A shuttle notice: the stations the bus calls at, in the order it runs, ends included. */
  bus?: string[];
}

export const isGap = (r: DiagramRow): r is DiagramGap => "gap" in r;

/** MTA icons and bullets as words: "[4][5] or [6]" -> "4, 5 or 6"; "[shuttle bus icon]" -> "shuttle". */
export function cleanAlertText(s: string): string {
  return s
    .replace(/\[shuttle bus icon\]/gi, "shuttle")
    .replace(/\[[a-z][\w ]*icon\]/gi, "")
    .replace(/\](?=\[)/g, "], ")
    .replace(/\[([A-Z0-9]+)\]/g, "$1")
    .replace(/[ \t]+/g, " ")
    .replace(/ +([.,])/g, "$1");
}

type Feature = StaticSystem["stations"]["features"][number];
const nameOf = (sys: StaticSystem, id: string) => String(sys.stations.features.find((f) => f.properties.id === id)?.properties.name ?? id);
const said = (n: string) => formatStationName(n);
const exact = (a: string, b: string) => a.toLowerCase().replace(/[^a-z0-9]/g, "") === b.toLowerCase().replace(/[^a-z0-9]/g, "");
/** Drop trailing clauses an alert hangs on a station name ("… during this time", "… [accessibility icon]"). */
const trimName = (s: string) => s.replace(/\s+(?:during|from|until|through|on|for|stopping|every|instead)\b.*$/i, "").replace(/[.,;:]+$/, "").trim();
const bulletList = (s: string) => [...s.matchAll(/\b([A-Z0-9])\b/g)].map((m) => m[1]);

/** The station a name means: on the line first, then one serving `lines`, an exact name before a close one. */
function findStation(sys: StaticSystem, name: string, onLine: Record<string, number>, lines: string[] = []): Feature | undefined {
  const hits = sys.stations.features.filter((f) => sameStation(name, String(f.properties.name)));
  const score = (f: Feature) => (f.properties.id in onLine ? 4 : 0) + (lines.some((l) => String(f.properties.routes ?? "").split(/[\s,]+/).includes(l)) ? 2 : 0) + (exact(name, String(f.properties.name)) ? 1 : 0);
  return hits.sort((a, b) => score(b) - score(a))[0];
}

/** Every station of the line that holds the most of `ids`, in track order (a local stop is on the A, not the D). */
function trackOrder(sys: StaticSystem, route: string, ids: string[]): { line: string; seq: string[] } {
  const count = (r: string) => ids.filter((id) => id in (sys.stopM[r] ?? {})).length;
  let line = route;
  for (const r of Object.keys(sys.stopM)) if (count(r) > count(line)) line = r;
  const sm = sys.stopM[line] ?? {};
  return { line, seq: Object.keys(sm).sort((a, b) => sm[a] - sm[b]) };
}

/** Index 0 or 1 of the end a direction label points to; "Uptown" and "Downtown" by latitude. */
function towardIndex(sys: StaticSystem, line: string, label: string | null): 0 | 1 | null {
  const ends = routeEnds(sys, line);
  if (!label || ends.length !== 2) return null;
  const named = towardEnd(label, ends);
  if (named !== null) return named;
  const north = ends[0].at[1] > ends[1].at[1] ? 0 : 1;
  if (/^uptown$/i.test(label)) return north;
  if (/^downtown$/i.test(label)) return north === 0 ? 1 : 0;
  return null;
}

/** "72 St, 86 St and 96 St"; a long run as "7 stops, 72 St to 116 St". */
function stationWords(names: string[]): string {
  const n = names.map(said);
  if (n.length <= 3) return n.length > 1 ? `${n.slice(0, -1).join(", ")} and ${n.at(-1)}` : n[0] ?? "";
  return `${n.length} stops, ${n[0]} to ${n.at(-1)}`;
}
const orWords = (parts: string[]) => (parts.length > 1 ? `${parts.slice(0, -1).join(", ")} or ${parts.at(-1)}` : parts[0] ?? "");

type Transfer = { text: string; at: Array<{ name: string; lines: string[] }>; bus?: true };
const withArticle = (s: string) => `${/^[aeiou]/i.test(s) ? "an" : "a"} ${s}`;

/**
 * Where to change, from the alert's own advice:
 *  - "For service to these stations, take the A to 125 St and transfer to a downtown A or D."
 *  - "Transfer between 1 and shuttle buses at Dyckman St or between A and shuttle buses at Inwood-207 St."
 */
function transfers(text: string, affected: string): Transfer[] {
  const out: Transfer[] = [];
  const bus: Transfer["at"] = [];
  for (const line of cleanAlertText(text).split(/\n/).map((l) => l.trim())) {
    const svc = /^For service (to|from) (?:these|this) stations?,? take (?:the |an? )?(.+?) to (.+?) and transfer to (?:an? |the )?(.+?)\.?$/i.exec(line);
    const explicit = /^For service (to|from) (.+?), transfer at (.+?) to (.+?)\.?$/i.exec(line);
    if (svc) {
      const [, way, ride, at, to] = svc;
      // "59 St or Grand Central-42 St", "Queens Plaza or the F to 21 St-Queensbridge"
      const names = at.split(/\s+or\s+(?:the [A-Z0-9] to )?|,\s*/).map(trimName).filter(Boolean);
      const where = orWords(names.map(said));
      const trip = `take the ${ride} to ${where} and change to ${withArticle(to.replace(/\b([1-7])(?:,| and) \1X\b/g, "$1 or $1X"))}`;
      const text = way.toLowerCase() === "to" ? `To reach ${affected}, ${trip}.` : `Starting at ${affected}, ${trip}.`;
      out.push({ text, at: names.map((name) => ({ name, lines: [] })) });
    } else if (explicit) {
      const [, way, goal, at, train] = explicit;
      const destination = goal.replace(/and\/or transfer to (.+?) ((?:[A-Z0-9](?:, | and ))+[A-Z0-9])$/, (_, station: string, routes: string) =>
        `or to transfer to the ${orWords(bulletList(routes))} at ${station}`);
      const lead = way.toLowerCase() === "to" ? "To reach" : "From";
      out.push({ text: said(`${lead} ${destination}, change at ${at} to ${train}.`), at: [{ name: trimName(at), lines: [] }] });
    } else if (/^Transfer between/i.test(line)) {
      for (const p of line.matchAll(/between ([A-Z0-9][A-Z0-9, ]*?(?: or [A-Z0-9])?) and shuttle(?: bus(?:es)?)? at ([^.]+?)(?= or between|\.|$)/gi)) bus.push({ name: trimName(p[2]), lines: bulletList(p[1]) });
    }
  }
  // The shuttle changes read as one sentence: "Change at Dyckman St for the 1, or at Inwood-207 St for the A."
  if (bus.length) out.push({ text: `Change at ${bus.map((t) => `${said(t.name)}${t.lines.length ? ` for the ${orWords(t.lines)}` : ""}`).join(", or at ")}.`, at: bus, bus: true });
  return out;
}

/** "In Manhattan, downtown [D] runs local from 125 St to 59 St-Columbus Circle" for this route. */
function localRun(text: string, route: string): { toward: string | null; from: string; to: string } | null {
  for (const line of cleanAlertText(text).split(/\n/)) {
    const m = /(?:\b(uptown|downtown|[A-Z][\w.' ]*?)-?(?:bound)? )?\b([A-Z0-9])\b (?:local )?(?:trains? )?runs? local (?:from|between) (.+?) (?:to|and) ([^.\n]+)/i.exec(line);
    if (m && m[2] === route) {
      const toward = m[1] ? m[1].replace(/^(?:In [\w ]+, )?/i, "").trim() : null;
      return { toward: toward ? toward.charAt(0).toUpperCase() + toward.slice(1) : null, from: trimName(m[3]), to: trimName(m[4]) };
    }
  }
  return null;
}

/** "Free shuttle buses run between Van Cortlandt Park-242 St and Dyckman St." */
function shuttleRange(text: string): [string, string] | null {
  const m = /shuttle bus(?:es)? (?:run|runs|make stops|operate|operates|stop) between (.+?) and ([^,.\n]+)/i.exec(cleanAlertText(text));
  return m ? [trimName(m[1]), trimName(m[2])] : null;
}

const MAX_ROWS = 14;
/** The stretch from `lo` to `hi` as rows, long runs of normal stations folded into a gap. */
function rowsFor(seq: string[], lo: number, hi: number, state: Map<string, StopState>, sys: StaticSystem, reverse: boolean): DiagramRow[] {
  const ids = seq.slice(lo, hi + 1);
  if (reverse) ids.reverse();
  const out: DiagramRow[] = [];
  let run: string[] = [];
  const flush = (last: boolean) => {
    // Keep a run of normal stations short; the first and last stations of the stretch always show.
    if (run.length > 2 && ids.length > MAX_ROWS) {
      out.push({ gap: run.length - (last ? 1 : 0) });
      if (last) out.push({ id: run.at(-1)!, name: nameOf(sys, run.at(-1)!), state: "open" });
    } else for (const id of run) out.push({ id, name: nameOf(sys, id), state: "open" });
    run = [];
  };
  ids.forEach((id, i) => {
    const s = state.get(id) ?? "open";
    if (s === "open" && i > 0 && i < ids.length - 1) { run.push(id); return; }
    flush(false);
    out.push({ id, name: nameOf(sys, id), state: s });
  });
  flush(true);
  return out;
}

/** The order to draw: travel order for one direction, otherwise north at the top. */
function drawReversed(sys: StaticSystem, line: string, toward: string | null): boolean {
  const i = towardIndex(sys, line, toward);
  if (i !== null) return i === 0;
  const ends = routeEnds(sys, line);
  return ends.length === 2 && ends[0].at[1] < ends[1].at[1];
}

/** Stations named for changing that are off this line, as rows after the stretch. */
function offRows(sys: StaticSystem, list: Array<{ name: string; lines: string[] }>, onLine: Record<string, number>, seen: Set<string>): DiagramStop[] {
  const out: DiagramStop[] = [];
  for (const t of list) {
    const f = findStation(sys, t.name, onLine, t.lines);
    if (!f || seen.has(f.properties.id)) continue;
    seen.add(f.properties.id);
    out.push({ id: f.properties.id, name: String(f.properties.name), state: "transfer", off: t.lines.length ? t.lines : String(f.properties.routes ?? "").split(/[\s,]+/).filter(Boolean).slice(0, 4) });
  }
  return out;
}

const idsOf = (sys: StaticSystem, t: Transfer, onLine: Record<string, number>) =>
  t.at.map((x) => findStation(sys, x.name, onLine, x.lines)?.properties.id).filter((id): id is string => Boolean(id));

/** Ids on `seq` from one named end to the other, inclusive; null when either name is not on it. */
function between(sys: StaticSystem, seq: string[], onLine: Record<string, number>, a: string, b: string): [number, number] | null {
  const i = seq.indexOf(findStation(sys, a, onLine)?.properties.id ?? "");
  const j = seq.indexOf(findStation(sys, b, onLine)?.properties.id ?? "");
  return i < 0 || j < 0 ? null : [Math.min(i, j), Math.max(i, j)];
}

/** The diagram for one alert on one line, or null when nothing in it maps onto stations. */
export function alertDiagram(a: TransitAlert, sys: StaticSystem | undefined, route: string): AlertDiagram | null {
  if (!sys || !sys.stopM[route]) return null;
  const all = `${a.text}\n${a.description ?? ""}`;
  return suspension(a, sys, route, all) ?? skipStops(a, sys, route, all) ?? local(a, sys, route, all) ?? named(a, sys, route);
}

const MAX_NAMED = 10;
/**
 * A notice that takes no train away but names its stations (owner, 2026-11-14: "not sure if it does for train
 * affected"): "Downtown [1] trains are stopping at 116 St…, but real-time arrival information may be unavailable",
 * a boarding change, a closed staircase, a delay at one station. The stations are drawn on their stretch of line
 * and tagged with what the notice is about.
 */
function named(a: TransitAlert, sys: StaticSystem, route: string): AlertDiagram | null {
  const head = cleanAlertText(a.text);
  // "the St George-bound platform" and "Coney Island-bound D trains" name a direction, not a station of the notice.
  const text = head.replace(/\b[A-Z][\w.']*(?:[ -][A-Z][\w.']*){0,3}-bound\b/g, " ");
  // The line that holds the most of the headline's stations: the A's "stops at 50 St, 23 St" are on the C's track.
  let line = route, hits = namedStations(text, sys, route);
  for (const r of Object.keys(sys.stopM)) {
    if (r === route) continue;
    const h = namedStations(text, sys, r);
    // Only a line that shares track with this one.
    if (h.length > hits.length && Object.keys(sys.stopM[route]).some((id) => id in sys.stopM[r])) { line = r; hits = h; }
  }
  const sm = sys.stopM[line];
  const seq = Object.keys(sm).sort((x, y) => sm[x] - sm[y]);
  const at = (id: string) => seq.indexOf(id);
  // Two stations of one name on the line (36 St in Queens and in Brooklyn): only the feed's list can say which.
  const listed = new Set(a.stops.map((x) => stationOf(sys.system, x)));
  hits = hits.filter((id) => listed.has(id) || hits.filter((o) => nameOf(sys, o) === nameOf(sys, id)).length === 1);
  const adds = a.kind !== "delay" && /\bstops? at\b/i.test(head) && !/arrival/i.test(head);
  // The feed's own station list fills in names that do not match by word ("Cathedral Pkwy-110 St"): those between
  // the named ones, or a few when the headline names none.
  const informed = [...new Set(a.stops.map((x) => stationOf(sys.system, x)))].filter((id) => id in sm);
  const lo0 = Math.min(...hits.map(at)), hi0 = Math.max(...hits.map(at));
  const extra = adds ? [] : hits.length ? informed.filter((id) => at(id) > lo0 && at(id) < hi0) : informed.length <= 4 ? informed : [];
  const ids = [...new Set([...hits, ...extra])].sort((x, y) => at(x) - at(y));
  if (!ids.length || ids.length > MAX_NAMED) return null;
  const idx = ids.map(at);
  // A direction only when it is the train's: "Downtown 1 trains", "Coney Island-bound F".
  const m = /\b([Uu]ptown|[Dd]owntown|[A-Z][\w.']*(?: [A-Z][\w.']*){0,2}-bound) (?:[A-Z0-9]\b|trains?\b)/.exec(head);
  const dir = m ? m[1].charAt(0).toUpperCase() + m[1].slice(1).replace(/-bound$/, "") : null;
  const tag = /arrival (?:information|times?)/i.test(head) ? "No live times" : /\bboard/i.test(head) ? "Boarding change" : a.kind === "delay" ? "Delays" : "Affected";
  const state = new Map<string, StopState>(ids.map((id) => [id, adds ? "local" : "noted"]));
  const who = dir ? `${/^(?:Uptown|Downtown)$/.test(dir) ? dir : `${dir}-bound`} ${route}` : route;
  return { kind: "named", heading: who, tag, rows: rowsFor(seq, Math.max(0, Math.min(...idx) - 1), Math.min(seq.length - 1, Math.max(...idx) + 1), state, sys, drawReversed(sys, line, dir)) };
}

/**
 * The MTA's note for each station (`station_alternative`), as the corners its shuttle bus stops at:
 * "[shuttle bus icon] W 231 St at Broadway (S/B)" -> { text: "West 231 Street at Broadway", note: "southbound" }.
 */
export function shuttleCorners(a: TransitAlert, sys: StaticSystem): Map<string, Corner[]> {
  const out = new Map<string, Corner[]>();
  for (const alt of a.alternatives ?? []) {
    const id = stationOf(sys.system, alt.stop);
    const corners = alt.notes.split(/\n/).filter((l) => /\[shuttle bus icon\]/i.test(l)).map((l) => {
      const raw = l.replace(/\[[^\]]*icon\]/gi, "").trim();
      const m = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(raw);
      const where = m ? m[1] : raw;
      const tag = m?.[2] ?? "";
      const note = /^N\/?B$/i.test(tag) ? "northbound" : /^S\/?B$/i.test(tag) ? "southbound" : /^E\/?B$/i.test(tag) ? "eastbound" : /^W\/?B$/i.test(tag) ? "westbound"
        : /^to /i.test(tag) ? `toward ${formatStationName(tag.slice(3))}` : /^[A-Z0-9]$/.test(tag) ? `for the ${tag}` : tag || undefined;
      return { text: formatStreetText(where), ...(note ? { note } : {}) };
    }).filter((c) => c.text);
    if (corners.length) out.set(id, [...(out.get(id) ?? []), ...corners]);
  }
  return out;
}


/**
 * A branch the line's track order does not hold (the A's Lefferts Blvd branch): the named ends and the
 * stations the alert lists, chained nearest-first from the end that is on the line.
 */
function branchOrder(sys: StaticSystem, onLine: Record<string, number>, ends: string[], informed: string[]): string[] | null {
  const byId = new Map(sys.stations.features.map((f) => [f.properties.id, f]));
  const [a, b] = ends.map((n) => findStation(sys, n, onLine));
  if (!a || !b) return null;
  const start = a.properties.id in onLine ? a : b;
  const rest = new Set([a.properties.id, b.properties.id, ...informed.filter((id) => byId.has(id))]);
  rest.delete(start.properties.id);
  const out = [start.properties.id];
  const at = (id: string) => byId.get(id)!.geometry.coordinates as [number, number];
  while (rest.size) {
    const [x, y] = at(out.at(-1)!);
    const next = [...rest].sort((p, q) => Math.hypot(at(p)[0] - x, at(p)[1] - y) - Math.hypot(at(q)[0] - x, at(q)[1] - y))[0];
    out.push(next);
    rest.delete(next);
  }
  return out;
}

function suspension(a: TransitAlert, sys: StaticSystem, route: string, all: string): AlertDiagram | null {
  const change = a.changes?.find((c) => c.kind === "suspended" && c.route === route);
  const bus = shuttleRange(all);
  const ends = change?.names ?? (/^(?:In [\w ]+, )?no /i.test(a.text.trim()) ? bus : null);
  if (!ends || ends.length !== 2) return null;
  const onLine = sys.stopM[route];
  const informedIds = a.stops.map((s) => stationOf(sys.system, s));
  let { seq } = trackOrder(sys, route, []);
  let span = between(sys, seq, onLine, ends[0], ends[1]);
  if (!span) {
    const branch = branchOrder(sys, onLine, ends, informedIds);
    if (!branch) return null;
    seq = branch;
    span = [0, seq.length - 1];
  }
  // By name: the alert may list the other line's platform at a shared station (Delancey St-Essex St on the F).
  const informed = new Set(informedIds.map((id) => nameOf(sys, id)));
  const busSpan = bus ? between(sys, seq, onLine, bus[0], bus[1]) : null;
  const shuttle = Boolean(bus) || (a.replacement?.length ?? 0) > 0;
  const onBus = (i: number) => shuttle && (!busSpan || (i >= busSpan[0] && i <= busSpan[1]));
  const changes = transfers(all, `the affected stops between ${said(ends[0])} and ${said(ends[1])}`);
  const changeIds = new Set(changes.flatMap((t) => t.at).map((t) => findStation(sys, t.name, onLine, t.lines)?.properties.id).filter((id): id is string => Boolean(id && seq.includes(id))));
  const state = new Map<string, StopState>();
  const closed: string[] = [];
  const bused: string[] = [];
  for (let i = span[0]; i <= span[1]; i++) {
    const id = seq[i];
    const end = i === span[0] || i === span[1];
    // An end the alert does not list still has trains: the 1 runs to Dyckman St.
    if (changeIds.has(id)) state.set(id, "transfer");
    else if (!end || informed.has(nameOf(sys, id)) || !informed.size) {
      state.set(id, onBus(i) ? "shuttle" : "closed");
      closed.push(id);
      if (onBus(i)) bused.push(id);
    }
  }
  const open = (i: number) => !state.get(seq[i]) || state.get(seq[i]) === "transfer";
  const lo = Math.max(0, span[0] - (open(span[0]) ? 1 : 0));
  const hi = Math.min(seq.length - 1, span[1] + (open(span[1]) ? 1 : 0));
  const seen = new Set(seq.slice(lo, hi + 1));
  const off = offRows(sys, changes.flatMap((t) => t.at), onLine, seen);
  const corners = shuttleCorners(a, sys);
  const withCorners = (r: DiagramRow): DiagramRow => (!isGap(r) && corners.has(r.id) ? { ...r, corners: corners.get(r.id) } : r);
  const rows = [...rowsFor(seq, lo, hi, state, sys, seq === trackOrder(sys, route, []).seq ? drawReversed(sys, route, null) : false), ...off].map(withCorners);
  const ran = busSpan ?? span;
  return { kind: shuttle ? "shuttle" : "suspended", heading: `No ${route} trains`, rows, ...(shuttle ? { bus: seq.slice(ran[0], ran[1] + 1) } : {}) };
}

/** The direction of a skip: "Uptown", "Flushing", or null for both. */
function skipDirection(all: string): string | null {
  const line = cleanAlertText(all).split(/\n/).find((l) => /\bskips?\b/i.test(l)) ?? "";
  if (/both directions/i.test(line)) return null;
  const m = /\b(uptown|downtown)\b|\b([A-Z][\w.']*(?: [A-Z][\w.']*){0,2})-bound\b/i.exec(line);
  if (!m) return null;
  const w = m[1] ?? m[2];
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function skipStops(a: TransitAlert, sys: StaticSystem, route: string, all: string): AlertDiagram | null {
  // The words, not just the server's skip names: those also catch "No [M] between …" in a note.
  const [change] = noticeSkips(a, route);
  if (!change && !/\bskips?\b/i.test(all)) return null;
  const onLine = sys.stopM[route];
  const skipped = skippedStations(a, sys, route);
  if (!skipped.length) return null;
  const { seq } = trackOrder(sys, route, []);
  const dir = change ? change.toward : skipDirection(all);
  const state = new Map<string, StopState>(skipped.map((id) => [id, "skip"]));
  const reverse = drawReversed(sys, route, dir);
  const names = seq.filter((id) => skipped.includes(id)).map((id) => nameOf(sys, id));
  if (reverse) names.reverse();
  const changes = transfers(all, names.length > 3 ? `the stops from ${said(names[0])} to ${said(names.at(-1)!)}` : stationWords(names));
  const changeIds = changes.map((t) => idsOf(sys, t, onLine));
  for (const id of changeIds.flat()) if (id in onLine && !state.has(id)) state.set(id, "transfer");
  const idx = [...state.keys()].map((id) => seq.indexOf(id)).filter((i) => i >= 0);
  const pad = changeIds.flat().some((id) => id in onLine) ? 0 : 1;
  const lo = Math.max(0, Math.min(...idx) - pad), hi = Math.min(seq.length - 1, Math.max(...idx) + pad);
  const service = change?.route.endsWith("X") ? `${change.route} express` : route;
  const who = dir ? `${/-bound$|^(?:Uptown|Downtown)$/.test(dir) || dir.split(" ").length > 1 ? dir : `${dir}-bound`} ${service} trains` : `${service} trains`;
  return { kind: "skip", heading: dir ? who.replace(/ trains$/, "") : `${service}, both ways`, rows: rowsFor(seq, lo, hi, state, sys, reverse) };
}

function local(a: TransitAlert, sys: StaticSystem, route: string, all: string): AlertDiagram | null {
  const run = localRun(all, route);
  if (!run) return null;
  const informed = a.stops.map((s) => stationOf(sys.system, s));
  const { line, seq } = trackOrder(sys, route, informed);
  const onLine = sys.stopM[line];
  const span = between(sys, seq, onLine, run.from, run.to);
  if (!span) return null;
  const usual = sys.stopM[route];
  const state = new Map<string, StopState>();
  const added: string[] = [];
  for (let i = span[0]; i <= span[1]; i++) if (!(seq[i] in usual)) { state.set(seq[i], "local"); added.push(seq[i]); }
  const reverse = drawReversed(sys, line, run.toward);
  const names = added.map((id) => nameOf(sys, id));
  if (reverse) names.reverse();
  const who = `${run.toward ? `${run.toward} ` : ""}${route}`;
  return { kind: "local", heading: who, rows: rowsFor(seq, span[0], span[1], state, sys, reverse) };
}
