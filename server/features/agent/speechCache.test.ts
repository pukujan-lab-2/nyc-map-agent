import { mkdtemp, readdir, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GONE_MS, IDLE_MS, parseSource, planPrune, pruneOnce, readAudio, saveAudio, translationKey, ttsKey, type Entry, type Query } from "./speechCache";

const DAY = 24 * 3600 * 1000;
const NOW = Date.parse("2026-11-15T12:00:00Z");
const entry = (over: Partial<Entry>): Entry => ({ key: "k", sourceKind: "notice", sourceId: "n1", lastUsedAt: NOW - DAY, goneAt: null, bytes: 150_000, ...over });

describe("speech cache keys and sources", () => {
  it("keeps only lines the page names a source for", () => {
    expect(parseSource("notice:lmm:planned_work:36589")).toEqual({ kind: "notice", id: "lmm:planned_work:36589" });
    expect(parseSource("notice")).toEqual({ kind: "notice", id: null });
    expect(parseSource("trip_step")).toEqual({ kind: "trip_step", id: null });
    // A chat answer names none, and anything else is not a source.
    expect(parseSource(null)).toBeNull();
    expect(parseSource("chat")).toBeNull();
  });

  it("gives a new key for another text, language, voice or model version", () => {
    const k = ttsKey("Why: Technical issue.", "en", "multilingual", "kokoro-1");
    expect(k).toMatch(/^[0-9a-f]{64}$/);
    expect(ttsKey("Why: Technical issue.", "en", "multilingual", "kokoro-1")).toBe(k);
    for (const other of [ttsKey("Why: Repair.", "en", "multilingual", "kokoro-1"), ttsKey("Why: Technical issue.", "es", "multilingual", "kokoro-1"), ttsKey("Why: Technical issue.", "en", "english", "kokoro-1"), ttsKey("Why: Technical issue.", "en", "multilingual", "kokoro-2")]) expect(other).not.toBe(k);
    expect(translationKey(["a", "b"], "es", "smart:t1")).not.toBe(translationKey(["a", "b"], "fr", "smart:t1"));
    expect(translationKey(["a", "b"], "es", "smart:t1")).not.toBe(translationKey(["ab"], "es", "smart:t1"));
  });
});

describe("planPrune", () => {
  it("removes what nobody used for 14 days", () => {
    const plan = planPrune([entry({ key: "old", lastUsedAt: NOW - IDLE_MS - 1 }), entry({ key: "fresh", lastUsedAt: NOW - IDLE_MS + DAY })], NOW, new Set(["n1"]));
    expect(plan.remove).toEqual(["old"]);
    expect(plan.reasons).toEqual({ idle: 1, withdrawn: 0, size: 0 });
  });

  it("marks a notice's entries when it leaves the feed and removes them a day later", () => {
    const live = new Set(["n1"]);
    const plan = planPrune([
      entry({ key: "still", sourceId: "n1" }),
      entry({ key: "just-left", sourceId: "n2" }),
      entry({ key: "left-an-hour-ago", sourceId: "n3", goneAt: NOW - 3_600_000 }),
      entry({ key: "left-yesterday", sourceId: "n4", goneAt: NOW - GONE_MS - 1 }),
      entry({ key: "came-back", sourceId: "n1", goneAt: NOW - 3_600_000 }),
      entry({ key: "trip", sourceKind: "trip_step", sourceId: null }),
      entry({ key: "outage", sourceId: null }),
    ], NOW, live);
    expect(plan.markGone).toEqual(["just-left"]);
    expect(plan.back).toEqual(["came-back"]);
    expect(plan.remove).toEqual(["left-yesterday"]);
    expect(plan.reasons.withdrawn).toBe(1);
  });

  it("leaves withdrawn notices alone when the feed could not be read", () => {
    const plan = planPrune([entry({ key: "a", sourceId: "n9", goneAt: NOW - 3 * DAY })], NOW, null);
    expect(plan).toMatchObject({ remove: [], markGone: [], back: [] });
  });

  it("then removes the least recently used until the sound fits the cap", () => {
    const plan = planPrune([
      entry({ key: "newest", lastUsedAt: NOW - 1000, bytes: 400 }),
      entry({ key: "oldest", lastUsedAt: NOW - 5 * DAY, bytes: 400 }),
      entry({ key: "middle", lastUsedAt: NOW - 2 * DAY, bytes: 400 }),
    ], NOW, new Set(["n1"]), 900);
    expect(plan.remove).toEqual(["oldest"]);
    expect(plan.reasons.size).toBe(1);
  });
});

