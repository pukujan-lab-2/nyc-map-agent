/**
 * Notice facts over HTTP, and the nightly coverage report (step 8 of `docs/PLAN-notice-walks.md`).
 *
 *   GET /api/transit-notices?id=<notice id>&lang=<app language>
 *     → { id, source, facts, flags, mta? }. `source` is "rules", "model" or "text"; `mta` (the MTA text in the
 *       rider's language) comes only with "text", for a notice we cannot turn into a walk.
 *   GET /api/transit-health/notices[?format=text]
 *     → the last nightly report: how many live notices became facts, which fell back to text and why.
 *
 * The server runs the report itself at 4 AM New York time, and once a few minutes after it starts so a deploy
 * never leaves the page empty, the same way `server/features/agent/health.ts` keeps its watcher. The CI runners
 * have no schedules since the move to the VPS, and the report needs the server's model for the notices no rule reads.
 */
import { readFileSync } from "node:fs";
import { json } from "../../../api/_lib/http";
import { APP_LANGS } from "../../../src/lib/voice/langPref";
import type { MercuryAlert, SlimAlert } from "./alerts";
import { slimAlert } from "./alerts";
import { coverageReport, helpNotice, noticeText, subwayData, type CoverageReport, type NoticeDeps, type SubwayData } from "./noticeHelper";

const FEED = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Fsubway-alerts.json";
const ID = /^[\w:.-]{1,80}$/;

let subway: SubwayData | null = null;
/** `public/transit/subway.json`, read once (3 MB). */
const subwayDataOnDisk = () =>
  (subway ??= subwayData(JSON.parse(readFileSync(new URL("../../../public/transit/subway.json", import.meta.url), "utf8")) as Parameters<typeof subwayData>[0]));

let feed: { at: number; alerts: Promise<SlimAlert[]> } | null = null;
/** Every subway notice that has not ended, however far ahead it starts, kept five minutes. */
function liveNotices(now = Date.now()): Promise<SlimAlert[]> {
  if (feed && now - feed.at < 5 * 60_000) return feed.alerts;
  const alerts = fetch(FEED, { signal: AbortSignal.timeout(15_000) }).then((r) => r.json()).then((f: { entity?: MercuryAlert[] }) => {
    const at = Math.round(now / 1000);
    return (f.entity ?? []).flatMap((e) => slimAlert(e, at, at + 366 * 86_400) ?? []);
  });
  feed = { at: now, alerts };
  alerts.catch(() => { if (feed?.alerts === alerts) feed = null; });
  return alerts;
}

export async function GET_FACTS(req: Request, deps: NoticeDeps, load = liveNotices, data = subwayDataOnDisk): Promise<Response> {
  const q = new URL(req.url).searchParams;
  const id = q.get("id") ?? "";
  const lang = APP_LANGS.find((l) => l === (q.get("lang") ?? "en"));
  if (!ID.test(id) || !lang) return json({ error: "id must be a notice id; lang one of the app's languages" }, { status: 400 });
  try {
    const alert = (await load()).find((a) => a.id === id);
    if (!alert) return json({ error: "no such notice" }, { status: 404 });
    const help = await helpNotice(alert, data(), deps);
    const mta = help.source === "text" ? await noticeText(alert, lang, deps, req.signal) : undefined;
    return json({ ...help, ...(mta ? { mta } : {}) }, { maxAge: 300, browserMaxAge: 120 });
  } catch (e) {
    console.error(`notice facts: ${(e as Error).message}`);
    return json({ error: "upstream_error" }, { status: 502 });
  }
}

let last: CoverageReport | null = null;

/** Run the report over the live notices now and keep it for the page. */
export async function runNoticeReport(deps: NoticeDeps, load = liveNotices, data = subwayDataOnDisk): Promise<CoverageReport> {
  const d = data();
  const r = await coverageReport(await load(), (a) => helpNotice(a, d, deps));
  last = r;
  console.log(`[notices] ${r.rules + r.model} of ${r.notices} notices became facts (${r.model} by the model); ${r.text} fell back to text`);
  return r;
}

export function GET_REPORT(req: Request): Promise<Response> {
  const text = new URL(req.url).searchParams.get("format") === "text";
  if (!last) return Promise.resolve(text ? new Response("No report yet: the first runs a few minutes after the server starts.\n", { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } }) : json({ ready: false }, { maxAge: 60 }));
  if (text) return Promise.resolve(new Response(last.markdown, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300" } }));
  return Promise.resolve(json({ ready: true, ...last }, { maxAge: 300 }));
}

/** New York's hour and date for `ms`. */
const nyHour = (ms: number) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(ms).map((x) => [x.type, x.value]));
  return { hour: Number(p.hour), day: `${p.year}-${p.month}-${p.day}` };
};

/** Is it time for the nightly run: 4 AM New York or later, and not yet run that New York day. Pure, for tests. */
export const dueAt = (ms: number, lastDay: string | null) => {
  const t = nyHour(ms);
  return t.hour >= 4 && t.day !== lastDay ? t.day : null;
};

let started = false;
/** Start the nightly report: once five minutes after boot, then each New York day from 4 AM. Starts once. */
export function startNoticeReport(deps: NoticeDeps, log: (m: string) => void = console.warn): void {
  if (started) return;
  started = true;
  let lastDay: string | null = null;
  const run = () => runNoticeReport(deps).catch((e: Error) => log(`[notices] report failed: ${e.message}`));
  setTimeout(() => {
    const t = nyHour(Date.now());
    if (t.hour >= 4) lastDay = t.day;
    void run();
  }, 5 * 60_000).unref();
  setInterval(() => {
    const day = dueAt(Date.now(), lastDay);
    if (day) { lastDay = day; void run(); }
  }, 15 * 60_000).unref();
}
