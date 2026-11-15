import { mkdtemp, readdir, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GONE_MS, IDLE_MS, parseSource, planPrune, pruneOnce, readAudio, saveAudio, translationKey, ttsKey, type Entry } from "./speechCache";

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
});
