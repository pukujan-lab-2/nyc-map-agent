/**
 * Notice-walk speech made ahead (owner, 2026-11-27). Every 30 seconds the server reads the MTA's notices for the
 * next eight days (through the same five-minute feed cache the line panel uses). For a notice that is new or has
 * changed, it builds every walk a rider could open (each line it names, each stop, getting off and getting on, and
 * the walk for every trip) and lists the sentences. A small queue then asks the speech server for the ones not
 * made yet, one at a time, and only while no rider is waiting on it. A notice that ends or changes lets go of its
 * clips; `ClipStore.clean` deletes those no one has played for 7 days.
 *
 * GET /api/tts/clip/<key> serves a clip with long immutable cache headers (the key names the words and the voice,
 * so it never changes); GET /api/tts/voice tells the phone which voice and languages to compute keys for. The
 * phone falls back to live POST /api/tts, then its own voice, for a clip that is not made yet.
 *
 * Nothing about riders is stored: the sentences are the app's own words about public MTA notices.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { noticeWalk } from "../../../src/features/transit/noticeWalk";
import type { StaticSystem } from "../../../src/features/transit/model";
import { CLIP_LANGS, CLIP_RE, clipKey, spokenText } from "../../../src/lib/voice/clipKey";
import { ClipStore, clipDb, clipDir, type ClipStats, type Want } from "./clipStore";
import { MAX_CHARS, TTS_LANGS, liveSpeechBusy, ttsConfig, voiceTag } from "./tts";

/**
 * A notice as the transit feature's alert loader gives it (`SlimAlert` in server/features/transit/alerts.ts).
 * Only the id and lines are read here; the walk builder reads the rest. Kept as its own type so this feature
 * does not import another's (dependency-cruiser's no-cross-server-feature); server/app.ts passes the loader in.
 */
type Notice = { id: string; routes: string[] };

/** Languages clips are made in: those with fixed walk sentences that Kokoro also speaks. */
const clipLangs = (): string[] => CLIP_LANGS.filter((l) => TTS_LANGS.has(l));

/**
 * Every sentence the walks for one notice can say in `lang`, as spoken. English comes straight from the walk
 * builder; another language gets lines once plan step 7 ships its sentence table. Pure.
 */
export function walkLines(a: Notice, sys: StaticSystem, lang: string): string[] {
  if (lang !== "en" || !CLIP_LANGS.includes(lang)) return [];
  const out = new Set<string>();
  // `say` is the step's spoken form ("74th Street, Broadway"), which is what the phone hands the voice.
  const add = (steps: Array<{ say: string }>) => { for (const s of steps) { const t = spokenText(s.say); if (t && t.length <= MAX_CHARS) out.add(t); } };
  const alert = a as unknown as Parameters<typeof noticeWalk>[0];
  for (const route of a.routes.filter((r) => sys.stopM[r])) {
    const w = noticeWalk(alert, sys, route, null);
    add(w.steps);
    for (const stop of w.stops) for (const mode of ["off", "on"] as const) add(noticeWalk(alert, sys, route, { stop, mode }).steps);
  }
  return [...out];
}

/** Two copies of a notice with the same fingerprint make the same walks. Pure. */
const fingerprint = (a: Notice): string => createHash("sha256").update(JSON.stringify(a)).digest("hex");

const tick = () => new Promise<void>((r) => setImmediate(r));

/** Keeps each live notice's clip list current in the store and feeds what is missing to the queue. */
export class NoticeClips {
  private seen = new Map<string, string>();
  /** True once a feed has been read since start; until then nothing is orphaned, so nothing is cleaned. */
  synced = false;
  constructor(private store: ClipStore, private queue: ClipQueue, private sys: () => StaticSystem | null, private voice: string, private langs: string[] = clipLangs(), private lines: typeof walkLines = walkLines) {}

