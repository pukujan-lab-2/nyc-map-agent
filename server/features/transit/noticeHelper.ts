/**
 * The model as a checked helper for notices our rules cannot read (step 8 of `docs/PLAN-notice-walks.md`).
 *
 * - Rules first: `noticeFacts` in `./noticeFacts`. A notice whose facts are complete never reaches a model.
 * - For the rest, the agent's own model reads the MTA text and proposes facts in the same `NoticeFacts` shape. Code
 *   then checks every station, line and direction against `public/transit/subway.json` (`checkProposal`). The model
 *   proposes facts only: the walk's words still come from the fixed sentence patterns, and any sentence it quotes
 *   must be the MTA's own.
 * - When the check fails, or no model answers, the notice falls back to the MTA text, translated into the rider's
 *   language, and is flagged so a new rule can be written (`flags`).
 * - Answers are kept per notice id and text hash, so the same notice is never sent to the model twice. A call that
 *   got no answer at all is tried again after an hour.
 *
 * The model and the translation come in as `NoticeDeps` from `server/app.ts`, because one server feature may not
 * import another (`.dependency-cruiser.cjs`). Nothing here picks a provider or holds a key.
 */
import { createHash } from "node:crypto";
import { generateText, type LanguageModel } from "ai";
import type { AppLang } from "../../../src/lib/voice/langPref";
import type { SlimAlert } from "./alerts";
import { findStation, hasFacts, headlineToward, noticeFacts, stationIndex, type Advice, type Bus, type Change, type LineDir, type NoticeFacts, type Station, type StationIndex, type StationRef, type Transfer } from "./noticeFacts";

/** What the helper needs from outside the transit feature: the agent's model and its translation path. */
export type NoticeDeps = {
  model: () => LanguageModel;
  translate: (lang: AppLang, lines: string[], opts?: { signal?: AbortSignal }) => Promise<{ lines: string[] } | { error: string }>;
};

/** Our subway data, as the checker reads it. */
export type SubwayData = { idx: StationIndex; routes: Map<string, Set<string>>; lines: Set<string> };

/** One notice after the helper: where its facts came from, or why it shows the MTA text. */
type NoticeHelp = {
  id: string;
  /** "rules": our parser read it. "model": the model proposed facts and every one passed the check. "text": show the MTA text. */
  source: "rules" | "model" | "text";
  facts: NoticeFacts | null;
  /** Why the rules missed it and, for "text", why the model's facts were refused. Empty for "rules". */
  flags: string[];
};

