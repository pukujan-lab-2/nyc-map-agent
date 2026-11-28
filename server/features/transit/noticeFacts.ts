/**
 * Notice facts: an MTA service notice turned into plain facts a walk can be built from (step 2 of
 * `docs/PLAN-notice-walks.md`). Rules do this, not a model, and the module is pure: give it a slimmed alert
 * (`SlimAlert` from `./alerts`) and an index of our stations, get back `NoticeFacts`.
 *
 * What the facts say, and where each part comes from:
 *
 * - `lines`, `toward`: the lines the notice is about and the direction its headline names ("Flushing" from
 *   "Flushing-bound [7]", "uptown", "downtown"; null when both directions or none is named).
 * - `when`: the MTA's own wording of the period and every time window the alert carries (unix seconds, end 0 =
 *   open-ended). A notice with one window gets that one.
 * - `changes`: what happens to service, one entry per line. Skipped stops, stations closed to a line, a gap with no
 *   service, the stretch that still runs, a line split in sections, express or local running, extra stops, a
 *   reroute over another line, one line running in place of another, a change of boarding platform, fewer or slower
 *   trains, trains ending early at a stop, entrance closures and schedule changes. A change taken from a note about
 *   another line, a footnote or a schedule reminder carries `note: true`.
 * - `advice`: what the MTA tells riders to do, kept per case and per stop. `case` says whose advice it is: "to"
 *   for riders going to the stations ("For service to these stations…"), "from" for riders starting there ("For
 *   service from Sutphin Blvd…"), "any" for advice that names stations without a direction ("For High St, use the
 *   nearby York St station"). `stations` empty means every station the change names ("these stations").
 * - `transfers`: where the MTA says to change trains or to and from the shuttle bus, with the lines named there.
 * - `buses`: buses standing in for the train or suggested instead (route, the stretch it covers), and `busStops`
 *   the corner each station's shuttle bus stops at, from the alert's per-station notes (`alternatives`).
 * - `unresolved`: station names no station in our data matched. Every other station carries our station id
 *   (`public/transit/subway.json`).
 * - `leftover`: guidance sentences no rule understood. A walk should show these as the MTA's text.
 *
 * The reason for the work ("What's happening? Track maintenance") is left out on purpose: walks give guidance, not
 * reasons (owner, 2026-11-26). Rider-facing words are not built here; the walk builder makes them from these facts.
 */
import type { SlimAlert } from "./alerts";

/** A station as the MTA named it, with our station id, or null when nothing in our data matched it. */
export type StationRef = { name: string; id: string | null };

/** A direction as the MTA names it: "Flushing", "Manhattan", "Coney Island", "uptown", "downtown". Null = both or unstated. */
export type Toward = string | null;

/** A line and the direction it runs in, as an instruction names it ("a Manhattan-bound [F]"). Line null = any train. */
export type LineDir = { line: string | null; toward: Toward };

type Base = { line: string; toward: Toward; note?: true };

export type Change =
  /** Trains pass these stations without stopping. `some`: only some trains skip ("some Coney Island-bound [F]…"). */
  | (Base & { kind: "skip"; stations: StationRef[]; some?: true; stops?: StationRef[] })
  /** No trains of this line at these stations ("No [7] at Flushing-Main St", "no Inwood-bound [A] at High St…"). */
  | (Base & { kind: "closed"; stations: StationRef[] })
  /** No trains between two stations. */
  | (Base & { kind: "suspended"; from: StationRef; to: StationRef })
  /** The whole line is out ("[C] is suspended", "Overnight [3] is suspended"). */
  | (Base & { kind: "noService" })
  /** The part of the line that still runs ("[D] runs between Coney Island-Stillwell Av and Bedford Park Blvd, the last stop"). */
  | (Base & { kind: "runs"; from: StationRef; to: StationRef })
  /** The line runs in separate sections; change trains where they meet. */
  | (Base & { kind: "sections"; sections: Array<[StationRef, StationRef]>; everyMin?: number })
  /** Trains run express from one station to another, skipping the local stops between. */
  | (Base & { kind: "express"; from: StationRef; to: StationRef; skips?: StationRef[] })
  /** Trains run local from one station to another, making every stop. */
  | (Base & { kind: "local"; from: StationRef; to: StationRef })
  /** Trains make stops they usually skip. */
  | (Base & { kind: "extraStops"; stations: StationRef[] })
  /** Trains run over another line's tracks ("runs via the [F] from Jay St-MetroTech to W 4 St-Wash Sq"). */
  | (Base & { kind: "reroute"; via: string[]; from: StationRef | null; to: StationRef | null; stops?: StationRef[] })
  /** Another line runs in this line's place ("[G] replaces [F] … between Bergen St and Coney Island-Stillwell Av"). */
  | (Base & { kind: "replacedBy"; by: string; from: StationRef | null; to: StationRef | null })
  /** Trains board from another platform or track at these stations: `boardFrom` is "Manhattan-bound platform", "express track", "Q platform". */
  | (Base & { kind: "platform"; stations: StationRef[]; boardFrom: string })
  /** Fewer or slower trains. `everyMin`: minutes between trains, when given. */
  | (Base & { kind: "frequency"; everyMin: number | null; slower?: true; from?: StationRef; to?: StationRef })
  /** Unplanned delays, at or near a station when named. */
  | (Base & { kind: "delays"; at: StationRef[] })
  /** Some trains end at this station ("The last stop for some trains from Manhattan is 3 Av/138 St"). */
  | (Base & { kind: "shortTurn"; lastStop: StationRef })
  /** Entrances or exits closed or one-way at these stations; `detail` is the MTA's words for which one. */
  | (Base & { kind: "entrance"; stations: StationRef[]; detail: string })
  /** A schedule change: service ends or begins early, or runs when it usually does not. */
  | (Base & { kind: "schedule"; detail: "ends early" | "begins early" | "runs overnight" | "modified schedule"; from?: StationRef; to?: StationRef });

export type Advice = {
  case: "to" | "from" | "any";
  /** The stations this advice is for; empty = all the stations the change names. */
  stations: StationRef[];
  /** "For service between E 180 St and 149 St-Hostos, take the [2]". */
  between?: [StationRef, StationRef];
  /** Take these trains (to one of `to`, when named). */
  take?: { lines: LineDir[]; to: StationRef[] };
  /** Then change to these trains, at `take.to` or at `at`. */
  transfer?: { lines: LineDir[]; at: StationRef[] };
  /** Walk to a nearby station instead, on these lines. */
  nearby?: { stations: StationRef[]; lines: string[] };
  /** Take a bus: a named route ("Bx9") or "shuttle". */
  buses?: string[];
  /** The MTA's sentence, for the (i). */
  text: string;
};

export type Transfer = { at: StationRef[]; lines: LineDir[]; bus?: true; accessible?: true };

export type Bus = { routes: string[]; shuttle: boolean; between?: [StationRef, StationRef]; at?: string };

export type BusStop = { station: StationRef; corner: string; toward: StationRef | null };

export type NoticeFacts = {
  id: string;
  lines: string[];
  toward: Toward;
  when: { period: string; windows: Array<[number, number]> };
  changes: Change[];
  advice: Advice[];
  transfers: Transfer[];
  buses: Bus[];
  busStops: BusStop[];
  unresolved: string[];
  leftover: string[];
};

/* ------------------------------------------------------------------------------------------------------------ */
/* Stations                                                                                                       */
/* ------------------------------------------------------------------------------------------------------------ */

export type Station = { id: string; name: string; routes: string };

type Entry = { id: string; routes: Set<string> };

export type StationIndex = {
  exact: Map<string, Entry[]>;
  swapped: Map<string, Entry[]>;
  part: Map<string, Entry[]>;
  ids: Map<string, string>;
};

/** Words the MTA spells two ways. Both the notice and our data are reduced to the short form before matching. */
const SHORT: Record<string, string> = {
  heights: "hts", square: "sq", street: "st", streets: "sts", avenue: "av", ave: "av", avenues: "avs", boulevard: "blvd",
  parkway: "pkwy", park: "pk", center: "ctr", centre: "ctr", road: "rd", turnpike: "tpke", highway: "hwy", east: "e",
  west: "w", place: "pl", mount: "mt",
};

