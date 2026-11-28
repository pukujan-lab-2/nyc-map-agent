/**
 * The store for pre-made notice-walk speech (owner, 2026-11-27: make the audio when a notice arrives, save it,
 * serve it, and clean it up when it is no longer used or the notice changes). One clip is one spoken sentence,
 * named by `clipKey` (`src/lib/voice/clipKey.ts`), so a sentence two notices share is one file.
 *
 * Sound is a file in SPEECH_CACHE_DIR, `<key>.<sample rate>.pcm` (16-bit mono PCM, as the speech server sends it),
 * so serving a clip reads the folder alone and never waits on the database. `core.speech_clips` (migration
 * 20261127120000) keeps one row per clip: what it says, its size, when it was made and last played, and the
 * notices that use it. With no database the folder is the whole store; with no folder nothing is made.
 *
 * References: each live notice names the clips its walks use. A clip no notice names is an orphan; it is deleted
 * once it has also gone 7 days without being played, so a rider who opened the old notice a moment ago still hears it.
 */
import { createReadStream } from "node:fs";
import { mkdir, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { octoQuery } from "../../../api/_lib/octo";

/** An orphaned clip not played for this long is deleted (owner, 2026-11-27). */
export const ORPHAN_IDLE_MS = 7 * 24 * 3600 * 1000;
const FILE = /^([0-9a-f]{64})\.(\d{4,6})\.pcm$/;

/** The database as the store uses it; tests pass their own. */
export type Query = <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;

interface Clip { key: string; lang: string; text: string; file: string; bytes: number; rate: number; createdAt: number; lastUsedAt: number }
/** A line a notice wants spoken: its key, language and words. */
export interface Want { key: string; lang: string; text: string }

export interface ClipStats { clips: number; bytes: number; orphaned: number; missing: number; notices: number }

export const clipDir = (env = process.env): string => (env.SPEECH_CACHE_DIR ?? "").trim();
export const clipDb = (env = process.env): Query | null =>
  env.OCTO_API_KEY && env.OCTO_WORKSPACE_ID ? (sql, params) => octoQuery(sql, params, { rowLimit: 50_000 }) : null;

type Row = { key: string; lang: string; text: string; file: string; bytes: number | string; sample_rate: number | string; created_ms: number | string; used_ms: number | string };

export class ClipStore {
  readonly clips = new Map<string, Clip>();
  /** Notice id → the clips its walks use. */
  private byNotice = new Map<string, Set<string>>();
  /** Clip key → the notices that use it, and the words to make it from while it is missing. */
  private refs = new Map<string, { notices: Set<string>; want: Want }>();
  /** Rows whose notices or last-played time changed since the last write. */
  private dirty = new Set<string>();

  constructor(readonly dir: string, private db: Query | null = null, private now: () => number = Date.now, private log: (m: string) => void = console.warn) {}

  /** Read what was saved before a restart: rows from the database checked against the folder. Never throws. */
  async load(): Promise<void> {
    const files = new Map<string, { name: string; rate: number }>();
    for (const f of await readdir(this.dir).catch(() => [] as string[])) {
      const m = FILE.exec(f);
      if (m) files.set(m[1], { name: f, rate: Number(m[2]) });
    }
    if (this.db) {
      try {
        const { rows } = await this.db<Row>(
          `SELECT key, lang, text, file, bytes, sample_rate, (extract(epoch FROM created_at) * 1000)::float8 AS created_ms, (extract(epoch FROM last_used_at) * 1000)::float8 AS used_ms FROM core.speech_clips`,
        );
        const lost: string[] = [];
        for (const r of rows) {
          if (!files.has(r.key)) { lost.push(r.key); continue; }
          this.clips.set(r.key, { key: r.key, lang: r.lang, text: r.text, file: r.file, bytes: Number(r.bytes), rate: Number(r.sample_rate), createdAt: Number(r.created_ms), lastUsedAt: Number(r.used_ms) });
        }
        // A row whose file is gone (the folder was wiped) is a miss: drop it, the next sync makes it again.
        if (lost.length) await this.db(`DELETE FROM core.speech_clips WHERE key = ANY($1::text[])`, [lost]);
      } catch (e) {
        this.log(`[clips] could not read saved clips: ${(e as Error).message}`);
      }
    }
    // A file with no row (no database, or a row that failed to write): kept as an orphan, aged by its file time.
    for (const [key, f] of files) {
      if (this.clips.has(key)) continue;
      const s = await stat(join(this.dir, f.name)).catch(() => null);
      if (!s) continue;
      this.clips.set(key, { key, lang: "", text: "", file: f.name, bytes: s.size, rate: f.rate, createdAt: s.mtimeMs, lastUsedAt: s.mtimeMs });
    }
  }

  has(key: string): boolean { return this.clips.has(key); }

  /** A clip's sound to send, or null when it is not made yet. Counts as a play. */
  async read(key: string): Promise<{ body: ReadableStream<Uint8Array>; rate: number; bytes: number } | null> {
    const c = this.clips.get(key);
    if (!c) return null;
    const path = join(this.dir, c.file);
    if (!(await stat(path).catch(() => null))) { this.clips.delete(key); return null; }
    c.lastUsedAt = this.now();
    this.dirty.add(key);
    return { body: Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>, rate: c.rate, bytes: c.bytes };
  }

  /** Save a finished clip: the file written whole and renamed into place, then its row. Never throws. */
  async save(want: Want, voice: string, pcm: Uint8Array, rate: number): Promise<boolean> {
    if (!pcm.length) return false;
    const file = `${want.key}.${rate}.pcm`;
    try {
      await mkdir(this.dir, { recursive: true });
      const tmp = join(this.dir, `.${randomUUID()}.tmp`);
      await writeFile(tmp, pcm);
      await rename(tmp, join(this.dir, file));
    } catch (e) {
      this.log(`[clips] could not save a clip: ${(e as Error).message}`);
      return false;
    }
    const at = this.now();
    this.clips.set(want.key, { key: want.key, lang: want.lang, text: want.text, file, bytes: pcm.length, rate, createdAt: at, lastUsedAt: at });
    if (this.db) {
      try {
        await this.db(
          `INSERT INTO core.speech_clips (key, lang, voice, text, file, bytes, sample_rate, notice_ids)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text[])
           ON CONFLICT (key) DO UPDATE SET file = EXCLUDED.file, bytes = EXCLUDED.bytes, sample_rate = EXCLUDED.sample_rate, notice_ids = EXCLUDED.notice_ids, last_used_at = now()`,
          [want.key, want.lang, voice, want.text, file, pcm.length, rate, [...(this.refs.get(want.key)?.notices ?? [])]],
        );
      } catch (e) {
        this.log(`[clips] clip saved, row not written: ${(e as Error).message}`);
      }
    }
    return true;
  }

  /** The notices that use a clip, newest list. */
  noticesOf(key: string): string[] { return [...(this.refs.get(key)?.notices ?? [])].sort(); }

  /** Set the clips one notice's walks use. Clips it no longer names lose this notice; a clip no notice names is orphaned. */
  setNotice(id: string, wants: Want[]): void {
    const next = new Set(wants.map((w) => w.key));
    const before = this.byNotice.get(id) ?? new Set<string>();
    for (const key of before) if (!next.has(key)) this.unref(id, key);
    for (const w of wants) {
      const r = this.refs.get(w.key) ?? { notices: new Set<string>(), want: w };
      if (!r.notices.has(id)) { r.notices.add(id); this.dirty.add(w.key); }
      this.refs.set(w.key, r);
    }
    this.byNotice.set(id, next);
  }

  /** A notice left the feed: every clip it used loses it. */
  endNotice(id: string): void {
    for (const key of this.byNotice.get(id) ?? []) this.unref(id, key);
    this.byNotice.delete(id);
  }

  private unref(id: string, key: string): void {
    const r = this.refs.get(key);
    if (!r) return;
    r.notices.delete(id);
    if (!r.notices.size) this.refs.delete(key);
    this.dirty.add(key);
  }

  notices(): string[] { return [...this.byNotice.keys()]; }

  /** Lines a live notice wants that have no clip yet, for the queue. */
  missing(): Want[] {
    return [...this.refs.values()].filter((r) => !this.clips.has(r.want.key)).map((r) => r.want);
  }

  /** Clips no live notice uses. */
  orphans(): Clip[] { return [...this.clips.values()].filter((c) => !this.refs.has(c.key)); }

  /** Delete orphans not played for 7 days: files first, then rows. Returns what went. Never throws. */
  async clean(): Promise<{ deleted: number; bytes: number }> {
    const now = this.now();
    const gone = this.orphans().filter((c) => now - c.lastUsedAt > ORPHAN_IDLE_MS);
    for (const c of gone) {
      await rm(join(this.dir, c.file), { force: true }).catch(() => undefined);
      this.clips.delete(c.key);
      this.dirty.delete(c.key);
    }
    if (gone.length && this.db) {
      try { await this.db(`DELETE FROM core.speech_clips WHERE key = ANY($1::text[])`, [gone.map((c) => c.key)]); }
      catch (e) { this.log(`[clips] clips deleted, rows not removed: ${(e as Error).message}`); }
    }
    return { deleted: gone.length, bytes: gone.reduce((n, c) => n + c.bytes, 0) };
  }

  /** Write changed notice lists and play times to the rows, together. What fails is written next time. */
  async flush(): Promise<void> {
    if (!this.db || !this.dirty.size) { if (!this.db) this.dirty.clear(); return; }
    const batch = [...this.dirty].filter((k) => this.clips.has(k));
    this.dirty.clear();
    if (!batch.length) return;
    const rows = batch.map((k) => ({ key: k, ids: this.noticesOf(k), used: this.clips.get(k)!.lastUsedAt }));
    try {
      await this.db(
        `UPDATE core.speech_clips c SET notice_ids = ARRAY(SELECT jsonb_array_elements_text(v.ids)), last_used_at = to_timestamp(v.used / 1000.0)
         FROM jsonb_to_recordset($1::jsonb) AS v(key text, ids jsonb, used float8) WHERE c.key = v.key`,
        [JSON.stringify(rows)],
      );
    } catch {
      for (const k of batch) this.dirty.add(k);
    }
  }

  stats(): ClipStats {
    let bytes = 0;
    for (const c of this.clips.values()) bytes += c.bytes;
    return { clips: this.clips.size, bytes, orphaned: this.orphans().length, missing: this.missing().length, notices: this.byNotice.size };
  }
}
