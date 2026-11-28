import { formatStationName, formatStreetText } from "@/lib/streetName";
import { otherDirection, towardEnd } from "@/lib/transit/serviceChanges";
import { hasFacts, noticeFacts, stationIndex, type Advice, type Change, type LineDir, type NoticeFacts, type StationIndex, type StationRef, type Toward } from "../../../server/features/transit/noticeFacts";
import type { SlimAlert } from "../../../server/features/transit/alerts";
import { routeEnds } from "./alertFocus";
import type { TransitAlert } from "./hooks";
import { stationOf, type StaticSystem } from "./model";
import type { StepMap } from "./walkMap";
import { fill, spoken, type PatternKey } from "./walkPatterns";

/**
 * A notice walk (plan step 3, `docs/PLAN-notice-walks.md`): an MTA notice told as short steps that say what to do
 * and where, built from the notice's facts (`noticeFacts`) and the fixed sentences in `walkPatterns.ts`. The rider
 * first picks their stop and whether they are getting off or getting on there; only that case plays, one action a
 * step. Step one says what changes and who it does not touch. There is no "why" step: walks give guidance, not the
 * MTA's reasons (owner, 2026-11-26). Each step carries the map data for what it names (`StepMap`). Pure.
 */
export type TripMode = "off" | "on";
export type Trip = { stop: string; mode: TripMode } | null;