  /** One poll. `alerts` is null (or empty) when the feed could not be read: then no notice is taken for ended. */
  async sync(alerts: Notice[] | null): Promise<{ changed: number; ended: number; queued: number }> {
    const sys = this.sys();
    if (!alerts?.length || !sys) return { changed: 0, ended: 0, queued: 0 };
    const live = new Set<string>();
    let changed = 0;
    for (const a of alerts) {
      live.add(a.id);
      const fp = fingerprint(a);
      if (this.seen.get(a.id) === fp) continue;
      const wants = new Map<string, Want>();
      for (const lang of this.langs) {
        for (const text of this.lines(a, sys, lang)) {
          const key = await clipKey(text, lang, this.voice);
          wants.set(key, { key, lang, text });
        }
      }
      this.store.setNotice(a.id, [...wants.values()]);
      this.seen.set(a.id, fp);
      changed++;
      await tick(); // a big notice costs about 50 ms; let requests in between
    }
    let ended = 0;
    for (const id of this.store.notices()) {
      if (live.has(id)) continue;
      this.store.endNotice(id);
      this.seen.delete(id);
      ended++;
    }
    this.synced = true;
    return { changed, ended, queued: this.queue.add(this.store.missing()) };
  }
}

/**
 * Makes clips one at a time (`concurrency`), in the order asked, waiting while `busy()` says a rider's speech is in
 * flight. A failure puts the line back at the end and pauses the queue, longer each time in a row (30 s, 1 min, ...
 * up to 10 min), so a speech server that is down is asked once in a while, not 900 times.
 */
export class ClipQueue {
  private jobs = new Map<string, Want>();
  /** Lines being made now: a sync that runs meanwhile must not queue them again. */
  private inflight = new Set<string>();
  private running = 0;
  private fails = 0;
  private pausedUntil = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private waiters: Array<() => void> = [];
  made = 0;

  constructor(private make: (w: Want) => Promise<boolean>, private busy: () => boolean = () => false, private opts: { concurrency: number; waitMs: number; now: () => number } = { concurrency: 1, waitMs: 250, now: Date.now }) {}

  /** Queue lines not already queued. Returns how many were new. */
  add(wants: Want[]): number {
    let n = 0;
    for (const w of wants) if (!this.jobs.has(w.key) && !this.inflight.has(w.key)) { this.jobs.set(w.key, w); n++; }
    this.pump();
    return n;
  }

  get size(): number { return this.jobs.size + this.running; }

  /** Resolves when nothing is queued or running (tests). */
  idle(): Promise<void> { return this.size ? new Promise((r) => this.waiters.push(r)) : Promise.resolve(); }

  private later(ms: number): void {
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; this.pump(); }, ms);
    (this.timer as { unref?: () => void }).unref?.();
  }

  private pump(): void {
    const wait = this.pausedUntil - this.opts.now();
    if (wait > 0) return this.later(wait);
    while (this.running < this.opts.concurrency && this.jobs.size) {
      if (this.busy()) return this.later(this.opts.waitMs);
      const [key, w] = this.jobs.entries().next().value as [string, Want];
      this.jobs.delete(key);
      this.inflight.add(key);
      this.running++;
      void this.make(w).catch(() => false).then((ok) => {
        this.running--;
        this.inflight.delete(key);
        if (ok) { this.fails = 0; this.made++; }
        else {
          this.jobs.set(w.key, w);
          this.fails++;
          this.pausedUntil = this.opts.now() + Math.min(600_000, 30_000 * 2 ** (this.fails - 1));
        }
        if (!this.size) for (const r of this.waiters.splice(0)) r();
        this.pump();
      });
    }
  }
}