/**
 * Names the MTA writes differently from our data, beyond the word forms above. The order of the parts of a
 * hyphenated name ("Woodside-61 St" for "61 St-Woodside") is handled without a list.
 */
const ALIASES: Record<string, string> = {
  "4 av/9 st": "4 av-9 st",
  "42 st-port authority": "42 st-port authority bus terminal",
  "court square": "court sq",
  "dyre av": "eastchester-dyre av",
  "stillwell av": "coney island-stillwell av",
  "coney island": "coney island-stillwell av",
  "brooklyn college": "flatbush av-brooklyn college",
  "lehman college": "bedford pk blvd-lehman college",
  "rockaway pkwy": "canarsie-rockaway pkwy",
  "wtc": "world trade ctr",
  "47-50 sts": "47-50 sts-rockefeller ctr",
  "174-175 sts": "174-175 sts",
};

const norm = (s: string) => {
  const n = s.toLowerCase().replace(/[–—]/g, "-").replace(/[.']/g, "").replace(/\s*-\s*/g, "-").replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ").trim()
    .split(/([ \-/()])/).map((w) => SHORT[w] ?? w).join("");
  return ALIASES[n] ?? n;
};
const swapKey = (n: string) => n.replace(/\s*\(/g, "-").replace(/\)/g, "").split(/[-/]/).map((x) => x.trim()).filter(Boolean).sort().join("|");
const partsOf = (n: string) => {
  const out = new Set<string>();
  const bare = n.replace(/\s*\([^)]*\)/g, "").trim();
  out.add(bare);
  for (const m of n.matchAll(/\(([^)]*)\)/g)) out.add(m[1].trim());
  for (const p of bare.split(/[-/]/)) out.add(p.trim());
  out.delete(n);
  return [...out].filter(Boolean);
};
const push = (m: Map<string, Entry[]>, k: string, e: Entry) => {
  const list = m.get(k) ?? [];
  if (!list.some((x) => x.id === e.id)) list.push(e);
  m.set(k, list);
};

/** Index our stations (`public/transit/subway.json` → `stations.features[].properties`) by every way a notice may name them. */
export function stationIndex(stations: Station[]): StationIndex {
  const idx: StationIndex = { exact: new Map(), swapped: new Map(), part: new Map(), ids: new Map() };
  for (const s of stations) {
    const e: Entry = { id: s.id, routes: new Set(s.routes.split(/\s+/).filter(Boolean)) };
    const n = norm(s.name);
    idx.ids.set(s.id, s.name);
    push(idx.exact, n, e);
    push(idx.swapped, swapKey(n), e);
    for (const p of partsOf(n)) push(idx.part, p, e);
  }
  return idx;
}

/** Route ids a bullet may stand for in our data: [6X] is also the 6, [S] is one of the three shuttles. */
const routeSet = (lines: string[]) => {
  const out = new Set<string>();
  for (const l of lines) {
    out.add(l);
    if (/^\dX$/.test(l)) out.add(l[0]);
    if (/^\d$/.test(l)) out.add(`${l}X`);
    if (l === "F") out.add("FX");
    if (l === "S") ["GS", "FS", "H"].forEach((x) => out.add(x));
  }
  return out;
};

type Ctx = { idx: StationIndex; lines: string[]; stops: Set<string>; unresolved: Set<string> };

/**
 * Find a station by name. Lines named beside the name come first ("the nearby 79 St [1] station"), then the
 * lines of the sentence, then the notice's own lines. Exact names beat a swapped order, which beats one part of a
 * longer name ("161 St" for "161 St-Yankee Stadium"). A name that matches several stations on none of those lines
 * stays unresolved rather than guessed.
 */
function resolve(ctx: Ctx, raw: string, near: string[] = [], clause: string[] = []): StationRef {
  const name = raw.trim();
  // A borough or a part of town ("[A] runs between Queens and 168 St") is a place, not a station: no id, not unresolved.
  if (BOROUGH.test(name)) return { name, id: null };
  const bare = name.replace(/\s*\([^)]*\)/g, "").trim();
  const tries = [...new Set([norm(name), norm(bare)])];
  if (bare.includes("/")) tries.push(...bare.split("/").map(norm));
  const levels: Entry[][] = [];
  for (const t of tries) levels.push(ctx.idx.exact.get(t) ?? [], ctx.idx.swapped.get(swapKey(t)) ?? []);
  for (const t of tries) levels.push(ctx.idx.part.get(t) ?? []);
  const contexts = [near, clause, ctx.lines].filter((x) => x.length).map(routeSet);
  const pick = (c: Entry[]) => c.find((e) => ctx.stops.has(e.id)) ?? c[0];
  for (const want of contexts) {
    for (const level of levels) {
      const hit = level.filter((e) => [...e.routes].some((r) => want.has(r)));
      if (hit.length) return { name, id: pick(hit).id };
    }
  }
  // The notice's own stops settle a name our lines do not ("Avenue U" for a [B] that does not usually stop there).
  for (const level of levels) {
    const hit = level.filter((e) => ctx.stops.has(e.id));
    if (hit.length) return { name, id: hit[0].id };
  }
  const first = levels.find((l) => l.length);
  const ids = new Set(first?.map((e) => e.id));
  if (first && ids.size === 1) return { name, id: first[0].id };
  ctx.unresolved.add(name);
  return { name, id: null };
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Text                                                                                                           */
/* ------------------------------------------------------------------------------------------------------------ */

const AREA = /^(?:the )?(?:(?:(?:lower|upper|southeast|northern|downtown|midtown) )?(?:manhattan|queens|brooklyn|bronx|staten island)|harlem|midtown|upper (?:west|east) side)$/i;
/** A borough or part of town ("Queens", "Harlem/Upper West Side"), named where a station could be. */
const BOROUGH = { test: (s: string) => s.split("/").every((p) => AREA.test(p.trim())) };
const ICONS = /\[(?:accessibility|shuttle bus) icon\]/gi;

/** The bullets in a piece of text, as route ids: [SIR] is SI. */
const bullets = (s: string) => [...s.matchAll(/\[([A-Z0-9]{1,3})\]/g)].map((m) => (m[1] === "SIR" ? "SI" : m[1]));