/** Index `public/transit/subway.json` for the checker: stations by name, and which lines stop at each station. */
export function subwayData(subway: { stations: { features: Array<{ properties: Station }> } }): SubwayData {
  const stations = subway.stations.features.map((f) => f.properties);
  const routes = new Map<string, Set<string>>();
  const lines = new Set<string>();
  for (const s of stations) {
    const r = new Set(s.routes.split(/\s+/).filter(Boolean));
    routes.set(s.id, r);
    r.forEach((x) => lines.add(x));
  }
  return { idx: stationIndex(stations), routes, lines };
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Asking                                                                                                         */
/* ------------------------------------------------------------------------------------------------------------ */

/** The instruction for the model. Pure, for tests. */
function factsPrompt(lines: Iterable<string>): string {
  return [
    "You read one New York City subway service notice and write down its facts as JSON. You do not write anything a rider will read.",
    "Reply with only one JSON object: {\"toward\": string|null, \"changes\": Change[], \"advice\": Advice[], \"transfers\": Transfer[], \"buses\": Bus[]}.",
    `Lines are written as these ids only: ${[...lines].join(" ")}. The 42 St shuttle is GS, the Franklin Av shuttle FS, the Rockaway Park shuttle H, the Staten Island Railway SI.`,
    "A station is written {\"name\": \"…\"}, with the name exactly as the notice writes it. Never add a station the notice does not name.",
    "toward is the direction exactly as the notice names it: the word before -bound (\"Flushing\" for Flushing-bound), or uptown or downtown; null when both directions or none is named.",
    "Change is one of, each with line and toward:",
    "{kind:\"skip\", stations}, {kind:\"closed\", stations}, {kind:\"suspended\", from, to}, {kind:\"noService\"}, {kind:\"runs\", from, to},",
    "{kind:\"sections\", sections:[[a,b],…]}, {kind:\"express\", from, to}, {kind:\"local\", from, to}, {kind:\"extraStops\", stations},",
    "{kind:\"reroute\", via:[lines], from, to}, {kind:\"replacedBy\", by: line, from, to}, {kind:\"platform\", stations, boardFrom: the notice's words},",
    "{kind:\"frequency\", everyMin: number|null}, {kind:\"delays\", at: stations}, {kind:\"shortTurn\", lastStop}, {kind:\"entrance\", stations, detail: the notice's words},",
    "{kind:\"schedule\", detail: \"ends early\"|\"begins early\"|\"runs overnight\"|\"modified schedule\"}.",
    "Advice: {case: \"to\"|\"from\"|\"any\", stations, take?: {lines:[{line, toward}], to: stations}, transfer?: {lines:[{line, toward}], at: stations}, nearby?: {stations, lines}, buses?: [routes], text: the notice's sentence copied exactly}.",
    "Transfer: {at: stations, lines:[{line, toward}]}. Bus: {routes: [\"M14\"], shuttle: boolean, between?: [a, b]}.",
    "Leave out the reason for the work and anything you are not sure of.",
  ].join("\n");
}

/** The model's reply as a JSON object, or null. Pure, for tests. */
export function parseProposal(reply: string): Record<string, unknown> | null {
  const m = /\{[\s\S]*\}/.exec(reply);
  if (!m) return null;
  try {
    const out: unknown = JSON.parse(m[0]);
    return out && typeof out === "object" && !Array.isArray(out) ? (out as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Checking                                                                                                       */
/* ------------------------------------------------------------------------------------------------------------ */

const KINDS: Record<Change["kind"], { one?: string[]; many?: string[]; pairs?: string[]; onLine?: true }> = {
  skip: { many: ["stations", "stops"], onLine: true }, closed: { many: ["stations"], onLine: true }, suspended: { one: ["from", "to"] },
  noService: {}, runs: { one: ["from", "to"] }, sections: { pairs: ["sections"] }, express: { one: ["from", "to"], many: ["skips"] },
  local: { one: ["from", "to"] }, extraStops: { many: ["stations"] }, reroute: { one: ["from", "to"], many: ["stops"] },
  replacedBy: { one: ["from", "to"] }, platform: { many: ["stations"], onLine: true }, frequency: { one: ["from", "to"] },
  delays: { many: ["at"] }, shortTurn: { one: ["lastStop"] }, entrance: { many: ["stations"] }, schedule: { one: ["from", "to"] },
};
const SCHEDULE = new Set(["ends early", "begins early", "runs overnight", "modified schedule"]);
const BUS_ROUTE = /^(?:B|Bx|BX|M|Q|S|BM|QM|X|SIM|BxM)\d{1,3}[A-Z]?\+?$/;
const AREA = /^(?:the )?(?:manhattan|brooklyn|queens|bronx|staten island)$/i;
/** Lowercase letters and digits only, for "is this the MTA's own sentence". */
const flat = (s: string) => s.toLowerCase().replace(/\[[^\]]*icon\]/g, "").replace(/[^a-z0-9]+/g, "");

type Check = { data: SubwayData; alert: SlimAlert; problems: string[] };

const nameOf = (x: unknown): string | null =>
  typeof x === "string" ? x : x && typeof x === "object" && typeof (x as { name?: unknown }).name === "string" ? (x as { name: string }).name : null;

/** A station the model named, checked: it must be in our data, and on `line` when `onLine` is given. Our id, never the model's. */
function station(c: Check, raw: unknown, lines: string[], onLine?: string): StationRef | null {
  const name = nameOf(raw)?.trim();
  if (!name) { c.problems.push("a station with no name"); return null; }
  const hit = findStation(c.data.idx, name, lines, c.alert.stops);
  if (!hit.found) { c.problems.push(`unknown station "${name}"`); return null; }
  if (hit.id && onLine && !c.data.routes.get(hit.id)?.has(onLine)) c.problems.push(`"${name}" is not a ${onLine} station`);
  return { name, id: hit.id };
}
const stations = (c: Check, raw: unknown, lines: string[], onLine?: string): StationRef[] =>
  (Array.isArray(raw) ? raw : raw == null ? [] : [raw]).flatMap((x) => station(c, x, lines, onLine) ?? []);

/** A line id from the model: one of ours. "S" is read as the notice's own shuttle, "SIR" as SI. */
function line(c: Check, raw: unknown): string | null {
  if (typeof raw !== "string") { c.problems.push("a change with no line"); return null; }
  const l = raw.replace(/^\[|\]$/g, "").trim();
  const id = l === "SIR" ? "SI" : l === "S" ? c.alert.routes.find((x) => ["GS", "FS", "H"].includes(x)) ?? "" : l;
  if (!c.data.lines.has(id)) { c.problems.push(`unknown line "${raw}"`); return null; }
  return id;
}

/**
 * A direction from the model, for `line`. It must be uptown, downtown, a borough, or a station the line serves
 * ("Flushing" for the 7, not for the 4), and match the direction the notice's own headline names.
 */
function toward(c: Check, raw: unknown, l: string | null, headline: string | null): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") { c.problems.push("a direction that is not a name"); return null; }
  const t = raw.replace(/-bound$/i, "").trim();
  if (headline && t.toLowerCase() !== headline.toLowerCase()) c.problems.push(`direction "${t}" for the ${l ?? "train"} is not the notice's "${headline}"`);
  if (/^(?:uptown|downtown)$/i.test(t)) return t.toLowerCase();
  if (AREA.test(t)) return t;
  const hit = findStation(c.data.idx, t, l ? [l] : []);
  if (!hit.found || !hit.id || (l && !c.data.routes.get(hit.id)?.has(l))) c.problems.push(`"${t}" is not a direction the ${l ?? "train"} runs`);
  return t;
}

function lineDirs(c: Check, raw: unknown, headline: string | null): LineDir[] {
  return (Array.isArray(raw) ? raw : []).map((x) => {
    const o = (x ?? {}) as { line?: unknown; toward?: unknown };
    const l = o.line == null ? null : line(c, o.line);
    return { line: l, toward: toward(c, o.toward, l, headline) };
  });
}

function mtaWords(c: Check, s: unknown, what: string): string {
  if (typeof s !== "string" || !s.trim()) { c.problems.push(`${what} is empty`); return ""; }
  if (!flat(`${c.alert.text} ${c.alert.description}`).includes(flat(s))) c.problems.push(`${what} "${s.slice(0, 60)}" is not the notice's own words`);
  return s.trim();
}

/**
 * Check a model's proposed facts against our data and the notice. Returns the facts with our station ids, or every
 * problem found. Pure, for tests. `rules` is what the parser got from the same notice: its time windows, the
 * headline's direction and the shuttle-bus corners are kept, since those never came from reading the prose.
 */
export function checkProposal(proposal: Record<string, unknown>, alert: SlimAlert, data: SubwayData, rules: NoticeFacts): { ok: true; facts: NoticeFacts } | { ok: false; problems: string[] } {
  const c: Check = { data, alert, problems: [] };
  const head = rules.toward ?? headlineToward(alert);
  const top = toward(c, proposal.toward, alert.routes.length === 1 ? alert.routes[0] : null, head);
  const changes: Change[] = [];
  for (const raw of Array.isArray(proposal.changes) ? proposal.changes : []) {
    const o = (raw ?? {}) as Record<string, unknown>;
    const kind = o.kind as Change["kind"];
    const spec = KINDS[kind];
    if (!spec) { c.problems.push(`unknown change "${String(o.kind)}"`); continue; }
    const l = line(c, o.line);
    if (!l) continue;
    // A change's own direction must agree with the headline only when the notice is about one direction overall.
    const out: Record<string, unknown> = { kind, line: l, toward: toward(c, o.toward, l, head) };
    for (const k of spec.one ?? []) if (o[k] != null) out[k] = station(c, o[k], [l]);
    for (const k of spec.many ?? []) if (o[k] != null || k === "stations" || k === "at") out[k] = stations(c, o[k], [l], spec.onLine && k !== "stops" ? l : undefined);
    for (const k of spec.pairs ?? []) out[k] = (Array.isArray(o[k]) ? (o[k] as unknown[]) : []).map((p) => stations(c, p, [l]).slice(0, 2));
    if (kind === "reroute") out.via = (Array.isArray(o.via) ? o.via : []).flatMap((v) => line(c, v) ?? []);
    if (kind === "replacedBy") out.by = line(c, o.by);
    if (kind === "platform") out.boardFrom = mtaWords(c, o.boardFrom, "the platform");
    if (kind === "entrance") out.detail = mtaWords(c, o.detail, "the entrance");
    if (kind === "schedule" && !SCHEDULE.has(String(o.detail))) c.problems.push(`unknown schedule change "${String(o.detail)}"`);
    if (kind === "schedule") out.detail = o.detail;
    if (kind === "frequency") out.everyMin = typeof o.everyMin === "number" && o.everyMin > 0 && o.everyMin < 120 ? o.everyMin : null;
    if ((kind === "skip" || kind === "closed" || kind === "extraStops" || kind === "platform") && !(out.stations as StationRef[]).length) c.problems.push(`a ${kind} change with no stations`);
    changes.push(out as Change);
  }
  if (!changes.length) c.problems.push("no change to service");

  const advice: Advice[] = (Array.isArray(proposal.advice) ? proposal.advice : []).map((raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const take = o.take as { lines?: unknown; to?: unknown } | undefined;
    const transfer = o.transfer as { lines?: unknown; at?: unknown } | undefined;
    const nearby = o.nearby as { stations?: unknown; lines?: unknown } | undefined;
    const kase = o.case === "to" || o.case === "from" ? o.case : "any";
    const a: Advice = { case: kase, stations: stations(c, o.stations, alert.routes), text: mtaWords(c, o.text, "an advice sentence") };
    if (Array.isArray(o.between) && o.between.length === 2) a.between = stations(c, o.between, alert.routes) as [StationRef, StationRef];
    if (take) { const ls = lineDirs(c, take.lines, null); a.take = { lines: ls, to: stations(c, take.to, ls.flatMap((x) => x.line ?? [])) }; }
    if (transfer) { const ls = lineDirs(c, transfer.lines, null); a.transfer = { lines: ls, at: stations(c, transfer.at, ls.flatMap((x) => x.line ?? [])) }; }
    if (nearby) { const ls = (Array.isArray(nearby.lines) ? nearby.lines : []).flatMap((x) => line(c, x) ?? []); a.nearby = { stations: stations(c, nearby.stations, ls), lines: ls }; }
    if (Array.isArray(o.buses)) a.buses = busRoutes(c, o.buses);
    return a;
  });
  const transfers: Transfer[] = (Array.isArray(proposal.transfers) ? proposal.transfers : []).map((raw) => {
    const o = (raw ?? {}) as { at?: unknown; lines?: unknown };
    const ls = lineDirs(c, o.lines, null);
    return { at: stations(c, o.at, ls.flatMap((x) => x.line ?? [])), lines: ls };
  });
  const buses: Bus[] = (Array.isArray(proposal.buses) ? proposal.buses : []).map((raw) => {
    const o = (raw ?? {}) as { routes?: unknown; shuttle?: unknown; between?: unknown };
    const b: Bus = { routes: busRoutes(c, Array.isArray(o.routes) ? o.routes : []), shuttle: o.shuttle === true };
    if (Array.isArray(o.between) && o.between.length === 2) b.between = stations(c, o.between, alert.routes) as [StationRef, StationRef];
    return b;
  });
  if (c.problems.length) return { ok: false, problems: [...new Set(c.problems)] };
  return { ok: true, facts: { ...rules, toward: top ?? head, changes, advice, transfers, buses, unresolved: [], leftover: [] } };
}

function busRoutes(c: Check, raw: unknown[]): string[] {
  return raw.flatMap((r) => {
    if (r === "shuttle") return [r];
    if (typeof r === "string" && BUS_ROUTE.test(r.trim())) return [r.trim()];
    c.problems.push(`unknown bus route "${String(r)}"`);
    return [];
  });
}

/* ------------------------------------------------------------------------------------------------------------ */
/* The helper                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------ */

const RETRY_MS = 3_600_000;
const CACHE_MAX = 1000;
const MAX_TEXT = 6000;
type Kept = { help: Promise<NoticeHelp>; retryAt: number | null };
const kept = new Map<string, Kept>();
let asked = 0;

/** The cache key: the notice id and a hash of its text, so an edited notice is read again. */
export const noticeKey = (a: SlimAlert) => `${a.id}\u0000${createHash("sha256").update(`${a.text}\u0000${a.description}`).digest("hex").slice(0, 16)}`;

/** Why the rules did not give a walk. */
const missed = (f: NoticeFacts) => [f.changes.length ? "" : "no rule matched", f.unresolved.length ? `stations not found: ${f.unresolved.join(", ")}` : ""].filter(Boolean);

/** How many times the model has been asked since the server started (tests and the report read it). */
export const modelCalls = () => asked;

/** For tests: forget every kept answer. */
export function forgetNoticeHelp(): void { kept.clear(); asked = 0; }

/**
 * One notice's facts: from the rules, else from the model when every fact passes the check, else none (show the MTA
 * text). The model is asked at most once per notice id and text; a call that failed outright is retried after an hour.
 */
export function helpNotice(alert: SlimAlert, data: SubwayData, deps: Pick<NoticeDeps, "model">, now = Date.now()): Promise<NoticeHelp> {
  const rules = noticeFacts(alert, data.idx);
  if (hasFacts(rules)) return Promise.resolve({ id: alert.id, source: "rules", facts: rules, flags: [] });
  const key = noticeKey(alert);
  const hit = kept.get(key);
  if (hit && (hit.retryAt == null || hit.retryAt > now)) return hit.help;
  const entry: Kept = { help: Promise.resolve(null as never), retryAt: null };
  entry.help = ask(alert, data, deps, rules).then((r) => {
    if (r.retry) entry.retryAt = now + RETRY_MS;
    return r.help;
  });
  if (kept.size >= CACHE_MAX) kept.delete(kept.keys().next().value!);
  kept.set(key, entry);
  return entry.help;
}

async function ask(alert: SlimAlert, data: SubwayData, deps: Pick<NoticeDeps, "model">, rules: NoticeFacts): Promise<{ help: NoticeHelp; retry: boolean }> {
  const flags = missed(rules);
  const text = (h: string[], retry = false) => ({ help: { id: alert.id, source: "text" as const, facts: null, flags: [...flags, ...h] }, retry });
  let reply: string;
  try {
    asked++;
    const { text: t } = await generateText({
      model: deps.model(),
      system: factsPrompt(data.lines),
      prompt: `${alert.text}\n\n${alert.description}`.slice(0, MAX_TEXT),
      maxOutputTokens: 3000,
      abortSignal: AbortSignal.timeout(60_000),
    });
    reply = t;
  } catch (e) {
    console.warn(`notice helper: ${alert.id}: ${(e as Error).message}`);
    return text([`model did not answer: ${(e as Error).message}`], true);
  }
  const proposal = parseProposal(reply);
  if (!proposal) return text(["model's answer was not facts"]);
  const checked = checkProposal(proposal, alert, data, rules);
  if (!checked.ok) return text(checked.problems.map((p) => `model's facts refused: ${p}`));
  return { help: { id: alert.id, source: "model", facts: checked.facts, flags }, retry: false };
}

/* ------------------------------------------------------------------------------------------------------------ */
/* MTA text in the rider's language                                                                               */
/* ------------------------------------------------------------------------------------------------------------ */

const LINE_MAX = 400;
const BATCH = 24;

/** The MTA text as lines of at most 400 characters, split at sentences, for the translate path. Pure, for tests. */
export function mtaLines(alert: SlimAlert): string[] {
  const out: string[] = [];
  for (const raw of `${alert.text}\n${alert.description}`.split("\n").map((x) => x.trim()).filter(Boolean)) {
    if (raw.length <= LINE_MAX) { out.push(raw); continue; }
    let cur = "";
    for (const s of raw.split(/(?<=[.!?])\s+/)) {
      if (cur && cur.length + s.length + 1 > LINE_MAX) { out.push(cur); cur = ""; }
      cur = cur ? `${cur} ${s}` : s;
      while (cur.length > LINE_MAX) { out.push(cur.slice(0, LINE_MAX)); cur = cur.slice(LINE_MAX); }
    }
    if (cur) out.push(cur);
  }
  return out;
}

/**
 * The MTA text of a notice we cannot turn into a walk, in the rider's language, through the agent's translate path
 * (which keeps every answer, so each notice is translated once per language). English, or a failed translation,
 * gives the MTA's own words with `translated: false`.
 */
export async function noticeText(alert: SlimAlert, lang: AppLang, deps: Pick<NoticeDeps, "translate">, signal?: AbortSignal): Promise<{ lang: AppLang; lines: string[]; translated: boolean }> {
  const lines = mtaLines(alert);
  if (lang === "en" || !lines.length) return { lang: "en", lines, translated: false };
  const out: string[] = [];
  for (let i = 0; i < lines.length; i += BATCH) {
    const r = await deps.translate(lang, lines.slice(i, i + BATCH), { signal });
    if (!("lines" in r)) return { lang: "en", lines, translated: false };
    out.push(...r.lines);
  }
  return { lang, lines: out, translated: true };
}

/* ------------------------------------------------------------------------------------------------------------ */
/* The coverage report                                                                                            */
/* ------------------------------------------------------------------------------------------------------------ */

export type CoverageReport = {
  at: string;
  notices: number;
  rules: number;
  model: number;
  text: number;
  /** Notices that became facts but keep guidance sentences no rule understood (shown as MTA text). */
  leftover: number;
  /** Every notice that did not come from the rules, with why. */
  flagged: Array<{ id: string; lines: string[]; headline: string; source: "model" | "text"; flags: string[] }>;
  markdown: string;
};

/**
 * Run every notice through the helper and say how many became facts, which fell back to text and why. `help` is
 * `helpNotice` with its deps bound; the coverage script passes one that never asks a model.
 */
export async function coverageReport(alerts: SlimAlert[], help: (a: SlimAlert) => Promise<NoticeHelp>, at = new Date()): Promise<CoverageReport> {
  const done = await Promise.all(alerts.map(async (a) => ({ a, h: await help(a) })));
  const count = (s: NoticeHelp["source"]) => done.filter((x) => x.h.source === s).length;
  const leftover = done.filter((x) => x.h.facts && x.h.facts.leftover.length).length;
  const flagged = done.filter((x) => x.h.source !== "rules").map(({ a, h }) => ({ id: a.id, lines: a.routes, headline: a.text.split("\n")[0].trim(), source: h.source as "model" | "text", flags: h.flags }));
  const r = { at: at.toISOString(), notices: done.length, rules: count("rules"), model: count("model"), text: count("text"), leftover, flagged };
  const pct = (n: number) => `${Math.round((n / Math.max(1, r.notices)) * 1000) / 10}%`;
  const md = [
    `# Notice coverage, ${r.at.slice(0, 16).replace("T", " ")} UTC`,
    "",
    `${r.rules + r.model} of ${r.notices} subway notices became walk facts (${pct(r.rules + r.model)}): ${r.rules} by our rules, ${r.model} by the model with every station, line and direction checked.`,
    `${r.text} fell back to the MTA text. ${r.leftover} of the notices with facts keep a sentence or more as MTA text.`,
  ];
  const list = (title: string, rows: typeof flagged) => rows.length && md.push("", `## ${title}`, "", ...rows.map((f) => `- ${f.id} [${f.lines.join(" ")}] ${f.headline}\n  ${f.flags.join("; ")}`));
  list("Fell back to the MTA text", flagged.filter((f) => f.source === "text"));
  list("Read by the model (each needs a new rule)", flagged.filter((f) => f.source === "model"));
  return { ...r, markdown: `${md.join("\n")}\n` };
}

/** A `help` for the coverage script and tests: rules only, and every miss is a fallback to text. */
export const rulesOnly = (data: SubwayData) => (a: SlimAlert): Promise<NoticeHelp> => {
  const f = noticeFacts(a, data.idx);
  return Promise.resolve(hasFacts(f) ? { id: a.id, source: "rules", facts: f, flags: [] } : { id: a.id, source: "text", facts: null, flags: [...missed(f), "model not asked"] });
};