/** Ask the speech server for one line, whole. Null when it fails. */
export async function synth(w: Want, f: typeof fetch = fetch, env = process.env): Promise<{ pcm: Uint8Array; rate: number } | null> {
  const { base, stack, project } = ttsConfig(env);
  if (!base) return null;
  try {
    const res = await f(`${base}/tts`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-speech-project": project },
      body: JSON.stringify({ text: w.text, stack, lang: w.lang }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) return null;
    const pcm = new Uint8Array(await res.arrayBuffer());
    return pcm.length ? { pcm, rate: Number(res.headers.get("x-sample-rate")) || 24_000 } : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------------------------------------------------ */
/* The running server's clips                                                                                     */
/* ------------------------------------------------------------------------------------------------------------ */

let active: { store: ClipStore; queue: ClipQueue; notices: NoticeClips } | null = null;

const SYNC_EVERY_MS = 30_000;
const CLEAN_EVERY_MS = 3_600_000;
const FLUSH_EVERY_MS = 60_000;
const LOOKAHEAD_S = 8 * 86_400;

/** The subway's stations and tracks, as the phone loads them: the built copy, or the source in development. */
function loadSubway(): StaticSystem | null {
  for (const p of ["dist/transit/subway.json", "public/transit/subway.json"]) {
    if (existsSync(p)) try { return JSON.parse(readFileSync(p, "utf8")) as StaticSystem; } catch { /* try the next */ }
  }
  return null;
}

/**
 * Start making, serving and cleaning clips. Only when SPEECH_CACHE_DIR and a speech server are both set; otherwise
 * every clip is "not ready" and the phone speaks live, as before.
 */
export function startNoticeClips(loadAlerts: (from: number, to: number) => Promise<{ alerts: Notice[] }>, env = process.env, log: (m: string) => void = console.warn): void {
  const dir = clipDir(env);
  if (active || !dir || !ttsConfig(env).base) return;
  const voice = voiceTag(env);
  const store = new ClipStore(dir, clipDb(env), Date.now, log);
  const queue = new ClipQueue(async (w) => {
    const got = await synth(w, fetch, env);
    return got ? store.save(w, voice, got.pcm, got.rate) : false;
  }, liveSpeechBusy);
  let sys: StaticSystem | null | undefined;
  const notices = new NoticeClips(store, queue, () => (sys === undefined ? (sys = loadSubway()) : sys), voice);
  active = { store, queue, notices };
  let syncing = false;
  const poll = async () => {
    if (syncing) return;
    syncing = true;
    try {
      const now = Math.round(Date.now() / 1000);
      const alerts = await loadAlerts(now, now + LOOKAHEAD_S).then((r) => r.alerts).catch(() => null);
      const r = await notices.sync(alerts);
      if (r.changed || r.ended) log(`[clips] ${r.changed} notices new or changed, ${r.ended} ended, ${r.queued} lines queued; ${describe(store.stats())}`);
    } catch (e) {
      log(`[clips] sync failed: ${(e as Error).message}`);
    } finally {
      syncing = false;
    }
  };
  void store.load().then(() => {
    void poll();
    setInterval(() => void poll(), SYNC_EVERY_MS).unref();
    setInterval(() => void store.flush(), FLUSH_EVERY_MS).unref();
    setInterval(() => {
      if (!notices.synced) return;
      void store.clean().then((c) => { if (c.deleted) log(`[clips] deleted ${c.deleted} clips no notice uses and no one played for 7 days (${mb(c.bytes)}); ${describe(store.stats())}`); });
    }, CLEAN_EVERY_MS).unref();
  });
}

const mb = (n: number) => `${(n / 1_048_576).toFixed(1)} MB`;
const describe = (s: ClipStats) => `${s.clips} clips, ${mb(s.bytes)}, ${s.orphaned} unused, ${s.missing} to make`;

/** What /api/agent/health shows: the store's size and the queue. Null when clips are off. */
export function clipReport(): (ClipStats & { queued: number; made: number; voice: string }) | null {
  if (!active) return null;
  return { ...active.store.stats(), queued: active.queue.size, made: active.queue.made, voice: voiceTag() };
}

const IMMUTABLE = "public, max-age=31536000, immutable";

/** GET /api/tts/clip/<key>: the clip's sound, or 404 while it is not made (the phone then speaks live). */
export async function getClip(key: string, store: ClipStore | null = active?.store ?? null): Promise<Response> {
  if (!CLIP_RE.test(key)) return Response.json({ error: "key" }, { status: 400, headers: { "cache-control": "no-store" } });
  const got = await store?.read(key);
  if (!got) return Response.json({ error: "not ready" }, { status: 404, headers: { "cache-control": "no-store" } });
  return new Response(got.body, { headers: { "content-type": "audio/L16", "x-sample-rate": String(got.rate), "content-length": String(got.bytes), "cache-control": IMMUTABLE } });
}

/** GET /api/tts/voice: what the phone needs to name a clip. `langs` is empty when clips are off. */
export function getVoice(env = process.env): Response {
  return Response.json({ voice: voiceTag(env), langs: active ? clipLangs() : [] }, { headers: { "cache-control": "public, max-age=300" } });
}