describe("the cache folder", () => {
  const meta = (key: string) => ({ key, text: "Why: Technical issue.", lang: "en", voice: "multilingual", modelVersion: "kokoro-1", source: { kind: "notice" as const, id: "n1" } });
  const read = async (s: ReadableStream<Uint8Array>) => new Uint8Array(await new Response(s).arrayBuffer());

  it("saves a sound as a file and plays it back with its sample rate; no folder means no cache", async () => {
    const dir = await mkdtemp(join(tmpdir(), "speech-cache-"));
    const env = { SPEECH_CACHE_DIR: dir } as unknown as NodeJS.ProcessEnv;
    const key = ttsKey("Why: Technical issue.", "en", "multilingual", "kokoro-1");
    expect(await readAudio(key, env)).toBeNull();
    await saveAudio(meta(key), new Uint8Array([1, 2, 3, 4]), 24000, env);
    expect(await readdir(dir)).toEqual([`${key}.24000.pcm`]);
    const hit = (await readAudio(key, env))!;
    expect(hit.rate).toBe(24000);
    expect([...(await read(hit.body))]).toEqual([1, 2, 3, 4]);
    expect(await readAudio(key, {} as NodeJS.ProcessEnv)).toBeNull();
    // The folder can be deleted at any time: the next read is a miss.
    await rm(dir, { recursive: true });
    expect(await readAudio(key, env)).toBeNull();
  });

  it("with no database, prunes files by their own age and logs what it did", async () => {
    const dir = await mkdtemp(join(tmpdir(), "speech-cache-"));
    const env = { SPEECH_CACHE_DIR: dir } as unknown as NodeJS.ProcessEnv;
    const fresh = "a".repeat(64), old = "b".repeat(64);
    await writeFile(join(dir, `${fresh}.24000.pcm`), new Uint8Array(8));
    await writeFile(join(dir, `${old}.24000.pcm`), new Uint8Array(8));
    await writeFile(join(dir, "notes.txt"), "not ours");
    const then = new Date(Date.now() - IDLE_MS - DAY);
    await utimes(join(dir, `${old}.24000.pcm`), then, then);
    const lines: string[] = [];
    const line = await pruneOnce(() => Promise.resolve(null), env, (m) => lines.push(m));
    expect(line).toBe("[speech-cache] prune (no database): sounds 1 kept, 1 removed (idle 1, size 0)");
    expect(lines).toEqual([line]);
    // Only our own files are touched.
    expect((await readdir(dir)).sort()).toEqual([`${fresh}.24000.pcm`, "notes.txt"]);
    expect(await readFile(join(dir, "notes.txt"), "utf8")).toBe("not ours");
    await rm(dir, { recursive: true });
  });

  // The database branch deletes files, so it is tested against rows as the database returns them.
  it("with a database, removes what the rules say, rows with no file and files with no row, and nothing else", async () => {
    const dir = await mkdtemp(join(tmpdir(), "speech-cache-"));
    const env = { SPEECH_CACHE_DIR: dir } as unknown as NodeJS.ProcessEnv;
    const k = (c: string) => c.repeat(64);
    for (const c of ["a", "b", "c", "e"]) await writeFile(join(dir, `${k(c)}.24000.pcm`), new Uint8Array(8));
    const now = Date.parse("2026-11-15T12:00:00Z");
    const row = (c: string, over: object = {}) => ({ key: k(c), source_kind: "notice", source_id: "n1", bytes: 8, used_ms: now - DAY, gone_ms: null, ...over });
    const ran: Array<{ sql: string; params?: unknown[] }> = [];
    const query = ((sql: string, params?: unknown[]) => {
      ran.push({ sql, params });
      if (/^SELECT .* FROM core\.tts_cache/.test(sql)) return Promise.resolve({ rows: [row("a"), row("b", { used_ms: now - IDLE_MS - DAY }), row("c", { source_id: "n2", gone_ms: now - GONE_MS - 1000 }), row("d")] });
      if (/^SELECT .* FROM core\.translation_cache/.test(sql)) return Promise.resolve({ rows: [row("t", { used_ms: String(now - IDLE_MS - DAY) })] });
      return Promise.resolve({ rows: [] });
    }) as Query;
    const line = await pruneOnce(() => Promise.resolve(new Set(["n1"])), env, () => undefined, now, query);
    expect(line).toBe("[speech-cache] prune: sounds 1 kept, 2 removed (idle 1, withdrawn 1, size 0), 1 rows without a file, 1 files without a row; translations 1 removed (idle 1, withdrawn 0)");
    // Kept: the fresh one. Gone: the idle one, the withdrawn one, and the file no row knows.
    expect(await readdir(dir)).toEqual([`${k("a")}.24000.pcm`]);
    const deleted = ran.filter((r) => /^DELETE FROM core\.tts_cache/.test(r.sql)).flatMap((r) => r.params![0] as string[]);
    expect(deleted.sort()).toEqual([k("b"), k("c"), k("d")]);
    expect(ran.find((r) => /^DELETE FROM core\.translation_cache/.test(r.sql))!.params).toEqual([[k("t")]]);
    await rm(dir, { recursive: true });
  });

  it("deletes nothing when the database's answer cannot be read", async () => {
    const dir = await mkdtemp(join(tmpdir(), "speech-cache-"));
    const env = { SPEECH_CACHE_DIR: dir } as unknown as NodeJS.ProcessEnv;
    await writeFile(join(dir, `${"a".repeat(64)}.24000.pcm`), new Uint8Array(8));
    const ran: string[] = [];
    const query = ((sql: string) => { ran.push(sql); return Promise.resolve({ rows: /tts_cache/.test(sql) ? [{ key: "a".repeat(64), source_kind: "notice", source_id: "n1", bytes: 8 }] : [] }); }) as Query;
    const line = await pruneOnce(() => Promise.resolve(new Set(["n1"])), env, () => undefined, Date.now(), query);
    expect(line).toBe("[speech-cache] prune failed: a row's last_used_at could not be read");
    expect(await readdir(dir)).toHaveLength(1);
    expect(ran.some((x) => /^(DELETE|UPDATE)/.test(x))).toBe(false);
    await rm(dir, { recursive: true });
  });
});
