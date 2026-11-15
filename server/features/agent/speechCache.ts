/**
 * The server's store for spoken lines and translations (#218; owner, 2026-11-14: "that sounds like a
 * waste, caching would be cheaper right?"). A notice many riders open is spoken and translated once.
 *
 * Sound is a file in SPEECH_CACHE_DIR (16-bit mono PCM, named `<key>.<sample rate>.pcm`); the folder is
 * all a request needs, so a hit never waits on the database and the folder can be deleted at any time.
 * core.tts_cache and core.translation_cache (migration 20261115060000) are the index: what each entry
 * is, when it was last used and which notice it came from, so the hourly prune can drop what is old.
 * With no folder set nothing is stored and the routes work as before; with no database the files still
 * serve, and are pruned by their own age and size.
 *
 * Only lines the app names a source for are kept: a notice's steps and a trip's steps. An answer from
 * the chat read aloud is never stored.
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readdir, rename, rm, stat, utimes, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { octoQuery } from "../../../api/_lib/octo";

/** Entries not used for this long are removed (owner, 2026-11-14: "yea 14 sounds nice"). */
export const IDLE_MS = 14 * 24 * 3600 * 1000;
/** A withdrawn notice's entries go this long after it leaves the feed. */
export const GONE_MS = 24 * 3600 * 1000;
/** All stored sound together; a spoken step is about 150 KB, so about 2,000 steps. */
export const MAX_BYTES = 300 * 1024 * 1024;
const PRUNE_EVERY_MS = 3_600_000;
const FLUSH_EVERY_MS = 5 * 60_000;

export type SourceKind = "notice" | "trip_step";
export interface Source { kind: SourceKind; id: string | null }

/** "notice:lmm:planned_work:36589" or "trip_step" from the X-Speech-Source header; anything else is not kept. Pure. */
export function parseSource(header: string | null | undefined): Source | null {
  const m = /^(notice|trip_step)(?::(.{1,200}))?$/.exec((header ?? "").trim());
  return m ? { kind: m[1] as SourceKind, id: m[2] ?? null } : null;
}

const sha = (parts: string[]) => createHash("sha256").update(parts.join("\u0000")).digest("hex");
/** A new voice or model version never plays an old sound: both are in the key. Pure. */
export const ttsKey = (text: string, lang: string, voice: string, modelVersion: string) => sha(["tts", text, lang, voice, modelVersion]);
export const translationKey = (lines: string[], lang: string, model: string) => sha(["tr", lang, model, ...lines]);

export const cacheDir = (env = process.env) => (env.SPEECH_CACHE_DIR ?? "").trim();
const hasDb = (env = process.env) => Boolean(env.OCTO_API_KEY && env.OCTO_WORKSPACE_ID);
const FILE = /^([0-9a-f]{64})\.(\d{4,6})\.pcm$/;

/** Hits since the last flush, written to the tables together so a play costs no database call. */
const pending = { tts: new Map<string, number>(), tr: new Map<string, number>() };
const bump = (m: Map<string, number>, key: string) => m.set(key, (m.get(key) ?? 0) + 1);

/** The saved sound for a key: a stream and its sample rate, or null. A missing file is a miss. */
export async function readAudio(key: string, env = process.env): Promise<{ body: ReadableStream<Uint8Array>; rate: number; bytes: number } | null> {
  const dir = cacheDir(env);
  if (!dir) return null;
  try {
    const name = (await readdir(dir)).find((f) => f.startsWith(`${key}.`) && FILE.test(f));
    if (!name) return null;
    const path = join(dir, name);
    const info = await stat(path);
    // The file's own time says when it was last played, for pruning without the database.
    void utimes(path, new Date(), new Date()).catch(() => undefined);
    bump(pending.tts, key);
    return { body: Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>, rate: Number(FILE.exec(name)![2]), bytes: info.size };
  } catch {
    return null;
  }
}

export interface AudioMeta { key: string; text: string; lang: string; voice: string; modelVersion: string; source: Source }

/** Save a finished sound: the file first (written whole, then renamed), then its row. Never throws. */
export async function saveAudio(meta: AudioMeta, pcm: Uint8Array, rate: number, env = process.env, log: (m: string) => void = console.warn): Promise<void> {
  const dir = cacheDir(env);
  if (!dir || !pcm.length) return;
  const name = `${meta.key}.${rate}.pcm`;
  try {
    await mkdir(dir, { recursive: true });
    const tmp = join(dir, `.${randomUUID()}.tmp`);
    await writeFile(tmp, pcm);
    await rename(tmp, join(dir, name));
  } catch (e) {
    log(`[speech-cache] could not save a sound: ${(e as Error).message}`);
    return;
  }
  if (!hasDb(env)) return;
  try {
    await octoQuery(
      `INSERT INTO core.tts_cache (key, lang, voice, model_version, text, source_kind, source_id, file_path, bytes, sample_rate, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (key) DO UPDATE SET file_path = EXCLUDED.file_path, bytes = EXCLUDED.bytes, sample_rate = EXCLUDED.sample_rate, duration_ms = EXCLUDED.duration_ms, last_used_at = now(), gone_at = NULL`,
      [meta.key, meta.lang, meta.voice, meta.modelVersion, meta.text, meta.source.kind, meta.source.id, name, pcm.length, rate, Math.round((pcm.length / 2 / rate) * 1000)],
    );
  } catch (e) {
    log(`[speech-cache] sound saved, row not written: ${(e as Error).message}`);
  }
}