/** One part of a step: a pattern and its filled slots, so step 7 can say the same in another language. */
export type StepPart = { key: PatternKey; slots: Record<string, string> };
/** What the step's words name, for the map audit: every one of these must be in `map`. */
export type Named = { stations: string[]; lines: string[]; buses: string[]; entrances: Array<{ station: string; id: string | null }> };
export interface WalkStep {
  parts: StepPart[];
  /** What the panel shows. */
  text: string;
  /** What the voice says: the same words with short forms in full and numbered streets as ordinals (`spoken`). */
  say: string;
  named: Named;
  map: StepMap;
}
export interface NoticeWalk {
  /** The stations a rider can pick as their stop, in track order; empty when the notice is for every trip. */
  stops: string[];
  steps: WalkStep[];
  /** True when our rules read the notice; false when the walk is the MTA's headline alone. */
  read: boolean;
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Facts for an alert                                                                                             */
/* ------------------------------------------------------------------------------------------------------------ */

const indexes = new WeakMap<StaticSystem, StationIndex>();
const indexOf = (sys: StaticSystem) => {
  let idx = indexes.get(sys);
  if (!idx) indexes.set(sys, (idx = stationIndex(sys.stations.features.map((f) => ({ id: String(f.properties.id), name: String(f.properties.name), routes: String(f.properties.routes ?? "") })))));
  return idx;
};

const read = new WeakMap<object, { sys: StaticSystem; facts: NoticeFacts }>();
/** The facts of a notice: the server's when it sent them, else read here from the notice's text, once per notice. */
export function factsOf(a: TransitAlert & { facts?: NoticeFacts }, sys: StaticSystem): NoticeFacts {
  if (a.facts) return a.facts;
  // Picking another stop builds the walk again; the notice is read once.
  const known = read.get(a);
  if (known?.sys === sys) return known.facts;
  const facts = readFacts(a, sys);
  read.set(a, { sys, facts });
  return facts;
}

function readFacts(a: TransitAlert, sys: StaticSystem): NoticeFacts {
  const slim: SlimAlert = {
    id: a.id, kind: a.kind, type: a.type, reroute: a.reroute, text: a.text, description: a.description ?? "", agency: a.agency, routes: a.routes,
    stops: a.stops.map((s) => stationOf(sys.system, s)), start: a.start ?? 0, end: a.end ?? 0, windows: a.windows, period: a.period ?? "", direction: a.direction ?? "",
    directionIds: a.directionIds ?? [], via: a.via ?? [], skipNames: a.skipNames ?? [], changes: a.changes ?? [], replacement: a.replacement ?? [], alternatives: a.alternatives ?? [],
  };
  return noticeFacts(slim, indexOf(sys));
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Words                                                                                                          */
/* ------------------------------------------------------------------------------------------------------------ */

const LINE_WORD: Record<string, string> = { "7X": "7 express", "6X": "6 express", FX: "F express", GS: "S", FS: "S", H: "S", SI: "Staten Island Railway" };
const lineWord = (l: string) => LINE_WORD[l] ?? l;
const vowelSound = (w: string) => /^(?:[AEFHLMNRSX]\b|[AEFHLMNRSX] |8|11|18|[aeiou])/i.test(w);
const listWords = (xs: string[], joiner = "and") => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} ${joiner} ${xs.at(-1)}` : xs[0] ?? "");
const plural = (n: number) => (n === 1 ? "1 stop" : `${n} stops`);

/** "Flushing" → "Flushing-bound"; "uptown" stays. */
const bound = (t: Toward) => (!t ? "" : /^(?:uptown|downtown)$/i.test(t) ? t.toLowerCase() : `${t}-bound`);

/** Builds one step: every name said is recorded, so the audit can check the map shows it. */
class Step {
  parts: StepPart[] = [];
  named: Named = { stations: [], lines: [], buses: [], entrances: [] };
  map: StepMap = { stations: [], lines: [] };
  constructor(private sys: StaticSystem) {}
  /** A station's name, recorded; an area ("Queens") or a name we lack is said as the MTA wrote it. */
  st(id: string | null, fallback = ""): string {
    if (!id) return fallback;
    this.named.stations.push(id);
    return formatStationName(nameOf(this.sys, id) || fallback);
  }
  refs(rs: StationRef[], joiner = "and"): string {
    // 59 St-Columbus Circle on the 1 and on the A are one name to a rider.
    return listWords([...new Set(rs.map((r) => this.st(r.id, r.name)))], joiner);
  }
  ids(ids: string[], joiner = "and"): string {
    if (ids.length > 4) return `${ids.length} stops, ${this.st(ids[0])} to ${this.st(ids.at(-1)!)}`;
    return listWords(ids.map((id) => this.st(id)), joiner);
  }
  ln(l: string): string { this.named.lines.push(l); return lineWord(l); }
  /** "Flushing-bound 7 trains", "uptown 1 trains", "7 trains". */
  trains(line: string, t: Toward): string { return `${bound(t) ? `${bound(t)} ` : ""}${this.ln(line)} trains`; }
  /** "a Manhattan-bound 7", "an uptown 1", "an F". */
  train(line: string, t: Toward): string {
    const w = `${bound(t) ? `${bound(t)} ` : ""}${this.ln(line)}`;
    return `${vowelSound(w) ? "an" : "a"} ${w}`;
  }
  /** "the Q or a Manhattan-bound D or N", from the MTA's line list. */
  lineDirs(ls: LineDir[]): string {
    const out: string[] = [];
    ls.forEach((l, i) => {
      if (!l.line) { out.push(l.toward ? `${bound(l.toward)} trains` : "any train"); return; }
      const same = i > 0 && ls[i - 1].toward === l.toward && ls[i - 1].line;
      out.push(same ? this.ln(l.line) : l.toward ? this.train(l.line, l.toward) : `the ${this.ln(l.line)}`);
    });
    return listWords(out, "or");
  }
  bus(route: string): string { this.named.buses.push(route); return route; }
  say(key: PatternKey, slots: Record<string, string> = {}): this { this.parts.push({ key, slots }); return this; }
  /* Map. */
  show(...ids: Array<string | null | undefined>): this { for (const id of ids) if (id && !this.map.stations.includes(id)) this.map.stations.push(id); return this; }
  lines(...ls: string[]): this { for (const l of ls) if (!this.map.lines.includes(l)) this.map.lines.push(l); return this; }
  done(): WalkStep {
    const uniq = <T,>(xs: T[]) => [...new Set(xs)];
    this.named = { stations: uniq(this.named.stations), lines: uniq(this.named.lines), buses: uniq(this.named.buses), entrances: this.named.entrances };
    const text = this.parts.map((p) => fill(p.key, p.slots)).join(" ");
    return { parts: this.parts, text, say: spoken(text), named: this.named, map: this.map };
  }
}

const nameOf = (sys: StaticSystem, id: string) => String(sys.stations.features.find((f) => f.properties.id === id)?.properties.name ?? "");

/* ------------------------------------------------------------------------------------------------------------ */
/* Track                                                                                                          */
/* ------------------------------------------------------------------------------------------------------------ */

/** The line's key in our data for a notice line: the 7X runs on the 7's stations, [S] on one of three shuttles. */
function trackLine(sys: StaticSystem, line: string, route: string): string | null {
  if (sys.stopM[line]) return line;
  if (/^\dX$/.test(line) && sys.stopM[line[0]]) return line[0];
  if (lineMatches(line, route) && sys.stopM[route]) return route;
  return null;
}
/** A change on `line` is about the panel's route. */
function lineMatches(line: string, route: string): boolean {
  if (line === route) return true;
  const base = (l: string) => (/^\dX$/.test(l) ? l[0] : l === "FX" ? "F" : ["GS", "FS", "H", "S"].includes(l) ? "S" : l);
  return base(line) === base(route);
}
const seqOf = (sys: StaticSystem, line: string) => {
  const sm = sys.stopM[line] ?? {};
  return Object.keys(sm).sort((a, b) => sm[a] - sm[b]);
};

/** Which end of the line a direction label heads to: 1 = the end with the higher measure, 0 = the lower, null = unknown. */
function endOf(sys: StaticSystem, line: string, t: Toward): 0 | 1 | null {
  const ends = routeEnds(sys, line);
  if (!t || ends.length !== 2) return null;
  const named = towardEnd(t, ends);
  if (named !== null) return named;
  const north = ends[0].at[1] > ends[1].at[1] ? 0 : 1;
  if (/^uptown$/i.test(t)) return north;
  if (/^downtown$/i.test(t)) return north === 0 ? 1 : 0;
  return null;
}
/** The other direction's label: "uptown" for "downtown", "Manhattan" for "Flushing". */
function otherWay(sys: StaticSystem, line: string, t: string): string | null {
  if (/^uptown$/i.test(t)) return "downtown";
  if (/^downtown$/i.test(t)) return "uptown";
  const ends = routeEnds(sys, line);
  const o = otherDirection(t, ends);
  return o === "other direction" ? null : o;
}
/** The direction label from one station to another on the change's track, worded as the notice words it. */
function wayTo(sys: StaticSystem, e: Effect, from: string, to: string): Toward {
  const i = e.seq.indexOf(from), j = e.seq.indexOf(to);
  const t = e.change.toward;
  if (i < 0 || j < 0 || i === j || !t) return null;
  const end = endOf(sys, e.line, t);
  if (end === null) return null;
  return (j > i ? 1 : 0) === end ? t : otherWay(sys, e.line, t);
}
/** The end station's short name for a direction ("Flushing"), for "on toward {end}". */
const endWord = (t: string) => t;

/** Ids between two stations on a track, inclusive, in track order; null when either is not on it. */
function span(seq: string[], a: string | null, b: string | null): string[] | null {
  if (!a || !b) return null;
  const i = seq.indexOf(a), j = seq.indexOf(b);
  if (i < 0 || j < 0) return null;
  return seq.slice(Math.min(i, j), Math.max(i, j) + 1);
}
/** The nearest station on the track that is not in `out`, by stops; ties go to the earlier one. */
function nearestOpen(seq: string[], x: string, out: Set<string>): string | null {
  const i = seq.indexOf(x);
  if (i < 0) return null;
  for (let d = 1; d < seq.length; d++) {
    for (const j of [i - d, i + d]) if (j >= 0 && j < seq.length && !out.has(seq[j])) return seq[j];
  }
  return null;
}

/* ------------------------------------------------------------------------------------------------------------ */
/* What each change does to the line                                                                              */
/* ------------------------------------------------------------------------------------------------------------ */

/** A change read onto our track: the stations trains no longer stop at, and those the rider can pick. */
type Effect = { change: Change; line: string; seq: string[]; out: string[]; picks: string[]; stretch: boolean; blocked?: Set<string> };

const ids = (rs: StationRef[]) => rs.flatMap((r) => (r.id ? [r.id] : []));

function effectOf(sys: StaticSystem, c: Change, route: string, informed: Set<string>, served: Set<string> = new Set(), runs: Array<[string, string]> = []): Effect | null {
  const line = trackLine(sys, c.line, route);
  if (!line) return null;
  const seq = seqOf(sys, line);
  const e = effectOn(c, line, seq, informed, served);
  // "[2] runs between Wakefield-241 St and Times Sq-42 St": no stop outside that has the line either.
  const inside = runs.flatMap(([a, b]) => span(seq, a, b) ?? []);
  if (e && e.stretch && inside.length) e.blocked = new Set([...e.out, ...seq.filter((id) => !inside.includes(id))]);
  return e;
}

function effectOn(c: Change, line: string, seq: string[], informed: Set<string>, served: Set<string>): Effect | null {
  const on = (xs: string[]) => xs.filter((id) => seq.includes(id));
  const base = { change: c, line, seq };
  switch (c.kind) {
    case "skip": { const s = on(ids(c.stations)); return { ...base, out: s, picks: s, stretch: false }; }
    case "closed": { const s = on(ids(c.stations)); return { ...base, out: s, picks: s, stretch: true }; }
    case "express": {
      const run = span(seq, c.from.id, c.to.id);
      const skips = c.skips?.length ? on(ids(c.skips)) : run ? run.slice(1, -1) : [];
      return { ...base, out: skips, picks: skips, stretch: false };
    }
    case "suspended": {
      const run = span(seq, c.from.id, c.to.id);
      if (!run) return { ...base, out: [], picks: [], stretch: true };
      // An end the notice does not list still has trains (the 1 runs to Dyckman St).
      // An end the notice says trains still reach ("[4] runs between Utica Av and 161 St") is open too.
      const closed = run.filter((id, i) => (i > 0 && i < run.length - 1) || ((!informed.size || informed.has(id)) && !served.has(id)));
      return { ...base, out: closed, picks: closed, stretch: true };
    }
    case "reroute": {
      const run = span(seq, c.from?.id ?? null, c.to?.id ?? null);
      const gone = run ? run.slice(1, -1).filter((id) => !(c.stops ?? []).some((s) => s.id === id)) : [];
      return { ...base, out: gone, picks: gone, stretch: true };
    }
    case "platform": case "extraStops": case "entrance": { const s = on(ids(c.stations)); return { ...base, out: [], picks: s, stretch: false }; }
    default: return { ...base, out: [], picks: [], stretch: false };
  }
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Steps                                                                                                          */
/* ------------------------------------------------------------------------------------------------------------ */

/** Step one for a change: what it does, then who it does not touch. */
function leadStep(sys: StaticSystem, e: Effect | null, c: Change, group: string[] = [c.line], shuttle = false): WalkStep {
  const s = new Step(sys);
  const L = c.line;
  s.lines(...group);
  // Words for every line the change is for: "2 and 3", "uptown 2 and 3 trains".
  const lw = () => listWords(group.map((l) => s.ln(l)));
  const tw = (t: Toward) => `${bound(t) ? `${bound(t)} ` : ""}${lw()} trains`;
  const neighbours = (out: string[]) => {
    if (!e || !out.length) return [] as string[];
    const idx = out.map((id) => e.seq.indexOf(id)).filter((i) => i >= 0);
    const lo = e.seq[Math.min(...idx) - 1], hi = e.seq[Math.max(...idx) + 1];
    return [lo, hi].filter(Boolean);
  };
  const track = (extra: Partial<NonNullable<StepMap["tracks"]>[number]> = {}) => {
    if (!e) return;
    const show = [...neighbours(e.out), ...e.out];
    const idx = show.map((id) => e.seq.indexOf(id)).filter((i) => i >= 0);
    if (!idx.length) return;
    s.map.tracks = [...(s.map.tracks ?? []), { line: L, from: e.seq[Math.min(...idx)], to: e.seq[Math.max(...idx)], toward: c.toward, ...extra }];
    s.show(...show);
  };
  const notYou = (out: string[]) => {
    if (out.length === 1) s.say("lead.notYouOne", { station: s.st(out[0]) });
    else if (out.length > 1) s.say("lead.notYou", { stations: out.length > 3 ? "one of these stops" : s.ids(out, "or") });
  };
  switch (c.kind) {
    case "skip": case "express": {
      const out = e?.out ?? ids(c.kind === "skip" ? c.stations : c.skips ?? []);
      if (c.kind === "skip") s.say(c.some ? "lead.skipSome" : "lead.skip", { trains: tw(c.toward), stations: out.length ? s.ids(orderFor(sys, e, out, c.toward)) : s.refs(c.stations) });
      else s.say("lead.express", { trains: tw(c.toward), from: s.st(c.from.id, c.from.name), to: s.st(c.to.id, c.to.name) }).show(c.from.id, c.to.id);
      const other = c.toward && e ? otherWay(sys, e.line, c.toward) : null;
      if (other) s.say("lead.otherWay", { trains: tw(other) });
      track({ skip: out });
      notYou(out);
      break;
    }
    case "closed":
      s.say("lead.closed", { line: lw(), stations: s.refs(c.stations) });
      track({ closed: true, skip: e?.out });
      notYou(e?.out ?? []);
      break;
    case "suspended":
      s.say("lead.suspended", { line: lw(), from: s.st(c.from.id, c.from.name), to: s.st(c.to.id, c.to.name) }).show(c.from.id, c.to.id);
      if (shuttle) s.say("lead.shuttle");
      track({ closed: true });
      if (e?.out.length) s.say("lead.notStretch");
      break;
    case "noService": s.say("lead.noService", { line: lw() }); break;
    case "runs": s.say("lead.runs", { line: lw(), from: s.st(c.from.id, c.from.name), to: s.st(c.to.id, c.to.name) }).show(c.from.id, c.to.id); break;
    case "sections":
      if (!c.sections.length) { s.say("lead.sectionsAny", { line: lw() }); break; }
      s.say("lead.sections", { line: lw(), parts: listWords(c.sections.map(([a, b]) => `${s.st(a.id, a.name)} to ${s.st(b.id, b.name)}`)) });
      for (const [a, b] of c.sections) s.show(a.id, b.id);
      break;
    case "local": s.say("lead.local", { trains: tw(c.toward), from: s.st(c.from.id, c.from.name), to: s.st(c.to.id, c.to.name) }).show(c.from.id, c.to.id); break;
    case "extraStops":
      s.say("lead.extraStops", { trains: tw(c.toward), stations: s.refs(c.stations) }).show(...ids(c.stations));
      if (e) s.map.tracks = [{ line: L, from: e.picks[0] ?? "", to: e.picks.at(-1) ?? "", toward: c.toward, stops: e.picks }].filter((t) => t.from);
      break;
    case "reroute": {
      const via = listWords(c.via.map((v) => s.ln(v)), "and");
      s.lines(...c.via);
      if (c.from || c.to) {
        s.say("lead.reroute", { trains: tw(c.toward), via, from: s.st(c.from?.id ?? null, c.from?.name), to: s.st(c.to?.id ?? null, c.to?.name) }).show(c.from?.id, c.to?.id);
        track({ closed: true });
        if (e?.out.length) s.say("lead.notStretch");
      } else s.say("lead.rerouteAll", { trains: tw(c.toward), via });
      s.show(...ids(c.stops ?? []));
      break;
    }
    case "replacedBy":
      s.lines(c.by);
      if (c.from && c.to) s.say("lead.replacedBy", { by: s.ln(c.by), line: lw(), from: s.st(c.from.id, c.from.name), to: s.st(c.to.id, c.to.name) }).show(c.from.id, c.to.id);
      else s.say("lead.replacedByAll", { by: s.ln(c.by), line: lw() });
      break;
    case "platform":
      s.say("lead.platform", { stations: s.refs(c.stations), trains: tw(c.toward), platform: c.boardFrom }).show(...ids(c.stations));
      if (e?.picks.length) s.say("lead.notBoarding", { stations: e.picks.length > 3 ? "one of these stops" : s.ids(e.picks, "or") });
      break;
    case "frequency":
      if (c.from && c.to) s.show(c.from.id, c.to.id);
      s.say(c.everyMin ? "lead.every" : c.slower ? "lead.slower" : "lead.fewer", { line: lw(), n: String(c.everyMin ?? "") });
      s.say("lead.allTrips", { line: lw() });
      break;
    case "delays":
      if (c.at.length) s.say("lead.delaysAt", { trains: tw(c.toward), stations: s.refs(c.at) }).show(...ids(c.at));
      else s.say("lead.delays", { trains: tw(c.toward) });
      break;
    case "shortTurn": s.say("lead.shortTurn", { line: lw(), station: s.st(c.lastStop.id, c.lastStop.name) }).show(c.lastStop.id); break;
    case "entrance": {
      // The MTA's words when they say which entrance ("east end entrance is closed"); a list of stations is said as ours.
      const detail = cleanAlertText(c.detail).replace(/\s+-\s+/g, ", ").replace(/[.\s]+$/, "").trim();
      if (detail && !/^some entrances/i.test(detail) && detail.length < 140) s.say("lead.entrance", { stations: s.refs(c.stations), detail: lowerFirst(detail) });
      else s.say("lead.entranceSome", { stations: s.refs(c.stations) });
      s.show(...ids(c.stations));
      // Our data cannot say which entrance the MTA means: the walk says so and marks none as the closed one.
      s.say("entrance.gap");
      s.map.entrances = ids(c.stations).map((station) => ({ station, id: null, state: "closed" as const }));
      s.named.entrances.push(...s.map.entrances.map((x) => ({ station: x.station, id: x.id })));
      break;
    }
    case "schedule":
      s.say(c.detail === "ends early" ? "lead.endsEarly" : c.detail === "begins early" ? "lead.beginsEarly" : c.detail === "runs overnight" ? "lead.overnight" : "lead.schedule", { line: lw() });
      if (c.from && c.to) s.show(c.from.id, c.to.id);
      break;
  }
  s.lines(...s.named.lines);
  return s.done();
}
const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

/** Stations in the order trains reach them going `toward`; north first when both ways. */
function orderFor(sys: StaticSystem, e: Effect | null, out: string[], t: Toward): string[] {
  if (!e) return out;
  const sorted = [...out].sort((a, b) => e.seq.indexOf(a) - e.seq.indexOf(b));
  const end = endOf(sys, e.line, t);
  return end === 0 ? sorted.reverse() : sorted;
}

/** The rider's trip through one change: one action a step. Null when the change does not touch their stop. */
function tripSteps(sys: StaticSystem, e: Effect, facts: NoticeFacts, trip: NonNullable<Trip>): WalkStep[] | null {
  const x = trip.stop;
  if (!e.picks.includes(x)) return null;
  const c = e.change;
  const L = c.line;
  const step = () => new Step(sys).lines(L);
  const advised = adviceFor(facts, e, trip);
  if (c.kind === "platform") {
    const s = step();
    if (trip.mode === "on") s.say("platform.on", { you: s.st(x), trains: s.trains(L, c.toward), platform: c.boardFrom });
    else s.say("platform.off", { you: s.st(x) });
    s.map.you = x;
    return [s.show(x).done()];
  }
  if (c.kind === "extraStops") {
    const s = step();
    s.say("extra.you", { you: s.st(x) });
    s.map.you = x;
    return [s.show(x).done()];
  }
  if (c.kind === "entrance") return [];
  // The MTA's own way for this stop comes first: it picked the station to change at.
  if (advised.length) return advised.flatMap((a) => adviceSteps(sys, a, facts, e, trip));
  const out = e.blocked ?? new Set(e.out);
  const shuttle = e.stretch && facts.buses.some((b) => b.shuttle);
  if (shuttle) return shuttleSteps(sys, e, facts, trip);
  const end = c.kind === "skip" || c.kind === "express" ? endOf(sys, e.line, c.toward) : null;
  if (end === null) {
    const near = nearestOpen(e.seq, x, out);
    const s = step();
    const key: PatternKey = e.stretch || c.kind === "reroute"
      ? (near ? (trip.mode === "off" ? "closed.off" : "closed.on") : (trip.mode === "off" ? "closed.offNone" : "closed.onNone"))
      : (trip.mode === "off" ? "skip.offBoth" : "skip.onBoth");
    s.say(key, { you: s.st(x), line: s.ln(L), near: s.st(near) });
    s.map.you = x;
    if (near) s.map.walk = [{ from: x, to: near }];
    return [s.show(x, near).done()];
  }
  // One direction skips: use the other direction to double back. Travel order runs toward the skipping end.
  const seq = end === 1 ? e.seq : [...e.seq].reverse();
  const i = seq.indexOf(x);
  const other = otherWay(sys, e.line, c.toward!) ;
  const served = (id: string) => !out.has(id);
  if (trip.mode === "off") {
    const next = seq.slice(i + 1).find(served);
    if (!next) {
      const prev = seq.slice(0, i).reverse().find(served) ?? null;
      const s = step();
      s.say("skip.offEnd", { you: s.st(x), next: s.st(prev) });
      s.map.you = x;
      return [s.show(x, prev).done()];
    }
    const before = seq.slice(0, i).reverse().find(served) ?? x;
    const a = step();
    a.say("skip.off", { you: a.st(x), next: a.st(next) });
    a.map.you = x;
    a.map.ride = { line: L, from: before, to: next, toward: c.toward };
    a.map.tracks = [{ line: L, from: before, to: next, toward: c.toward, skip: [...out] }];
    const b = step();
    b.say("skip.otherPlatform", { at: b.st(next), trains: b.trains(L, other) });
    b.map.change = [{ at: next, kind: "cross" }];
    b.map.you = x;
    const back = seq.indexOf(next) - i;
    const r = step();
    r.say("skip.rideBack", { train: r.train(L, other), stops: plural(back), you: r.st(x) });
    r.map.you = x;
    r.map.ride = { line: L, from: next, to: x, toward: other };
    return [a.show(before, x, next).done(), b.show(next, x).done(), r.show(next, x).done()];
  }
  // Getting on toward the skipping end: ride the other way to a stop the skipping trains still make.
  const z = seq.slice(0, i).reverse().find(served);
  if (!z) {
    const near = nearestOpen(e.seq, x, out);
    const s = step();
    s.say("skip.onBoth", { you: s.st(x), line: s.ln(L), near: s.st(near) });
    s.map.you = x;
    return [s.show(x, near).done()];
  }
  const after = seq.slice(i + 1).find(served) ?? x;
  const a = step();
  a.say("skip.on", { you: a.st(x), end: endWord(c.toward!), train: a.train(L, other), stops: plural(i - seq.indexOf(z)), at: a.st(z) });
  a.map.you = x;
  a.map.ride = { line: L, from: x, to: z, toward: other };
  const b = step();
  b.say("skip.otherPlatform", { at: b.st(z), trains: b.trains(L, c.toward) });
  b.map.change = [{ at: z, kind: "cross" }];
  const r = step();
  r.say("skip.rideOn", { train: r.train(L, c.toward), you: r.st(x), end: endWord(c.toward!) });
  r.map.ride = { line: L, from: z, to: after, toward: c.toward };
  r.map.tracks = [{ line: L, from: z, to: after, toward: c.toward, skip: [...out] }];
  r.map.you = x;
  return [a.show(x, z).done(), b.show(z, x).done(), r.show(z, x, after).done()];
}

/** The free shuttle bus over a closed stretch: to the bus, where it stops, where to get off. */
function shuttleSteps(sys: StaticSystem, e: Effect, facts: NoticeFacts, trip: NonNullable<Trip>): WalkStep[] {
  const x = trip.stop;
  const L = e.change.line;
  const out = e.blocked ?? new Set(e.out);
  const corner = (id: string) => cornerAt(facts, id);
  const route = facts.buses.find((b) => b.shuttle)?.routes[0] ?? "shuttle";
  const end = nearestOpen(e.seq, x, out);
  const bus = (s: Step, stops: string[]) => {
    s.bus(route);
    s.map.bus = [{ route, shuttle: true, stops: stops.map((station) => ({ station, corner: corner(station) })) }];
  };
  const steps: WalkStep[] = [];
  if (trip.mode === "off") {
    if (end) {
      const a = new Step(sys).lines(L);
      a.say("shuttle.rideTo", { line: a.ln(L), at: a.st(end) });
      a.map.ride = { line: L, from: end, to: end, toward: null };
      a.map.you = x;
      steps.push(a.show(end).done());
      const b = new Step(sys).lines(L);
      const ce = corner(end);
      if (ce) b.say("shuttle.board", { corner: ce });
      else b.say("shuttle.boardUnknown", { at: b.st(end) });
      bus(b, [end]);
      b.map.change = [{ at: end, kind: "bus" }];
      steps.push(b.show(end).done());
    } else {
      const a = new Step(sys).lines(L);
      a.say("shuttle.offYou", { you: a.st(x), line: a.ln(L) });
      bus(a, [x]);
      steps.push(a.show(x).done());
    }
    const c = new Step(sys).lines(L);
    const cx = corner(x);
    if (cx) c.say("shuttle.getOff", { you: c.st(x), corner: cx });
    else c.say("shuttle.getOffUnknown", { you: c.st(x) });
    bus(c, end ? [end, x] : [x]);
    c.map.you = x;
    steps.push(c.show(x, end).done());
    return steps;
  }
  const a = new Step(sys).lines(L);
  const cx = corner(x);
  if (cx) a.say("shuttle.fromYou", { you: a.st(x), corner: cx });
  else a.say("shuttle.fromYouUnknown", { you: a.st(x) });
  bus(a, [x]);
  a.map.you = x;
  steps.push(a.show(x).done());
  if (end) {
    const b = new Step(sys).lines(L);
    b.say("shuttle.offAt", { at: b.st(end), line: b.ln(L) });
    bus(b, [x, end]);
    b.map.change = [{ at: end, kind: "bus" }];
    b.map.you = x;
    steps.push(b.show(end, x).done());
  }
  return steps;
}

/** Where the shuttle bus stops for a station, in the MTA's words with the streets spelled out ("7 Avenue at 42 Street"). */
const cornerAt = (facts: NoticeFacts, id: string): string | null => {
  const c = facts.busStops.find((b) => b.station.id === id)?.corner;
  return c ? formatStreetText(c.replace(/\[[^\]]*icon\]/gi, "").trim()) : null;
};

/** The stations a temporary bus serves, in order, with the MTA's corner where it gives one. */
function busStops(sys: StaticSystem, facts: NoticeFacts, between: [StationRef, StationRef] | undefined): Array<{ station: string; corner: string | null }> {
  const [a, b] = between ?? [];
  let run: string[] = [];
  if (a?.id && b?.id) {
    for (const line of Object.keys(sys.stopM)) {
      const r = span(seqOf(sys, line), a.id, b.id);
      // The local line: a bus stops near every station, not only the express stops.
      if (r && r.length > run.length) run = r;
    }
    if (!run.length) run = [a.id, b.id];
  }
  if (!run.length) run = [...new Set(facts.busStops.flatMap((x) => (x.station.id ? [x.station.id] : [])))];
  return run.map((station) => ({ station, corner: cornerAt(facts, station) }));
}

/** The MTA's advice that is for this rider: their case (going to, starting from) and their stop. */
function adviceFor(facts: NoticeFacts, e: Effect, trip: NonNullable<Trip>): Advice[] {
  const want = trip.mode === "off" ? "to" : "from";
  return facts.advice.filter((a) => (a.case === want || a.case === "any")
    && (a.stations.length ? a.stations.some((r) => r.id === trip.stop) : e.picks.includes(trip.stop) && !a.between)
    && Boolean(a.take || a.transfer || a.nearby || a.buses));
}

/** One piece of the MTA's advice as steps, one action each. Without a trip it names the stations it is for. */
function adviceSteps(sys: StaticSystem, a: Advice, facts: NoticeFacts, e: Effect | null, trip: Trip): WalkStep[] {
  const out: WalkStep[] = [];
  const you = trip?.stop ?? null;
  const lineOf = (ls: LineDir[]) => ls.flatMap((l) => (l.line ? [l.line] : []));
  const base = () => { const s = new Step(sys); if (e) s.lines(e.change.line); if (you) s.map.you = you; return s; };
  const forWhom = !trip && a.stations.length ? a.stations : null;
  // A rider with a stop goes to the one of the MTA's stations nearest it ("take the 7 to 61 St, Junction Blvd or Mets-Willets Point").
  let to = a.take?.to ?? [];
  if (you && e && to.length > 1) {
    // Getting off: the first of them past the rider's stop, going the way the changed trains go. Getting on: the
    // nearest one behind it, where those trains still stop. Unknown direction: the nearest.
    const end = endOf(sys, e.line, e.change.toward);
    const xi = e.seq.indexOf(you);
    const ahead = (id: string) => (end === 1 ? e.seq.indexOf(id) - xi : xi - e.seq.indexOf(id));
    const cand = ids(to).filter((id) => e.seq.includes(id));
    const side = end === null ? [] : cand.filter((id) => (trip?.mode === "off" ? ahead(id) > 0 : ahead(id) < 0));
    const near = (side.length ? side : cand).sort((p, q) => Math.abs(e.seq.indexOf(p) - xi) - Math.abs(e.seq.indexOf(q) - xi))[0];
    if (near) to = to.filter((r) => r.id === near);
  }
  // "Take the 1 to 96 St": which way that is, from the rider's stop.
  const onLine = (l: LineDir) => Boolean(l.line && e && lineMatches(l.line, e.change.line));
  const takeLines = (a.take?.lines ?? []).map((l) => (you && e && to[0]?.id && onLine(l) && !l.toward ? { ...l, toward: wayTo(sys, e, you, to[0].id) } : l));
  if (a.between && a.take) {
    const s = base();
    s.say("advice.between", { from: s.st(a.between[0].id, a.between[0].name), to: s.st(a.between[1].id, a.between[1].name), trains: s.lineDirs(a.take.lines) });
    out.push(s.lines(...lineOf(a.take.lines)).show(...ids([...a.between])).done());
  } else if (a.take) {
    const s = base();
    const all = takeLines.length > 0 && takeLines.every(onLine);
    // Already on the train that skips: stay on. Starting at a skipped stop: board the train that goes to the change.
    if (you && trip?.mode === "off" && to.length && all && takeLines.every((l) => !l.toward || !e?.change.toward || l.toward === e.change.toward)) {
      s.say("advice.stayOn", { you: s.st(you), to: s.refs(to, "or") });
    } else if (you && trip?.mode === "on" && to.length && all) {
      s.say("advice.boardTo", { you: s.st(you), trains: s.lineDirs(takeLines), to: s.refs(to, "or") });
    } else {
      const slots: Record<string, string> = { trains: s.lineDirs(takeLines) };
      if (to.length) slots.to = s.refs(to, "or");
      if (forWhom) slots.stations = s.refs(forWhom);
      s.say(forWhom ? (to.length ? "advice.forTakeTo" : "advice.forTake") : to.length ? "advice.takeTo" : "advice.take", slots);
    }
    s.lines(...lineOf(takeLines)).show(...ids(to), ...(forWhom ? ids(forWhom) : []), you);
    if (to[0]?.id && you) s.map.ride = { line: takeLines[0]?.line ?? e?.change.line ?? "", from: you, to: to[0].id, toward: takeLines[0]?.toward ?? null };
    out.push(s.done());
  }
  if (a.transfer) {
    const s = base();
    const at = a.transfer.at.length ? a.transfer.at : to;
    const there = !a.transfer.at.length && to.length > 0;
    if (there) s.say("advice.transferThere", { trains: s.lineDirs(a.transfer.lines) });
    else s.say("advice.transfer", { at: s.refs(at, "or"), trains: s.lineDirs(a.transfer.lines) });
    // "There" still names the station, on the map.
    s.show(...ids(at)).lines(...lineOf(a.transfer.lines));
    if (there) s.named.stations.push(...ids(at));
    s.map.change = ids(at).map((id) => ({ at: id, kind: "line" as const, to: lineOf(a.transfer!.lines) }));
    out.push(s.done());
    if (you && trip?.mode === "off") {
      const r = base();
      r.say("advice.rideTo", { you: r.st(you) });
      const from = ids(at)[0];
      if (from) r.map.ride = { line: a.transfer.lines[0]?.line ?? e?.change.line ?? "", from, to: you, toward: a.transfer.lines[0]?.toward ?? null };
      out.push(r.lines(...lineOf(a.transfer.lines)).show(from, you).done());
    }
  }
  if (a.nearby) {
    const s = base();
    const slots = { stations: s.refs(a.nearby.stations, "or"), lines: listWords(a.nearby.lines.map((l) => s.ln(l)), "or") };
    if (forWhom) s.say(a.nearby.lines.length ? "advice.forNearby" : "advice.forNearbyAny", { ...slots, you: s.refs(forWhom) });
    else s.say(a.nearby.lines.length ? "advice.nearby" : "advice.nearbyAny", slots);
    s.show(...ids(a.nearby.stations), you, ...(forWhom ? ids(forWhom) : [])).lines(...a.nearby.lines);
    if (you) s.map.walk = ids(a.nearby.stations).map((to) => ({ from: you, to }));
    out.push(s.done());
  }
  for (const b of a.buses ?? []) {
    const s = base();
    const at = you ?? (forWhom ? ids(forWhom)[0] : null) ?? null;
    const shuttle = /shuttle/i.test(b);
    const corner = at ? cornerAt(facts, at) : null;
    const route = shuttle ? facts.buses.find((x) => x.shuttle)?.routes[0] ?? "shuttle" : b;
    const own = facts.buses.find((x) => x.routes.includes(b) || (shuttle && x.shuttle));
    // A shuttle or a bus that runs only during the work (T323) is in none of our bus data: the map draws it from
    // the stations it serves, from the advice's stretch, the bus's own stretch, or the stops the notice gives corners for.
    const temporary = shuttle || Boolean(own?.shuttle);
    const stops = at ? [{ station: at, corner }] : temporary ? busStops(sys, facts, a.between ?? own?.between) : [];
    if (shuttle) s.say(corner ? "advice.shuttleAt" : "advice.shuttle", { corner: corner ?? "" });
    else s.say(corner ? "advice.busAt" : "advice.busUnknown", { bus: b, corner: corner ?? "" });
    s.bus(route);
    s.map.bus = [{ route, shuttle: temporary, stops }];
    out.push(s.show(at, stops[0]?.station, stops.at(-1)?.station).done());
  }
  return out;
}

/** Where the notice says riders can change, for a walk with no trip picked. */
function transferSteps(sys: StaticSystem, facts: NoticeFacts): WalkStep[] {
  return facts.transfers.filter((t) => t.at.some((r) => r.id)).map((t) => {
    const s = new Step(sys);
    if (t.bus) s.say("transfer.bus", { stations: s.refs(t.at, "or") });
    else if (t.lines.some((l) => l.line)) s.say("transfer.at", { trains: listWords(t.lines.flatMap((l) => (l.line ? [s.ln(l.line)] : [])), "and"), stations: s.refs(t.at, "or") });
    else s.say("transfer.any", { stations: s.refs(t.at, "or") });
    s.show(...ids(t.at)).lines(...t.lines.flatMap((l) => (l.line ? [l.line] : [])));
    if (t.bus) s.map.change = ids(t.at).map((at) => ({ at, kind: "bus" as const }));
    return s.done();
  });
}

const DAYS: Record<string, string> = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
const MONTHS: Record<string, string> = { Jan: "January", Feb: "February", Mar: "March", Apr: "April", Jun: "June", Jul: "July", Aug: "August", Sep: "September", Oct: "October", Nov: "November", Dec: "December" };
/** "Nov 13 - Dec 7, Fri 11:45 PM to Mon 5:00 AM (Weekends)" -> "November 13 to December 7, Friday 11:45 PM to Monday 5:00 AM". */
export function periodWords(period: string): string {
  return period.replace(/\s*\((?:weekends?|weekdays?|nights?)\)\s*$/i, "")
    .replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b(?!day)/g, (_m, d: string) => DAYS[d])
    .replace(/\b(Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b\.?/g, (_m, m: string) => MONTHS[m])
    .replace(/\s+-\s+/g, " to ").replace(/\s+/g, " ").replace(/[.\s]+$/, "").trim();
}

function whenStep(sys: StaticSystem, facts: NoticeFacts, focus: string[]): WalkStep | null {
  const w = periodWords(facts.when.period);
  if (!w) return null;
  const s = new Step(sys);
  s.say("when", { period: /^(?:beginning|starting|until|from)\b/i.test(w) ? lowerFirst(w) : w });
  return s.show(...focus).done();
}

/** MTA icons and bullets as words, for a headline read as it is. */
function cleanAlertText(s: string): string {
  return s.replace(/\[shuttle bus icon\]/gi, "shuttle").replace(/\[[a-z][\w ]*icon\]/gi, "").replace(/\](?=\[)/g, "], ")
    .replace(/\[([A-Z0-9]+)\]/g, "$1").replace(/[ \t]+/g, " ").replace(/ +([.,])/g, "$1");
}

/** The MTA's own words for the (i): the headline and description, icons as words, without the reason heading's text kept apart. */
export function mtaWords(a: TransitAlert): string {
  return cleanAlertText([a.text, a.description].filter(Boolean).join("\n\n")).replace(/\n{3,}/g, "\n\n").trim();
}

/* ------------------------------------------------------------------------------------------------------------ */
/* The walk                                                                                                       */
/* ------------------------------------------------------------------------------------------------------------ */

/** The stations a rider can pick for this notice on this line, in track order. */
function walkStops(facts: NoticeFacts, sys: StaticSystem, route: string, informed: Set<string> = new Set(), served: Set<string> = new Set()): string[] {
  const effects = facts.changes.filter((c) => lineMatches(c.line, route) && !c.note).map((c) => effectOf(sys, c, route, informed, served)).filter((e): e is Effect => Boolean(e));
  const seq = seqOf(sys, route);
  const picks = [...new Set(effects.flatMap((e) => e.picks))];
  return picks.sort((a, b) => seq.indexOf(a) - seq.indexOf(b));
}

/**
 * The walk for one notice on one line. `trip` is the rider's stop and whether they get off or on there; with no
 * trip (or a notice that names no stops) the walk says what changes and the MTA's advice for every stop.
 */
export function noticeWalk(a: TransitAlert & { facts?: NoticeFacts }, sys: StaticSystem | undefined, route: string, trip: Trip): NoticeWalk {
  if (!sys) return { stops: [], steps: [headlineStep(a)], read: false };
  const facts = factsOf(a, sys);
  if (!hasFacts(facts)) return { stops: [], steps: [headlineStep(a), ...mtaSteps(a), whenStep(sys, facts, [])].filter((x): x is WalkStep => Boolean(x)), read: false };
  const informed = new Set(a.stops.map((s) => stationOf(sys.system, s)));
  const changes = dedupe(facts.changes);
  const groups = merged(changes.filter((c) => !c.note));
  const mine = groups.filter((g) => g.group.some((l) => lineMatches(l, route)));
  // A notice about another line's change that this line's panel lists: walk its own lines' changes.
  const own = (mine.length ? mine : groups).map((g) => ({ ...g, c: { ...g.c, line: g.group.find((l) => lineMatches(l, route)) ?? g.c.line } as Change }));
  const others = [...groups.filter((g) => !own.some((o) => o.key === g.key)), ...merged(changes.filter((c) => c.note))];
  // Stations the notice says trains still reach: the ends of what still runs, and where it says to change.
  const served = new Set(changes.flatMap((c) => (c.kind === "runs" ? [c.from.id, c.to.id] : c.kind === "sections" ? c.sections.flat().map((r) => r.id) : [])).filter((x): x is string => Boolean(x)));
  const runs = changes.flatMap((c) => (c.kind === "runs" && c.from.id && c.to.id ? [[c.from.id, c.to.id] as [string, string]] : []));
  const effects = own.map(({ c, group }) => ({ c, group, e: effectOf(sys, c, route, informed, served, runs) ?? effectOf(sys, c, c.line, informed, served, runs) }));
  const stops = walkStops(facts, sys, route, informed, served);
  const pick = trip && stops.includes(trip.stop) ? trip : null;
  const bus = facts.buses.some((b) => b.shuttle);
  const steps: WalkStep[] = effects.map(({ c, e, group }) => leadStep(sys, e, c, group, bus));
  if (pick) {
    let any = false;
    for (const { e } of effects) {
      if (!e) continue;
      const t = tripSteps(sys, e, facts, pick);
      if (t) { steps.push(...t); any = any || t.length > 0; }
    }
    // Advice for this stop that no change led to (a station the MTA names on its own).
    if (!any) {
      const e = effects.find((x) => x.e)?.e ?? null;
      if (e) for (const adv of adviceFor(facts, { ...e, picks: [pick.stop] }, pick)) steps.push(...adviceSteps(sys, adv, facts, e, pick));
    }
  } else {
    const e = effects.find((x) => x.e)?.e ?? null;
    for (const adv of facts.advice) if (adv.take || adv.transfer || adv.nearby || adv.buses) steps.push(...adviceSteps(sys, adv, facts, e, null));
    steps.push(...transferSteps(sys, facts));
  }
  // Notes about the same work on other lines, said after the rider's own steps.
  for (const { c, group } of others) steps.push(leadStep(sys, effectOf(sys, c, c.line, informed), c, group));
  const w = whenStep(sys, facts, steps[0]?.map.stations ?? []);
  if (w) steps.push(w);
  return { stops, steps, read: true };
}

/** A skip the notice repeats for fewer of the same stations (a note on the same work) is that skip once. */
function dedupe(changes: Change[]): Change[] {
  const within = (c: Change, o: Change) => c.kind === "skip" && o.kind === "skip" && o !== c && lineMatches(o.line, c.line) && o.toward === c.toward
    && (o.stations.length > c.stations.length || (o.stations.length === c.stations.length && changes.indexOf(o) < changes.indexOf(c)))
    && c.stations.every((x) => o.stations.some((y) => y.id === x.id));
  return changes.filter((c) => !changes.some((o) => within(c, o)));
}
/** The same change on several lines ("[2][3] trains are delayed") is said once for all of them; entrance closures are said once. */
function merged(changes: Change[]): Array<{ c: Change; group: string[]; key: string }> {
  const out: Array<{ c: Change; group: string[]; key: string }> = [];
  for (const c of changes) {
    if (c.kind === "entrance") {
      const prev = out.find((x) => x.c.kind === "entrance" && x.c.detail === c.detail);
      if (prev && prev.c.kind === "entrance") {
        prev.c = { ...prev.c, stations: [...prev.c.stations, ...c.stations.filter((s) => !(prev.c as typeof c).stations.some((t) => t.id === s.id))] };
        if (!prev.group.includes(c.line)) prev.group.push(c.line);
        continue;
      }
      out.push({ c, group: [c.line], key: `entrance|${c.detail}` });
      continue;
    }
    const key = JSON.stringify({ ...c, line: "" });
    const prev = out.find((x) => x.key === key);
    if (prev) { if (!prev.group.includes(c.line)) prev.group.push(c.line); continue; }
    out.push({ c, group: [c.line], key });
  }
  return out;
}

/**
 * A notice our rules could not read: the MTA's own guidance lines, read as written, without its reason
 * ("What's happening?") or the stock lines every notice carries. Step 8 flags these for a new rule.
 */
function mtaSteps(a: TransitAlert): WalkStep[] {
  const lines = cleanAlertText((a.description ?? "").replace(/\[[a-z][\w ]*icon\]/gi, "")).split(/\n/).map((l) => l.trim());
  const out: string[] = [];
  let reason = false;
  for (const l of lines) {
    if (/^what(?:'s| is) happening\??$|^what happened\??$/i.test(l)) { reason = true; continue; }
    if (!l) { reason = false; continue; }
    if (reason || /ADA accessible|^see a map\b|^(?:travel alternatives|transfer stations|note)s?:?$/i.test(l) || l.length < 4) continue;
    out.push(formatStationName(/[.!?]$/.test(l) ? l : `${l}.`));
  }
  return out.slice(0, 6).map((t) => ({ parts: [{ key: "mta.headline" as const, slots: { text: t } }], text: t, say: spoken(t), named: { stations: [], lines: [], buses: [], entrances: [] }, map: { stations: [], lines: [...a.routes] } }));
}

/** A notice our rules could not read: its headline, as the MTA wrote it. */
function headlineStep(a: TransitAlert): WalkStep {
  const text = formatStationName(cleanAlertText(a.text).replace(/\s*\n+\s*/g, " ").trim());
  const t = /[.!?]$/.test(text) ? text : `${text}.`;
  return { parts: [{ key: "mta.headline", slots: { text: t } }], text: fill("mta.headline", { text: t }), say: spoken(fill("mta.headline", { text: t })), named: { stations: [], lines: [], buses: [], entrances: [] }, map: { stations: [], lines: [...a.routes] } };
}