/** "Flushing-bound", "uptown", "downtown" → "Flushing", "uptown", "downtown". */
function dirOf(s: string): Toward {
  const m = [...s.matchAll(/(?:^|[^\w-])((?:[A-Z0-9][\w.']*\s+){0,3}[A-Z0-9][\w.']*)-bound/g)].at(-1);
  if (m) return m[1].replace(/^(?:(?:Some|All|The|And|Or|For|In|No|Take|Then|Only)\s+)+/, "").replace(/^St\. /, "St ");
  const ud = /\b(uptown|downtown)\b/i.exec(s);
  return ud ? ud[1].toLowerCase() : null;
}

/** Which shuttle an [S] is: the 42 St Shuttle (GS), the Franklin Av Shuttle (FS) or the Rockaway Park Shuttle (H). */
const shuttle = (after: string, alertLines: string[]) =>
  /^\s*42 St(?:reet)?\b/i.test(after) ? "GS" : /^\s*Franklin/i.test(after) ? "FS" : /^\s*Rockaway/i.test(after) ? "H" : alertLines.find((x) => ["GS", "FS", "H"].includes(x)) ?? "GS";

/**
 * Lines and their directions in an instruction: "the [Q] or Manhattan-bound [D] or [N]" → Q (any), D and N
 * (Manhattan). A bullet with no direction of its own takes the one before it, as the MTA writes them.
 */
function lineDirs(s: string, alertLines: string[] = []): LineDir[] {
  const out: LineDir[] = [];
  let last = 0;
  let prev: Toward = null;
  for (const m of s.matchAll(/\[([A-Z0-9]{1,3})\]/g)) {
    const seg = s.slice(last, m.index);
    const own = dirOf(seg);
    const toward: Toward = own ?? (/\b(?:or|and)\b|^\s*$/.test(seg) || !seg.trim() ? prev : null);
    const line = m[1] === "SIR" ? "SI" : m[1] === "S" ? shuttle(s.slice((m.index ?? 0) + 3, (m.index ?? 0) + 40), alertLines) : m[1];
    out.push({ line, toward });
    prev = toward;
    last = (m.index ?? 0) + m[0].length;
  }
  if (!out.length && /\btrains?\b/i.test(s)) out.push({ line: null, toward: dirOf(s) });
  return out;
}

/** One name from a list item: drop icons, bullets, footnote stars, "the nearby … station" and a borough after a comma. */
function cleanName(s: string): { name: string; lines: string[] } {
  const lines = bullets(s);
  const name = s.replace(ICONS, " ").replace(/\[[A-Z0-9]{1,3}\]/g, " ").replace(/\|/g, " ").replace(/\*/g, " ").replace(/\((?:[A-Z]|[A-Z], \w+)\)/g, " ")
    // Tails that say when or how, not where: ", the last stop", " through Spring 2027", " - all times", " and via the [1] to/from …".
    .replace(/\s+(?:and |, )?(?:then )?via\b.*$/i, "").replace(/,\s*[a-z(].*$/, "").replace(/\s+-\s+.*$/, "")
    .replace(/\s+(?:through|until|all weekend|all times|overnight only|after \d)\b.*$/i, "").replace(/\s*\((?:late nights?|days\/evenings|downtown service only|uptown service only|[^)]*only)\)/gi, " ")
    .replace(/,\s*(?:the )?(?:Manhattan|Queens|Brooklyn|Bronx|Staten Island)$/i, "")
    .replace(/\s+on the\s*$/i, "").replace(/\s+(?:on|along)\s+[A-Z][\w ]*$/, "").replace(/(?<!Penn|New Dorp)\s+stations?\b.*$/i, "").replace(/^stations?\b.*$/i, "")
    .replace(/^\s*(?:the|a|an)\s+/i, "").replace(/^\s*nearby\s+/i, "").replace(/\s+/g, " ").trim().replace(/[.,;:]$/, "").trim();
  return { name, lines };
}

/** "a, b, c and d" → names, dropping boroughs ("59 St, Brooklyn") and anything too long to be a station. */
function nameList(s: string): Array<{ name: string; lines: string[] }> {
  return s.replace(/\.\s*$/, "").split(/,\s*(?:and\/or\s+|and\s+|or\s+)?|\s+(?:and\/or|and|or)\s+/)
    .map(cleanName).filter((x) => x.name && x.name.length < 50 && /^[A-Z0-9]/.test(x.name) && !BOROUGH.test(x.name) && !/^(?:these|this|trains?)\b/i.test(x.name));
}

/** Strip the clause tails that do not change the facts. */
const tidy = (s: string) => s.replace(ICONS, " ").replace(/\s+/g, " ").trim()
  .replace(/\s+due to .*$/i, "").replace(/\s+during this time\.?$/i, "").replace(/\s*,?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d[^.]*\.?$/, "")
  .replace(/\s+\(\s*\)/g, "").replace(/\s+/g, " ").trim();

/** Sentences of a block, keeping "For Bergen St … and Church Av. Take the [F] instead." together. */
function sentences(line: string): string[] {
  const parts = line.replace(/\bSt\. (?=[A-Z][a-z]+ (?:Av|St|Pl|Blvd|Ave)\b)/g, "St ").split(/(?<=[.!?])(?<!^\s*\d\.)\s+(?=[A-Z*[])/);
  const out: string[] = [];
  for (const p of parts) {
    const prev = out.at(-1);
    if (prev && /^For\b/.test(prev) && !/\b(?:take|use|consider|transfer)\b/i.test(prev) && /^Take\b/.test(p)) out[out.length - 1] = `${prev.replace(/\.$/, ",")} ${p.charAt(0).toLowerCase()}${p.slice(1)}`;
    else out.push(p);
  }
  return out.map((x) => x.trim()).filter(Boolean);
}

/** Sentences that carry no fact and no guidance a walk needs. */
const BOILERPLATE = [
  /^please listen/i, /^listen to announcements/i, /check the destination/i, /^expect crowding/i, /^consider using other nearby/i,
  /\bGO ticket\b/i, /^schedule reminder\b/i, /this service change affects one or more ADA/i, /^(?:(?:additional )?travel alternatives|transfer stations|notes?|travel tips?)\s*:?$/i, /^note: service runs as scheduled/i,
  /will continue to serve these stops/i, /^contact 511/i, /^\(?see\b/i, /^(?:and )?please contact 511/i,
];

/* ------------------------------------------------------------------------------------------------------------ */
/* Parsing                                                                                                        */
/* ------------------------------------------------------------------------------------------------------------ */

type State = {
  ctx: Ctx;
  alert: SlimAlert;
  facts: NoticeFacts;
  /** The change the headline described, for "Trains stop at …" and "Boarding change includes …" in the text. */
  head: Change[];
  /** The last advice, for "Or, use the nearby …". */
  lastAdvice?: Advice;
  /** Lines named in the sentence being read, for placing its stations. */
  clause: string[];
};

const ref = (st: State, name: string, near: string[] = [], clause: string[] = st.clause) => resolve(st.ctx, name, near, clause.length ? clause : st.clause);
const refs = (st: State, s: string, clause: string[] = st.clause) => nameList(s).map((n) => ref(st, n.name, n.lines, clause));

/** The subject of a clause: its lines and directions. Without a bullet, the notice's own lines. */
function subject(st: State, s: string): LineDir[] {
  const dirs = lineDirs(s, st.alert.routes);
  if (dirs.length && dirs.every((d) => d.line)) return dirs;
  const toward = dirOf(s);
  return st.alert.routes.map((line) => ({ line, toward }));
}

function add(st: State, subj: LineDir[], make: (d: LineDir) => Change | null, note: boolean, both: boolean) {
  const made: Change[] = [];
  for (const d of subj) {
    const c = make(d);
    if (!c) continue;
    if (both) c.toward = null;
    if (note) c.note = true;
    st.facts.changes.push(c);
    made.push(c);
  }
  return made;
}

const SUBJ = String.raw`((?:(?:[Ss]ome|[Aa]ll|[Ll]ate night|[Oo]vernight|[Uu]ptown|[Dd]owntown|[Ll]ocal|[Ee]xpress|[\w.' ]+?-bound|and|or|the)\s*|\[[A-Z0-9]{1,3}\]\s*)*\[[A-Z0-9]{1,3}\](?:\s*(?:local|express|trains?|service|local\/express trains)\b)*)`;
const re = (s: string, flags = "") => new RegExp(s, flags);

/** Changes to service in one sentence (the headline or a sentence of the text). True when one was found. */
function changeSentence(st: State, raw: string, note: boolean): boolean {
  // Advice riding on a change ("… - take the [Q]") is kept only when the change itself was understood.
  const before = st.facts.advice.length;
  const ok = changeIn(st, raw, note);
  if (!ok) st.facts.advice.length = before;
  return ok;
}

function changeIn(st: State, raw: string, note: boolean): boolean {
  // "Downtown [A] stops at 50 St, 23 St and Spring St, and uptown [A] stops at 23 St and 50 St": two facts.
  const two = /^(.+?), and ((?:uptown|downtown|[A-Z][\w ]*-bound) \[[A-Z0-9]+\].+)$/.exec(tidy(raw));
  if (two && bullets(two[1]).length) {
    const a = changeSentence(st, two[1], note);
    const b = changeSentence(st, two[2], note);
    return a || b;
  }
  let s = tidy(raw).replace(/^(?:Through|Until) [^,]+,\s*/i, "").replace(/^In (?:the )?[A-Z][\w ]*?(?: and (?:the )?[A-Z][\w ]*?)?,\s*/, "").replace(/,\s*except\b.*$/i, "");
  const both = /\bin both directions\b/i.test(s);
  st.clause = bullets(s);
  s = s.replace(/\s*\bin both directions\b/i, "").replace(/\s+/g, " ").trim().replace(/\.$/, "");
  const lines = st.alert.routes;
  let m: RegExpExecArray | null;
  const isHead = st.head.length === 0 && !note;
  const done = (made: Change[]) => {
    if (isHead) st.head.push(...made);
    return made.length > 0;
  };

  // "[G] replaces [F] between Bergen St and Coney Island-Stillwell Av"
  if ((m = re(String.raw`^\[([A-Z0-9]+)\](?: trains)? replaces? \[([A-Z0-9]+)\](?: service)?(?: between (.+?) and (.+))?$`).exec(s))) {
    const [, by, line, a, b] = m;
    return done(add(st, [{ line, toward: null }], () => ({ kind: "replacedBy", line, toward: null, by, from: a ? ref(st, cleanName(a).name, [], [by, line]) : null, to: b ? ref(st, cleanName(b).name, [], [by, line]) : null }), note, both));
  }
  // "[J] provides service between Myrtle Av (Broadway) and Delancey St-Essex St", "[2] makes [3] stops between …",
  // "[1] serves nearby stations between 168 St-Washington Hts and 207 St": another line standing in.
  if ((m = /^\[([A-Z0-9]+)\](?: trains)? (?:provides service|serves nearby stations|makes \[([A-Z0-9]+)\] stops) between (.+?) and (.+)$/.exec(s))) {
    const [, by, own, a, b] = m;
    const subj = own ? [own] : lines.filter((l) => l !== by);
    return done(add(st, subj.map((line) => ({ line, toward: null })), (d) => ({ kind: "replacedBy", line: d.line!, toward: null, by, from: ref(st, cleanName(a).name, [], [by]), to: ref(st, cleanName(b).name, [], [by]) }), note, both));
  }
  // "[A] trains make local stops between 59 St-Columbus Circle and Euclid Av"
  if ((m = re(String.raw`^${SUBJ}(?: trains)? makes? local stops between (.+?) and (.+)$`, "i").exec(s))) {
    const [, subj, a, b] = m;
    const from = ref(st, cleanName(a).name), to = ref(st, cleanName(b).name);
    return done(add(st, subject(st, subj), (d) => ({ kind: "local", line: d.line!, toward: d.toward, from, to }), note, both));
  }
  // "… - take the [Q]", "- Take the [J] and free shuttle buses instead", "…, take the [4] instead": advice riding on a change.
  const alt = /(?:\s+-\s+|,\s+)take (?:the )?(.+?)(?: instead)?$/i.exec(s);
  if (alt) {
    s = s.slice(0, alt.index);
    const take = lineDirs(alt[1], lines);
    const buses = /shuttle bus/i.test(alt[1]) ? ["shuttle"] : [];
    st.facts.advice.push({ case: "any", stations: [], ...(take.length ? { take: { lines: take, to: [] } } : {}), ...(buses.length ? { buses } : {}), text: alt[0].replace(/^\s*-\s*/, "") });
  }
  // "No [R] between Whitehall St-South Ferry and 59 St, Brooklyn" / "no Jamaica-bound [F] at York St, …"
  if ((m = re(String.raw`^No ${SUBJ} (?:service )?between (.+?)(?:, [A-Z][a-z]+)? and (.+)$`, "i").exec(s))) {
    const [, subj, a, b] = m;
    const from = ref(st, cleanName(a).name), to = ref(st, cleanName(b.replace(/,\s*(?:the )?[A-Z][a-z]+(?: [A-Z][a-z]+)?$/, "")).name);
    return done(add(st, subject(st, subj), (d) => ({ kind: "suspended", line: d.line!, toward: d.toward, from, to }), note, both));
  }
  if ((m = re(String.raw`^No ${SUBJ} (?:service )?(?:at|to) (.+)$`, "i").exec(s))) {
    const [, subj, list] = m;
    const stations = refs(st, list);
    return done(add(st, subject(st, subj), (d) => ({ kind: "closed", line: d.line!, toward: d.toward, stations }), note, both));
  }
  // "[C] is suspended", "Overnight [3] is suspended", "[H] Rockaway Park Shuttle is replaced by free shuttle buses"
  if ((m = re(String.raw`^${SUBJ}(?: [A-Z][\w ]*Shuttle)? (?:service )?(?:is|are) (?:suspended|replaced by (?:free )?shuttle buses)$`, "i").exec(s))) {
    if (/replaced by/i.test(s)) st.facts.buses.push({ routes: st.alert.replacement, shuttle: true });
    return done(add(st, subject(st, m[1]), (d) => ({ kind: "noService", line: d.line!, toward: d.toward }), note, both));
  }
  // "[5] service ends early between Bowling Green, Manhattan and E 180 St, Bronx" / "[C] service ends early"
  if ((m = re(String.raw`^${SUBJ} (?:service )?ends early(?: between (.+?)(?:, [A-Z][a-z]+)? and (.+?)(?:, [A-Z][a-z]+)?)?$`, "i").exec(s))) {
    const [, subj, a, b] = m;
    const range = a && b ? { from: ref(st, cleanName(a).name), to: ref(st, cleanName(b).name) } : {};
    return done(add(st, subject(st, subj), (d) => ({ kind: "schedule", line: d.line!, toward: d.toward, detail: "ends early", ...range }), note, both));
  }
  // "downtown local [4] service begins early from Grand Central-42 St to Brooklyn Bridge-City Hall"
  if ((m = re(String.raw`^${SUBJ} (?:service )?begins early from (.+?) to (.+)$`, "i").exec(s))) {
    const [, subj, a, b] = m;
    const from = ref(st, cleanName(a).name), to = ref(st, cleanName(b).name);
    return done(add(st, subject(st, subj), (d) => ({ kind: "local", line: d.line!, toward: d.toward, from, to }), note, both));
  }
  // "[S] 42 Street Shuttle service runs overnight" / "[S] 42 Street Shuttle operates overnight"
  if ((m = re(String.raw`^${SUBJ}(?: [A-Z0-9][\w ]*Shuttle)? (?:service )?(?:runs|operates) overnight$`, "i").exec(s))) {
    return done(add(st, subject(st, m[1]), (d) => ({ kind: "schedule", line: d.line!, toward: d.toward, detail: "runs overnight" }), note, both));
  }
  // "[2] operates on a modified schedule because …"
  if ((m = re(String.raw`^${SUBJ} (?:operates|runs) on a modified schedule\b`, "i").exec(s))) {
    return done(add(st, subject(st, m[1]), (d) => ({ kind: "schedule", line: d.line!, toward: d.toward, detail: "modified schedule" }), note, both));
  }
  // "runs express via the Manhattan Bridge from Canal St to 36 St and skips DeKalb Av" / "runs express from Kings Hwy to Jay St-MetroTech"
  if ((m = re(String.raw`^${SUBJ} (?:trains )?runs? express(?: via (?:the )?[A-Z][\w ]+?(?= from))? (?:from )?(.+?) to (.+?)(?: and skips? (.+))?$`, "i").exec(s))) {
    const [, subj, a, b, sk] = m;
    const from = ref(st, cleanName(a).name), to = ref(st, cleanName(b).name);
    const skips = sk ? refs(st, sk) : undefined;
    return done(add(st, subject(st, subj), (d) => ({ kind: "express", line: d.line!, toward: d.toward, from, to, ...(skips ? { skips } : {}) }), note, both));
  }
  // "runs local from 59 St-Columbus Circle to 125 St" / "[A] runs local between 168 St and Canal St"
  if ((m = re(String.raw`^${SUBJ} (?:trains )?runs? local (?:from (.+?) to|between (.+?) and) (.+)$`, "i").exec(s))) {
    const [, subj, a1, a2, b] = m;
    const from = ref(st, cleanName(a1 ?? a2).name), to = ref(st, cleanName(b).name);
    return done(add(st, subject(st, subj), (d) => ({ kind: "local", line: d.line!, toward: d.toward, from, to }), note, both));
  }
  // "[Q] runs via the [R] from Canal St to DeKalb Av", "[C] service is rerouted via [D] and [F] between …",
  // "[R] runs via Roosevelt Island [F] from 57 St-7 Av to 36 St", "[F] trains run via the [A] local from …"
  if ((m = re(String.raw`^${SUBJ} (?:service |trains )?(?:is |are )?(?:runs?|running|rerouted)(?: in [A-Z][\w ]+?)? via (?:the )?((?:(?:[A-Z][\w.]*|and|the) )*?\[[A-Z0-9]+\](?:(?: and | or |\s*)\[[A-Z0-9]+\])*)(?: local)?(?: (?:from (.+?) to|between (.+?) and) (.+?))?$`, "i").exec(s))) {
    const [, subj, viaText, a1, a2, b] = m;
    const via = bullets(viaText);
    const from = a1 ?? a2 ? ref(st, cleanName(a1 ?? a2).name, [], via) : null;
    const to = b ? ref(st, cleanName(b.replace(/,\s*the last stop$/i, "").replace(/,\s*[A-Z][a-z]+$/, "")).name, [], via) : null;
    return done(add(st, subject(st, subj), (d) => ({ kind: "reroute", line: d.line!, toward: d.toward, via, from, to }), note, both));
  }
  // "[R] runs in Brooklyn between Bay Ridge-95 St and 59 St, the last stop." / "[5] service runs between …"
  if ((m = re(String.raw`^${SUBJ} (?:service )?(?:runs?|provides service) (?:in [A-Z][\w ]+? )?between (.+?) and (.+?)(?:, the last stop)?$`, "i").exec(s)) && !/\bevery\b/.test(s)) {
    const [, subj, a, b] = m;
    const from = ref(st, cleanName(a).name), to = ref(st, cleanName(b).name);
    return done(add(st, subject(st, subj), (d) => ({ kind: "runs", line: d.line!, toward: d.toward, from, to }), note, both));
  }
  // "[G] runs in two sections:" — the sections follow on numbered lines.
  if ((m = re(String.raw`^${SUBJ} (?:service )?(?:runs|operates) in (?:two|three) sections(?: and every (\d+) minutes)?:?$`, "i").exec(s))) {
    const every = m[2] ? { everyMin: Number(m[2]) } : {};
    return done(add(st, subject(st, m[1]), (d) => ({ kind: "sections", line: d.line!, toward: d.toward, sections: [], ...every }), note, both));
  }
  // "[2] runs approximately every 15 minutes", "[6] runs every 8 minutes between 3 Av/138 St and Pelham Bay Park", "Trains run every 20 minutes between …"
  if ((m = re(String.raw`^(?:${SUBJ}|Trains)(?: trains)? (?:runs?|operates?) (?:approximately )?every (\d+) minutes(?: (?:between (.+?) and (.+?)|in [A-Z][\w ]+))?$`, "i").exec(s))) {
    const [, subj, n, a, b] = m;
    const range = a && b ? { from: ref(st, cleanName(a).name), to: ref(st, cleanName(b).name) } : {};
    return done(add(st, subj ? subject(st, subj) : lines.map((line) => ({ line, toward: null })), (d) => ({ kind: "frequency", line: d.line!, toward: d.toward, everyMin: Number(n), ...range }), note, both));
  }
  // "[A][D] trains will run at slower speeds…", "Fallen leaves may slow [SIR] service", "[F] service … runs less frequently"
  if (/slower speeds|may slow|runs less frequently|longer wait/i.test(s)) {
    return done(add(st, subject(st, s), (d) => ({ kind: "frequency", line: d.line!, toward: d.toward, everyMin: null, slower: true }), note, both));
  }
  // "Manhattan-bound [A] trains are running with delays while we address a signal problem near 88 St."
  if (/running with delays|are delayed|expect delays/i.test(s)) {
    const at = /\b(?:near|at|entering and leaving)\s+((?:[A-Z0-9][\w./-]*\s?)+)(?=[ .,]|$)/.exec(s);
    const stations = at ? [ref(st, cleanName(at[1]).name)] : [];
    return done(add(st, subject(st, s.split(/\b(?:while|after|because)\b/)[0]), (d) => ({ kind: "delays", line: d.line!, toward: d.toward, at: stations }), note, both));
  }
  // "Some Coney Island-bound [F] and some Church Av-bound [G] trains will skip 4 Av/9 St, …", "Downtown [1] skips 125 St"
  if ((m = re(String.raw`^(${SUBJ.slice(1, -1)}|(?:[A-Z][\w.' ]*?-bound )?trains)(?: trains)? (?:will )?skips? (.+)$`, "i").exec(s))) {
    const [, subj, list] = m;
    const some = /\bsome\b/i.test(subj);
    const stations = refs(st, list);
    return done(add(st, subject(st, subj), (d) => ({ kind: "skip", line: d.line!, toward: d.toward, stations, ...(some ? { some: true as const } : {}) }), note, both));
  }
  // Boarding platform: "All [SIR] trains from Jefferson Av to Old Town board from the Tottenville-bound platform",
  // "all [2] trains at E 180 St board from the uptown platform", "At Bay Pkwy, 62 St and 9 Av trains board from the
  // Coney Island-bound platform", "At Canal St, downtown [R] trains stop at the [Q] platform", "(All trains board/depart
  // from the Church Av-bound platform between Bedford-Nostrand Avs and Hoyt-Schermerhorn Sts)",
  // "At Queensboro Plaza, board/exit all [N] trains from the Manhattan-bound platform".
  const plat = /(?:board(?:\/(?:depart|exit))?|stops?) (?:all .+? )?(?:from|at) the ((?:(?:lower|upper) level )?(?:[\w .'-]+?-bound|uptown|downtown|express|local|\[[A-Z0-9]+\]) (?:platform|track))/i.exec(s);
  if (plat) {
    const boardFrom = plat[1].replace(/\[([A-Z0-9]+)\]/, "$1");
    const pre = s.slice(0, plat.index);
    const post = s.slice(plat.index + plat[0].length);
    let names: StationRef[] = [];
    let at: RegExpExecArray | null;
    if ((at = /\bat (.+?)$/i.exec(pre)) && !/^\s*at\b/i.test(pre)) names = refs(st, at[1].replace(/\s*(?:all\s+)?(?:\[[A-Z0-9]+\]\s*)*trains?\s*$/i, ""));
    else if ((at = /^\(?\s*At (.+?), (.*)$/i.exec(pre))) names = refs(st, at[1]);
    else if ((at = /\bfrom (.+?) to (.+?) $/i.exec(pre))) names = [ref(st, cleanName(at[1]).name), ref(st, cleanName(at[2]).name)];
    else if ((at = /\bat (.+?)(?:\)|$)/i.exec(post)) || (at = /\bbetween (.+?)\)?$/i.exec(post))) names = refs(st, at[1].replace(/\)$/, ""));
    const subjText = pre.replace(/^\(?\s*At [^,]+,\s*/i, "");
    const subj = bullets(subjText).length ? subject(st, subjText) : lines.map((line) => ({ line, toward: dirOf(subjText) }));
    return done(add(st, subj, (d) => ({ kind: "platform", line: d.line!, toward: d.toward, stations: names, boardFrom }), note, both));
  }
  // "uptown [A] stops at 23 St and 50 St", "all Manhattan-bound [7][7X] local/express trains stop at 74 St-Broadway",
  // "[A] stops in both directions at 155 St and 163 St-Amsterdam Av"
  if ((m = re(String.raw`^${SUBJ}(?: trains)? (?:also )?(?:stops?|makes? stops) at (.+)$`, "i").exec(s))) {
    const [, subj, list] = m;
    const stations = refs(st, list);
    return done(add(st, subject(st, subj), (d) => ({ kind: "extraStops", line: d.line!, toward: d.toward, stations }), note, both));
  }
  // Entrances: "Some entrances/exits at 34 St-Penn Station [1][2][3], … will be closed",
  // "[SIR] New Dorp Station - St George-bound - east end entrance is closed until further notice",
  // "Enter 5 Av/53 St [E][F] Station at 5 Av only - Madison Av side of station is exit only".
  if (/\bentrances?\b|\bexits?\b|exit only/i.test(s) && /\bclosed\b|\bonly\b/i.test(s)) {
    let stations: StationRef[] = [];
    if ((m = /entrances?\/exits? at (.+?) will be closed/i.exec(s))) {
      // "34 St-Penn Station [1][2][3], 59 St-Columbus Circle [A][C][D][1], 72 St [C]": each station for its own lines.
      const byLine = new Map<string, StationRef[]>();
      for (const n of nameList(m[1].replace(/,?\s*and \[[^]+$/, ""))) {
        for (const line of n.lines.length ? n.lines : lines) byLine.set(line, [...(byLine.get(line) ?? []), ref(st, n.name, [line])]);
      }
      const made: Change[] = [];
      for (const [line, list] of byLine) made.push(...add(st, [{ line, toward: null }], () => ({ kind: "entrance", line, toward: null, stations: list, detail: tidy(raw) }), note, false));
      return done(made);
    } else if ((m = /^(?:\[[A-Z0-9]+\]\s*)*(.+?) Station - (.+)$/i.exec(s))) {
      stations = [ref(st, cleanName(m[1]).name, bullets(s))];
    } else if ((m = /^Enter (.+?) Station\b/i.exec(s))) {
      stations = [ref(st, cleanName(m[1]).name, bullets(m[1]))];
    }
    const lns = bullets(s).length ? [...new Set(bullets(s))] : lines;
    return done(add(st, lns.map((line) => ({ line, toward: null })), (d) => ({ kind: "entrance", line: d.line!, toward: dirOf(s), stations, detail: tidy(raw) }), note, false));
  }
  // "The last stop for some trains from Manhattan is 3 Av/138 St", "The last [4] stop for some Bronx-bound trains is 125 St",
  // "The last stop for alternate trains from Manhattan is 167 St".
  if ((m = /^The last (?:\[[A-Z0-9]+\] )?stop for (?:some|alternate) (.*?)trains?(?: from [A-Z][\w ]+?)? is (.+?)$/i.exec(s))) {
    const lastStop = ref(st, cleanName(m[2]).name);
    const toward = dirOf(m[1]);
    return done(add(st, (bullets(s).length ? bullets(s) : lines).map((line) => ({ line, toward })), (d) => ({ kind: "shortTurn", line: d.line!, toward: d.toward, lastStop }), note, false));
  }
  // "These trains are rerouted to the 3 Av/138 St [6] Station." — the short-turned trains, said again.
  if (/^These trains are rerouted/i.test(s)) return true;
  return false;
}

/** "transfer to a Manhattan-bound [F] or Court Square-bound [G]" → lines with directions; "a downtown train" → any train going downtown. */
const transferLines = (st: State, s: string) => lineDirs(s.replace(/\s+to continue your trip.*$/i, ""), st.alert.routes);

/** The take/use/consider part of an advice sentence. */
function action(st: State, adv: Advice, rest: string) {
  let r = rest.replace(/\s*\*\s*/g, " ").replace(/\s+making these stops/i, "").replace(/\s+instead\b/i, "").replace(/\.$/, "").trim();
  const buses = [...r.matchAll(/\b((?:Bx|B|M|Q|S|X|T)\d{1,4}[A-Z]?)\b/g)].map((m) => m[1]);
  if (/shuttle bus/i.test(r) && !buses.length) buses.push("shuttle");
  if (buses.length) adv.buses = buses;
  let m: RegExpExecArray | null;
  // "Consider the M101, M102 or M103 bus making stops along Lexington Ave, or use 86 St [Q] Station on 2 Av",
  // "Consider the M125 to the 125 St [A][C] [B][D] Station", "Consider taking the Q24 bus along Broadway"
  if (buses.length && (m = /^(?:consider|take) (?:taking )?(?:the )?(?:[A-Z]{1,3}\d{1,4}[A-Z]?(?:,\s*|\s+or\s+|\s+and\s+)?)+(?:\s*bus(?:es)?)?\b(.*)$/i.exec(r))) {
    const tail = m[1];
    const to = /^\s*to (?:the )?(.+?)$/i.exec(tail);
    if (to) adv.take = { lines: [], to: nameList(to[1]).map((n) => ref(st, n.name, n.lines)) };
    const or = /\bor use (?:the )?(?:nearby )?(.+)$/i.exec(tail);
    if (or) adv.nearby = { stations: nameList(or[1]).map((n) => ref(st, n.name, n.lines)), lines: bullets(or[1]) };
    return;
  }
  // "use the nearby York St [F] station", "use nearby [D] stations along Grand Concourse", "consider the nearby 207 St [A] station"
  if ((m = /^(?:use|consider) (?:the )?(?:nearby )?(.+?) (?:stations?|stops)\b(.*)$/i.exec(r)) || (m = /\bor use (?:the )?nearby (.+?)(?: (?:stations?|stops)\b(.*))?$/i.exec(r))) {
    const named = m[1];
    const lines = bullets(named);
    const stations = /^\s*(?:\[[A-Z0-9]+\]\s*)+$/.test(named) ? [] : nameList(named).map((n) => ref(st, n.name, n.lines));
    adv.nearby = { stations, lines };
    r = r.slice(0, /^(?:use|consider)/i.test(r) ? 0 : m.index).trim() + (m[2] ?? "");
    const via = /via (?:the (.+?) at|transfer at) (.+)$/i.exec(m[2] ?? "");
    if (via) adv.transfer = { lines: via[1] ? lineDirs(via[1], st.alert.routes) : [], at: refs(st, via[2], via[1] ? bullets(via[1]) : lines) };
    r = r.replace(/\s*via .+$/i, "").trim();
    if (!stations.length && !lines.length) adv.nearby.lines = bullets(rest.replace(/\bor (?:take )?(?:\[shuttle bus icon\] )?free shuttle.*$/i, ""));
    if (!/\btake\b/i.test(r)) return;
    r = r.replace(/^.*?\b(take\b)/i, "$1");
  }
  r = r.replace(/^consider (?:taking )?/i, "take ");
  // "transfer at Woodside-61 St to a Flushing-bound [7] local"
  if ((m = /^transfer at (.+?) to (.+)$/i.exec(r))) {
    adv.transfer = { lines: lineDirs(m[2], st.alert.routes), at: refs(st, m[1], bullets(m[2])) };
    return;
  }
  // "transfer to the Bx4 bus at 3 Av-149 St"
  if ((m = /^transfer to (.+?) at (.+)$/i.exec(r))) {
    adv.transfer = { lines: lineDirs(m[1], st.alert.routes), at: refs(st, m[2]) };
    return;
  }
  // "take the [F] or [G] to 7 Av or Church Av and transfer to a Manhattan-bound [F] or Court Square-bound [G]"
  if ((m = /^take (.+?) to (.+?) and transfer to (.+)$/i.exec(r))) {
    const take = lineDirs(m[1], st.alert.routes);
    const to = refs(st, m[2], take.flatMap((d) => (d.line ? [d.line] : [])));
    adv.take = { lines: take, to };
    adv.transfer = { lines: transferLines(st, m[3]), at: [] };
    return;
  }
  // "take the [J] via transfer at the Delancey St-Essex St [F] station", "take a Coney Island-bound [F] via transfer
  // to/from the Jamaica-bound [F] at Jay St-MetroTech or W 4 St-Wash Sq", "take the [7] via transfer at Queensboro Plaza and/or Times Sq-42 St"
  if ((m = /^take (.+?) via transfer (?:to\/from (.+?) )?at (.+)$/i.exec(r))) {
    adv.take = { lines: lineDirs(m[1], st.alert.routes), to: [] };
    adv.transfer = { lines: m[2] ? lineDirs(m[2], st.alert.routes) : [], at: refs(st, m[3], bullets(m[1] + (m[2] ?? ""))) };
    return;
  }
  // "take the [Q] or a local Manhattan-bound [D] or [N]", "take the Bx9 bus", "take the [N] instead"
  if ((m = /^take (.+?)(?: (?:train|trains))?(?: or use (.+))?$/i.exec(r))) {
    const lines = lineDirs(m[1], st.alert.routes);
    if (lines.length) adv.take = { lines, to: [] };
    else if (!buses.length) st.facts.leftover.push(adv.text);
    return;
  }
  st.facts.leftover.push(adv.text);
}

/** Advice in one sentence. True when the sentence was guidance the rules understood. */
function adviceSentence(st: State, raw: string): boolean {
  st.clause = [];
  const s = tidy(raw).replace(/^(?:Travel tips?|Travel alternatives?|Notes?):\s*/i, "").replace(/^\*\s*/, "");
  let m: RegExpExecArray | null;
  // "Or, use the nearby World Trade Center [E] station via transfer at W 4 St-Wash Sq."
  if ((m = /^Or,? ((?:use|take|consider) .+)$/i.exec(s)) && st.lastAdvice) {
    const adv: Advice = { ...st.lastAdvice, take: undefined, transfer: undefined, nearby: undefined, buses: undefined, text: tidy(raw) };
    action(st, adv, m[1]);
    st.facts.advice.push(adv);
    return true;
  }
  // "For service to these stations, take …", "For service from Briarwood, take …", "For DeKalb Av, take …",
  // "For service between E 180 St and 149 St-Hostos, take the [2].", "From Simpson St, …, take the Bx4 bus instead."
  if ((m = /^(For|From|Between)\s+(?:direct\s+)?(?:service\s+|stations\s+)?(?:(to\/from|to|from|between)\s+)?(.+?),?\s+((?:take|use|consider)\b.+)$/i.exec(s)) || (m = /^(For|From)\s+(?:service\s+)?(?:(to\/from|to|from)\s+)?(.+?),\s+(transfer (?:to|at)\b.+)$/i.exec(s))) {
    const [, lead, kase0, target, rest] = m;
    const kase = lead.toLowerCase() === "between" ? "between" : kase0;
    const adv: Advice = { case: lead.toLowerCase() === "from" || kase?.toLowerCase() === "from" ? "from" : kase?.toLowerCase() === "to" ? "to" : "any", stations: [], text: tidy(raw) };
    if (kase?.toLowerCase() === "between") {
      const pair = /^(.+?) and (.+)$/.exec(target);
      const a = pair ? cleanName(pair[1]) : null, b = pair ? cleanName(pair[2]) : null;
      if (a && b && !BOROUGH.test(a.name) && !BOROUGH.test(b.name)) adv.between = [ref(st, a.name, a.lines), ref(st, b.name, b.lines)];
    } else if (!/^th(?:ese|is) stations?$/i.test(target.trim())) {
      adv.stations = refs(st, target);
    } else if (st.lastAdvice?.stations.length && st.lastAdvice.case !== adv.case) {
      // "For service to Union St, 4 Av-9 St, … take …" then "For service from these stations, take …": the same stations.
      adv.stations = st.lastAdvice.stations;
    }
    action(st, adv, rest);
    st.facts.advice.push(adv);
    st.lastAdvice = adv;
    return true;
  }
  // "In Manhattan, use nearby [4] or [J] stations for City Hall, …", "In Brooklyn, use nearby Borough Hall [2][4] for Court St …"
  if ((m = /^(?:In [A-Z][\w ]+, )?use (?:the )?nearby (.+?)(?: stations?)? for (.+)$/i.exec(s))) {
    const named = m[1];
    const lines = bullets(named);
    const stations = /^\s*(?:\[[A-Z0-9]+\]\s*|or\s*)+$/.test(named) ? [] : nameList(named).map((n) => ref(st, n.name, n.lines));
    st.facts.advice.push({ case: "any", stations: refs(st, m[2]), nearby: { stations, lines }, text: tidy(raw) });
    return true;
  }
  // "In Queens, take [E][F][N] or T323 buses."
  if ((m = /^In ([A-Z][\w ]+), (take .+)$/.exec(s))) {
    const adv: Advice = { case: "any", stations: [], text: tidy(raw) };
    action(st, adv, m[2]);
    st.facts.advice.push(adv);
    return true;
  }
  // "Take the Bx9 bus instead.", "Take the [A][D] and/or [Q] trains.", "Consider taking the Q24 bus along Broadway."
  if ((m = /^(?:Or,? )?((?:Take|Consider)\b.+)$/.exec(s)) && !/\bvia transfer at:?$/i.test(s)) {
    const adv: Advice = { case: "any", stations: [], text: tidy(raw) };
    action(st, adv, m[1].replace(/^Take/, "take").replace(/^Consider/, "consider"));
    st.facts.advice.push(adv);
    return true;
  }
  // "If your stop is skipped, take a Manhattan-bound [F] or Court Sq-bound [G] train."
  if ((m = /^If your stop is skipped, (take .+)$/i.exec(s))) {
    const adv: Advice = { case: "to", stations: [], text: tidy(raw) };
    action(st, adv, m[1]);
    st.facts.advice.push(adv);
    return true;
  }
  // "Use 86 St on the [C] or the nearby 79 St [1] station on Broadway.", "Use the nearby 57 St-7 Av [N][Q][R] station."
  if ((m = /^Use (.+)$/i.exec(s))) {
    const items = nameList(m[1].replace(/\.$/, "").replace(/^(?:the )?nearby\s+/i, ""));
    const adv: Advice = { case: "any", stations: [], nearby: { stations: items.map((n) => ref(st, n.name, n.lines)), lines: [...new Set(items.flatMap((n) => n.lines))] }, text: tidy(raw) };
    st.facts.advice.push(adv);
    return true;
  }
  return false;
}

/** "Transfer at …", "Transfer between [D] and [shuttle bus icon] at …", accessible transfers. */
function transferSentence(st: State, raw: string): boolean {
  st.clause = bullets(raw);
  const bus = /shuttle bus icon|\bbuses\b/i.test(raw);
  const s = tidy(raw).replace(/\.$/, "");
  let m: RegExpExecArray | null;
  // "[accessibility icon] If you're on a train terminating at 3 Av-138 St, an accessible transfer is available at 125 St to the next Pelham Bay Park-bound [6]."
  if ((m = /accessible transfer is available at (.+?) to (?:the next )?(.+)$/i.exec(s))) {
    st.facts.transfers.push({ at: refs(st, m[1]), lines: transferLines(st, m[2]), accessible: true });
    return true;
  }
  // "Transfer between trains at 59 St [N][R], 36 St [D][N] or …", "Transfer between [Q] and [R] at 14 St-Union Sq or …",
  // "Transfer at Church Av to a Coney Island-bound [F] to continue your trip.", "Transfer to the [2] or [5] at 3 Av-149 St."
  if ((m = /^Transfer (?:between (.+?) )?(?:to (.+?) )?at (.+?)(?: to (.+?))?(?: to continue your trip)?$/i.exec(s))) {
    const [, between, to1, at, to2] = m;
    const lines = [...(between ? lineDirs(between, st.alert.routes).filter((d) => d.line) : []), ...lineDirs(to1 ?? to2 ?? "", st.alert.routes)];
    const named = nameList(at.replace(/\s+to continue your trip$/i, ""));
    // "at 59 St [N][R], 36 St [D][N] or Atlantic Av-Barclays Ctr [D][N]": each station with its own lines.
    if (!lines.length && named.some((n) => n.lines.length)) {
      for (const n of named) st.facts.transfers.push({ at: [ref(st, n.name, n.lines)], lines: n.lines.map((line) => ({ line, toward: null })), ...(bus ? { bus: true as const } : {}) });
      return true;
    }
    st.facts.transfers.push({ at: refs(st, at.replace(/\s+to continue your trip$/i, ""), lines.flatMap((d) => (d.line ? [d.line] : []))), lines, ...(bus ? { bus: true as const } : {}) });
    return true;
  }
  return false;
}

/** Buses: "Free T113 shuttle buses make stops between Dyre Av and E 180 St", "Bx4 bus service is available on Westchester Av at Jackson Av …". */
function busSentence(st: State, raw: string): boolean {
  st.clause = bullets(raw);
  const s = tidy(raw).replace(/\.$/, "");
  let m: RegExpExecArray | null;
  if ((m = /^((?:Free |Additional )?(?:[A-Z]{1,3}\d{1,4}[A-Z]?\+?(?: \([^)]*\))?(?:,? and (?:free )?)?)*)\s*(?:free )?shuttle buses (?:run|make|provide service)(?: overnight only)?(?: along (?:two|three) routes:?)?(?: (?:\[[A-Z0-9]+\] )?(?:all )?(?:station )?stops)?(?: between (.+?) and (.+?))?(?:, stopping at (.+))?$/i.exec(s))) {
    const [, lead, a, raw2, via] = m;
    const route = [...lead.matchAll(/\b([A-Z]{1,3}\d{1,4}[A-Z]?)\b/g)].map((x) => x[1]);
    // "between 168 St and 110 St, connecting with the [1] at Cathedral Pkwy (110 St)": the station named last is the end.
    const conn = raw2 ? /^(.+?), connecting with the ((?:\[[A-Z0-9]+\])+) at (.+)$/.exec(raw2) : null;
    const b = conn ? `${conn[3]} ${conn[2]}` : raw2;
    const between: [StationRef, StationRef] | undefined = a && b ? [ref(st, cleanName(a).name, bullets(a)), ref(st, cleanName(b).name, bullets(b))] : undefined;
    if (a || route.length) st.facts.buses.push({ routes: route.length ? route : st.alert.replacement, shuttle: true, ...(between ? { between } : {}) });
    if (via) refs(st, via);
    return true;
  }
  if (/^Free shuttle buses run on (?:two|three) routes:?$/i.test(s)) return true;
  if ((m = /^\d\.\s*([A-Z]{1,3}\d{1,4})\s+(?:in [A-Z][\w ]+? )?between (.+?) and (.+)$/.exec(s))) {
    st.facts.buses.push({ routes: [m[1]], shuttle: true, between: [ref(st, cleanName(m[2]).name), ref(st, cleanName(m[3]).name)] });
    return true;
  }
  if ((m = /^Additional ([A-Z]{1,3}\d{1,4}) bus service will run along (.+?) between (.+?) and (.+)$/i.exec(s))) {
    st.facts.buses.push({ routes: [m[1]], shuttle: false, at: m[2], between: [ref(st, cleanName(m[3]).name), ref(st, cleanName(m[4]).name)] });
    return true;
  }
  if ((m = /^([A-Z]{1,3}\d{1,4}) bus service is available (?:on|at) (.+?)(?: after [\d:]+ [AP]M)?(?:; (transfer .+))?$/i.exec(s))) {
    st.facts.buses.push({ routes: [m[1]], shuttle: false, at: m[2] });
    if (m[3]) transferSentence(st, m[3].charAt(0).toUpperCase() + m[3].slice(1));
    return true;
  }
  return false;
}

/** The corners each station's shuttle bus stops at, from the alert's per-station notes. */
function busStops(st: State) {
  for (const a of st.alert.alternatives) {
    const station: StationRef = { name: st.ctx.idx.ids.get(a.stop) ?? a.stop, id: st.ctx.idx.ids.has(a.stop) ? a.stop : null };
    if (!station.id) st.ctx.unresolved.add(a.stop);
    for (const line of a.notes.split("\n")) {
      const m = /^\s*\[shuttle bus icon\]\s*(.+?)(?:\s*\(to (.+?)\))?\s*$/i.exec(line);
      if (!m) continue;
      st.facts.busStops.push({ station, corner: m[1].trim(), toward: m[2] ? ref(st, m[2]) : null });
    }
  }
}

/** The MTA text without the reason section ("What's happening? …"), as lines. */
function guidanceLines(description: string): string[] {
  const cut = description.split(/\n?\s*What's happening\??/i);
  const tail = cut.slice(1).join("\n").split("\n").slice(2).join("\n");
  return `${cut[0]}\n${tail}`.split("\n").map((x) => x.trim()).filter(Boolean);
}

/** Turn one slimmed MTA alert into notice facts. Pure. */
export function noticeFacts(alert: SlimAlert, idx: StationIndex): NoticeFacts {
  const facts: NoticeFacts = {
    id: alert.id,
    lines: alert.routes,
    toward: null,
    when: { period: alert.period, windows: alert.windows ?? [[alert.start, alert.end]] },
    changes: [], advice: [], transfers: [], buses: [], busStops: [], unresolved: [], leftover: [],
  };
  const st: State = { ctx: { idx, lines: alert.routes, stops: new Set(alert.stops), unresolved: new Set() }, alert, facts, head: [], clause: [] };

  // The headline. Its first line is the change; a few headlines carry more lines ("[6] service operates in two
  // sections:" and the sections), which are read with the text.
  const [header, ...more] = alert.text.split("\n").map((x) => x.trim()).filter(Boolean);
  if (header && !changeSentence(st, header, false)) facts.leftover.push(header);
  facts.toward = st.head.find((c) => c.toward)?.toward ?? null;

  const lines = [...more, ...guidanceLines(alert.description)];
  let mode: "transferStations" | null = null;
  // What a numbered list ("1. Between …") that follows belongs to.
  let list: "sections" | "buses" | null = null;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (/^(?:Key )?Transfer (?:stations|points|between trains at|at)\s*:?$/i.test(line)) { mode = "transferStations"; continue; }
    // "Take the [F][N][Q] instead via transfer at:" — the stations follow, one per line.
    if (/\bvia transfer at:$/i.test(line)) {
      mode = "transferStations";
      const adv: Advice = { case: "any", stations: [], take: { lines: lineDirs(line.replace(/via transfer at:$/i, ""), alert.routes), to: [] }, text: line };
      facts.advice.push(adv);
      continue;
    }
    if (mode === "transferStations") {
      // "W 4 St-Wash Sq [accessibility icon] | [A][C][E][D][F]", "34 St-Herald Sq | Jamaica-bound [E], [D][F][N][R]",
      // "42 St-Port Authority/Times Sq/Bryant Park" with its bullets on the next line.
      if (!/[[|]/.test(line) && /^\s*(?:\[[A-Z0-9]{1,3}\]\s*)+$/.test(lines[i + 1] ?? "")) line = `${line} ${lines[++i]}`;
      const t = /^([A-Z0-9][^[|]*?)\s*(?:\[accessibility icon\])?\s*(?:\([A-Z](?:, \w+)?\))?\s*\|?\s*((?:Jamaica-bound |Manhattan-bound |[\w ]+-bound )?\[.*)$/.exec(line);
      if (t && !/^(?:Note|For|Transfer|What|Schedule|Or\b)/i.test(line) && !t[1].includes(":")) {
        const n = cleanName(t[1]);
        const dirs = lineDirs(t[2].replace(/\(.*?\)/g, ""), alert.routes).filter((d) => d.line);
        const bus = /shuttle bus icon/i.test(line);
        facts.transfers.push({ at: [ref(st, n.name, dirs.map((d) => d.line!))], lines: dirs, ...(bus ? { bus: true as const } : {}) });
        continue;
      }
      mode = null;
    }
    if (/\bsections\b.*:$/i.test(line)) list = "sections";
    else if (/\broutes:$/i.test(line)) list = "buses";
    const sec = /^\d\.\s*(?:Between )?(.+?) and (.+?)(?:, every (\d+) minutes)?$/i.exec(line);
    if (sec && list === "sections") {
      const target = [...facts.changes].reverse().find((c) => c.kind === "sections");
      if (target && target.kind === "sections") {
        target.sections.push([ref(st, cleanName(sec[1]).name), ref(st, cleanName(sec[2]).name)]);
        if (sec[3]) target.everyMin = Number(sec[3]);
        continue;
      }
    }
    for (const raw of sentences(line)) {
      const s = raw.trim();
      if (!s || BOILERPLATE.some((r) => r.test(s.replace(/^\[accessibility icon\]\s*/i, "")))) continue;
      const note = /^(?:Notes?|\*|Schedule reminder)/i.test(s) || /^\*/.test(raw);
      const body = s.replace(/^(?:Notes?|Travel tips?|Travel alternatives?):\s*/i, "").replace(/^\*\s*/, "");
      if (!body) continue;
      // "Trains stop at City Hall, …" / "Boarding change includes Jefferson Av, Dongan Hills and Old Town stations."
      let m: RegExpExecArray | null;
      if ((m = /^Trains (?:also )?stop at (.+?)\.?$/i.exec(body))) {
        const stops = refs(st, m[1], st.head.flatMap((c) => [c.line, ...(c.kind === "reroute" ? c.via : [])]));
        const h = st.head.filter((c) => c.kind === "reroute" || c.kind === "skip" || c.kind === "express");
        if (h.length) for (const c of h) (c as { stops?: StationRef[] }).stops = stops;
        else for (const line of alert.routes) facts.changes.push({ kind: "extraStops", line, toward: facts.toward, stations: stops });
        continue;
      }
      if ((m = /^Boarding change includes (.+?)\.?$/i.exec(body))) {
        const stations = refs(st, m[1]);
        for (const c of st.head) if (c.kind === "platform") c.stations = stations;
        continue;
      }
      if (busSentence(st, body) || transferSentence(st, s.replace(/^Or,?\s+t/, "T")) || adviceSentence(st, body) || changeSentence(st, body, note)) continue;
      // Notes that restate the headline's direction or the stations it skips are not guidance of their own.
      facts.leftover.push(tidy(s));
    }
  }
  busStops(st);
  facts.unresolved = [...st.ctx.unresolved];
  return facts;
}

/** Does a notice carry enough facts for a walk: at least one change, and every station it names found in our data. */
export const hasFacts = (f: NoticeFacts) => f.changes.length > 0 && f.unresolved.length === 0;