/** A saved translation, or null. One short query; a failure is a miss. */
export async function readTranslation(key: string, n: number, env = process.env): Promise<string[] | null> {
  if (!hasDb(env)) return null;
  try {
    const { rows } = await octoQuery<{ lines: unknown }>("SELECT lines FROM core.translation_cache WHERE key = $1", [key], { rowLimit: 1 });
    const raw = rows[0]?.lines;
    const lines: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(lines) || lines.length !== n || !lines.every((l) => typeof l === "string")) return null;
    bump(pending.tr, key);
    return lines as string[];
  } catch {
    return null;
  }
}

export async function saveTranslation(key: string, lang: string, model: string, sourceLines: string[], lines: string[], source: Source, env = process.env, log: (m: string) => void = console.warn): Promise<void> {
  if (!hasDb(env)) return;
  try {
    await octoQuery(
      `INSERT INTO core.translation_cache (key, lang, model, source_lines, lines, source_kind, source_id)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7)
       ON CONFLICT (key) DO UPDATE SET lines = EXCLUDED.lines, last_used_at = now(), gone_at = NULL`,
      [key, lang, model, JSON.stringify(sourceLines), JSON.stringify(lines), source.kind, source.id],
    );
  } catch (e) {
    log(`[speech-cache] translation not saved: ${(e as Error).message}`);
  }
}

/** Write the hits counted since the last flush. Never throws; what cannot be written is counted again next time. */
export async function flushHits(env = process.env): Promise<void> {
  if (!hasDb(env)) { pending.tts.clear(); pending.tr.clear(); return; }
  for (const [table, m] of [["core.tts_cache", pending.tts], ["core.translation_cache", pending.tr]] as const) {
    if (!m.size) continue;
    const batch = [...m];
    m.clear();
    try {
      await octoQuery(
        `UPDATE ${table} c SET last_used_at = now(), hits = c.hits + v.n, gone_at = NULL
         FROM (SELECT unnest($1::text[]) AS key, unnest($2::int[]) AS n) v WHERE c.key = v.key`,
        [batch.map(([k]) => k), batch.map(([, n]) => n)],
      );
    } catch {
      for (const [k, n] of batch) m.set(k, (m.get(k) ?? 0) + n);
    }
  }
}

export interface Entry { key: string; sourceKind: SourceKind; sourceId: string | null; lastUsedAt: number; goneAt: number | null; bytes: number }
export interface PrunePlan { remove: string[]; markGone: string[]; back: string[]; reasons: { idle: number; withdrawn: number; size: number } }

/**
 * What one prune run does, in the agreed order: entries idle 14 days go; a notice's entries go a day
 * after the notice left the feed; then the least recently used go until the rest fits `maxBytes`.
 * `liveNotices` is null when the feed could not be read: then nothing is marked or dropped as withdrawn.
 * Pure.
 */
export function planPrune(entries: Entry[], now: number, liveNotices: Set<string> | null, maxBytes = MAX_BYTES): PrunePlan {
  const plan: PrunePlan = { remove: [], markGone: [], back: [], reasons: { idle: 0, withdrawn: 0, size: 0 } };
  const keep: Entry[] = [];
  for (const e of entries) {
    if (now - e.lastUsedAt > IDLE_MS) { plan.remove.push(e.key); plan.reasons.idle++; continue; }
    if (liveNotices && e.sourceKind === "notice" && e.sourceId) {
      const live = liveNotices.has(e.sourceId);
      if (live && e.goneAt !== null) plan.back.push(e.key);
      if (!live && e.goneAt === null) plan.markGone.push(e.key);
      if (!live && e.goneAt !== null && now - e.goneAt > GONE_MS) { plan.remove.push(e.key); plan.reasons.withdrawn++; continue; }
    }
    keep.push(e);
  }
  let total = keep.reduce((n, e) => n + e.bytes, 0);
  for (const e of keep.sort((a, b) => a.lastUsedAt - b.lastUsedAt)) {
    if (total <= maxBytes) break;
    plan.remove.push(e.key);
    plan.reasons.size++;
    total -= e.bytes;
  }
  return plan;
}

type Row = { key: string; source_kind: SourceKind; source_id: string | null; last_used_at: string; gone_at: string | null; bytes?: number };
const toEntry = (r: Row): Entry => ({ key: r.key, sourceKind: r.source_kind, sourceId: r.source_id, lastUsedAt: Date.parse(r.last_used_at), goneAt: r.gone_at ? Date.parse(r.gone_at) : null, bytes: Number(r.bytes ?? 0) });

async function applyPlan(table: string, plan: PrunePlan): Promise<void> {
  if (plan.markGone.length) await octoQuery(`UPDATE ${table} SET gone_at = now() WHERE key = ANY($1::text[])`, [plan.markGone]);
  if (plan.back.length) await octoQuery(`UPDATE ${table} SET gone_at = NULL WHERE key = ANY($1::text[])`, [plan.back]);
  if (plan.remove.length) await octoQuery(`DELETE FROM ${table} WHERE key = ANY($1::text[])`, [plan.remove]);
}

/**
 * One prune run. Returns the log line it wrote. `liveNotices` gives the ids in the feed now, or null.
 * With a database: the plan above for both tables, then files with no row and rows with no file are
 * removed (the folder is safe to delete: its rows go here). Without one: files by their own age and size.
 */
export async function pruneOnce(liveNotices: () => Promise<Set<string> | null>, env = process.env, log: (m: string) => void = console.warn, now = Date.now()): Promise<string> {
  const dir = cacheDir(env);
  let line: string;
  try {
    await flushHits(env);
    const files = new Map<string, string>();
    if (dir) for (const f of await readdir(dir).catch(() => [] as string[])) { const m = FILE.exec(f); if (m) files.set(m[1], f); }
    const del = async (keys: string[]) => { for (const k of keys) { const f = files.get(k); if (f) await rm(join(dir, f), { force: true }); files.delete(k); } };
    if (hasDb(env)) {
      const live = await liveNotices().catch(() => null);
      const audio = (await octoQuery<Row>("SELECT key, source_kind, source_id, last_used_at, gone_at, bytes FROM core.tts_cache")).rows.map(toEntry);
      // A row whose file is gone is a miss already: drop the row.
      const lost = dir ? audio.filter((e) => !files.has(e.key)).map((e) => e.key) : [];
      const plan = planPrune(audio.filter((e) => !lost.includes(e.key)), now, live);
      await applyPlan("core.tts_cache", { ...plan, remove: [...plan.remove, ...lost] });
      await del(plan.remove);
      const known = new Set(audio.map((e) => e.key));
      const orphans = [...files.keys()].filter((k) => !known.has(k));
      await del(orphans);
      const tr = planPrune((await octoQuery<Row>("SELECT key, source_kind, source_id, last_used_at, gone_at FROM core.translation_cache")).rows.map(toEntry), now, live, Infinity);
      await applyPlan("core.translation_cache", tr);
      const left = audio.length - plan.remove.length - lost.length;
      line = `[speech-cache] prune: sounds ${left} kept, ${plan.remove.length} removed (idle ${plan.reasons.idle}, withdrawn ${plan.reasons.withdrawn}, size ${plan.reasons.size}), ${lost.length} rows without a file, ${orphans.length} files without a row; translations ${tr.remove.length} removed (idle ${tr.reasons.idle}, withdrawn ${tr.reasons.withdrawn})${live ? "" : "; feed not read, withdrawn notices left for the next run"}`;
    } else if (dir) {
      const entries: Entry[] = [];
      for (const [key, f] of files) { const s = await stat(join(dir, f)); entries.push({ key, sourceKind: "trip_step", sourceId: null, lastUsedAt: s.mtimeMs, goneAt: null, bytes: s.size }); }
      const plan = planPrune(entries, now, null);
      await del(plan.remove);
      line = `[speech-cache] prune (no database): sounds ${entries.length - plan.remove.length} kept, ${plan.remove.length} removed (idle ${plan.reasons.idle}, size ${plan.reasons.size})`;
    } else {
      line = "[speech-cache] prune: nothing to do, no cache folder and no database";
    }
  } catch (e) {
    line = `[speech-cache] prune failed: ${(e as Error).message}`;
  }
  log(line);
  return line;
}

let keeping = false;
/** Prune at start and every hour, and write counted hits every five minutes. Starts once, and only when there is something to keep. */
export function startSpeechCacheKeeper(liveNotices: () => Promise<Set<string> | null>, env = process.env): void {
  if (keeping || (!cacheDir(env) && !hasDb(env))) return;
  keeping = true;
  setTimeout(() => void pruneOnce(liveNotices, env), 60_000).unref();
  setInterval(() => void pruneOnce(liveNotices, env), PRUNE_EVERY_MS).unref();
  setInterval(() => void flushHits(env), FLUSH_EVERY_MS).unref();
}
