/**
 * Notice-walk clips made ahead. Every test here is silent: the "speech server" is a function that returns bytes
 * derived from the words, and the checks read those bytes back from files and responses. Nothing is played.
 */
import { mkdtemp, readdir, readFile, rm, utimes } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { slimAlert, type MercuryAlert, type SlimAlert } from "../transit/alerts";
import { noticeWalk } from "../../../src/features/transit/noticeWalk";
import type { StaticSystem } from "../../../src/features/transit/model";
import { clipKey } from "../../../src/lib/voice/clipKey";
import { stepClips } from "../../../src/lib/voice/clips";
import { ClipStore, ORPHAN_IDLE_MS, type Query, type Want } from "./clipStore";
import { ClipQueue, NoticeClips, getClip, synth, walkLines } from "./noticeClips";

const VOICE = "multilingual:kokoro-1";
/** Fake speech: the words' bytes as 16-bit samples, so a file can be checked against what it says. */
const pcmOf = (text: string) => { const b = new TextEncoder().encode(text); const out = new Uint8Array(b.length * 2); b.forEach((x, i) => { out[i * 2] = x; }); return out; };
const sayOf = (pcm: Uint8Array) => new TextDecoder().decode(pcm.filter((_, i) => i % 2 === 0));

const alert = (id: string): SlimAlert => ({ id, routes: ["7"] } as unknown as SlimAlert);
const SYS = {} as StaticSystem;

let dir: string;
let now: number;
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), "clips-")); now = Date.parse("2026-11-27T12:00:00Z"); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

/** A store, a queue that "speaks" instantly, and a sync whose walks say what `lines` lists per notice id. */
function rig(lines: Record<string, string[]>, opts: { db?: Query | null } = {}) {
  const store = new ClipStore(dir, opts.db ?? null, () => now, () => undefined);
  const spoken: string[] = [];
  const queue = new ClipQueue(async (w) => { spoken.push(w.text); return store.save(w, VOICE, pcmOf(w.text), 24_000); }, () => false, { concurrency: 1, waitMs: 1, now: () => now });
  const sync = new NoticeClips(store, queue, () => SYS, VOICE, ["en"], (a) => lines[a.id] ?? []);
  return { store, queue, sync, spoken };
}
const key = (text: string) => clipKey(text, "en", VOICE);

describe("making clips when a notice arrives", () => {
  it("makes one clip per sentence and stores the speech server's bytes as they came", async () => {
    const r = rig({ a: ["Take the 7.", "Stay on to 61 Street-Woodside."] });
    const res = await r.sync.sync([alert("a")]);
    expect(res).toEqual({ changed: 1, ended: 0, queued: 2 });
    await r.queue.idle();
    const files = (await readdir(dir)).sort();
    expect(files).toEqual([`${await key("Stay on to 61 Street-Woodside.")}.24000.pcm`, `${await key("Take the 7.")}.24000.pcm`].sort());
    expect(sayOf(new Uint8Array(await readFile(join(dir, `${await key("Take the 7.")}.24000.pcm`))))).toBe("Take the 7.");
    expect(r.store.noticesOf(await key("Take the 7."))).toEqual(["a"]);
  });

  it("stores a sentence two notices share once, used by both", async () => {
    const r = rig({ a: ["Take the 7.", "Trains skip 46 Street."], b: ["Take the 7.", "Trains skip 52 Street."] });
    await r.sync.sync([alert("a"), alert("b")]);
    await r.queue.idle();
    expect(r.spoken.filter((t) => t === "Take the 7.")).toHaveLength(1);
    expect(r.store.stats()).toMatchObject({ clips: 3, orphaned: 0, missing: 0, notices: 2 });
    expect(r.store.noticesOf(await key("Take the 7."))).toEqual(["a", "b"]);
  });

  it("a changed notice makes its new sentences and orphans the old ones; an unchanged one costs nothing", async () => {
    const lines: Record<string, string[]> = { a: ["Take the 7.", "Trains skip 46 Street."] };
    const r = rig(lines);
    const before = { id: "a", routes: ["7"], text: "skip 46 St" } as unknown as SlimAlert;
    await r.sync.sync([before]);
    await r.queue.idle();
    expect(await r.sync.sync([before])).toEqual({ changed: 0, ended: 0, queued: 0 });
    lines.a = ["Take the 7.", "Trains skip 52 Street."];
    expect(await r.sync.sync([{ ...before, text: "skip 52 St" } as SlimAlert])).toMatchObject({ changed: 1, queued: 1 });
    await r.queue.idle();
    expect(r.spoken).toEqual(["Take the 7.", "Trains skip 46 Street.", "Trains skip 52 Street."]);
    expect(r.store.orphans().map((c) => c.text)).toEqual(["Trains skip 46 Street."]);
    expect(r.store.noticesOf(await key("Take the 7."))).toEqual(["a"]);
  });

  it("a notice that leaves the feed lets go of its clips, but an unread feed ends nothing", async () => {
    const r = rig({ a: ["Take the 7."], b: ["Take the 7.", "Use the E."] });
    await r.sync.sync([alert("a"), alert("b")]);
    await r.queue.idle();
    expect(await r.sync.sync(null)).toEqual({ changed: 0, ended: 0, queued: 0 });
    expect(await r.sync.sync([])).toEqual({ changed: 0, ended: 0, queued: 0 });
    expect(r.store.orphans()).toEqual([]);
    expect(await r.sync.sync([alert("a")])).toMatchObject({ ended: 1 });
    expect(r.store.orphans().map((c) => c.text)).toEqual(["Use the E."]);
    expect(r.store.noticesOf(await key("Take the 7."))).toEqual(["a"]);
  });
});

describe("cleaning up", () => {
  it("deletes only clips no notice uses that no one has played for 7 days", async () => {
    const r = rig({ a: ["Old and unused.", "Still in use.", "Unused but played today."] });
    await r.sync.sync([alert("a")]);
    await r.queue.idle();
    r.store.setNotice("a", [{ key: await key("Still in use."), lang: "en", text: "Still in use." }]);
    now += ORPHAN_IDLE_MS + 60_000;
    expect(await r.store.read(await key("Unused but played today."))).not.toBeNull();
    const c = await r.store.clean();
    expect(c.deleted).toBe(1);
    expect(c.bytes).toBe(pcmOf("Old and unused.").length);
    expect(r.store.has(await key("Old and unused."))).toBe(false);
    expect(r.store.has(await key("Still in use."))).toBe(true);
    expect(r.store.has(await key("Unused but played today."))).toBe(true);
    expect((await readdir(dir)).length).toBe(2);
    // A clip still used is kept however long it goes unplayed.
    now += 10 * ORPHAN_IDLE_MS;
    expect((await r.store.clean()).deleted).toBe(1);
    expect([...r.store.clips.values()].map((x) => x.text)).toEqual(["Still in use."]);
  });

  it("writes rows to the database and removes the rows of deleted clips", async () => {
    const calls: Array<{ sql: string; params?: unknown[] }> = [];
    const db: Query = <T,>(sql: string, params?: unknown[]) => { calls.push({ sql, params }); return Promise.resolve({ rows: [] as T[] }); };
    const r = rig({ a: ["Take the 7."] }, { db });
    await r.sync.sync([alert("a")]);
    await r.queue.idle();
    const insert = calls.find((c) => c.sql.includes("INSERT INTO core.speech_clips"));
    expect(insert?.params).toEqual([await key("Take the 7."), "en", VOICE, "Take the 7.", `${await key("Take the 7.")}.24000.pcm`, 22, 24_000, ["a"]]);
    await r.sync.sync([alert("b")]);
    await r.store.flush();
    const upd = calls.find((c) => c.sql.includes("UPDATE core.speech_clips"));
    expect(JSON.parse(String(upd?.params?.[0]))).toEqual([{ key: await key("Take the 7."), ids: [], used: now }]);
    now += ORPHAN_IDLE_MS + 1;
    await r.store.clean();
    const last = calls.at(-1)!;
    expect(last.sql).toContain("DELETE FROM core.speech_clips");
    expect(last.params).toEqual([[await key("Take the 7.")]]);
  });

  it("after a restart, keeps rows whose file is there and drops rows whose file is gone", async () => {
    const r = rig({ a: ["Kept.", "Lost."] });
    await r.sync.sync([alert("a")]);
    await r.queue.idle();
    await rm(join(dir, `${await key("Lost.")}.24000.pcm`));
    const rows = await Promise.all(["Kept.", "Lost."].map(async (t) => ({ key: await key(t), lang: "en", text: t, file: `${await key(t)}.24000.pcm`, bytes: 10, sample_rate: 24000, created_ms: now, used_ms: now })));
    const deleted: unknown[] = [];
    const db: Query = <T,>(sql: string, params?: unknown[]) => { if (sql.startsWith("DELETE")) deleted.push(params?.[0]); return Promise.resolve({ rows: (sql.startsWith("SELECT") ? rows : []) as T[] }); };
    const again = new ClipStore(dir, db, () => now, () => undefined);
    await again.load();
    expect([...again.clips.keys()]).toEqual([await key("Kept.")]);
    expect(deleted).toEqual([[await key("Lost.")]]);
  });
});

describe("the queue", () => {
  const want = (t: string): Want => ({ key: t, lang: "en", text: t });

  it("waits while a rider's speech is in flight, then makes the line", async () => {
    let busy = true;
    const made: string[] = [];
    const q = new ClipQueue((w) => { made.push(w.text); return Promise.resolve(true); }, () => busy, { concurrency: 1, waitMs: 5, now: Date.now });
    q.add([want("one")]);
    await new Promise((r) => setTimeout(r, 30));
    expect(made).toEqual([]);
    busy = false;
    await q.idle();
    expect(made).toEqual(["one"]);
  });

  it("does not queue a line again while it is being made", async () => {
    let finish: (ok: boolean) => void = () => undefined;
    const made: string[] = [];
    const q = new ClipQueue((w) => { made.push(w.text); return new Promise<boolean>((r) => { finish = r; }); }, () => false, { concurrency: 1, waitMs: 1, now: Date.now });
    q.add([want("one")]);
    await new Promise((r) => setTimeout(r, 5));
    expect(q.add([want("one")])).toBe(0);
    finish(true);
    await q.idle();
    expect(made).toEqual(["one"]);
  });

  it("pauses after a failure instead of asking a dead speech server for every line", async () => {
    const t = 0;
    const tried: string[] = [];
    const q = new ClipQueue((w) => { tried.push(w.text); return Promise.resolve(false); }, () => false, { concurrency: 1, waitMs: 1, now: () => t });
    q.add([want("one"), want("two"), want("three")]);
    await new Promise((r) => setTimeout(r, 20));
    expect(tried).toEqual(["one"]);
    expect(q.size).toBe(3);
    expect(q.add([want("two")])).toBe(0);
  });

  it("asks the speech server for the whole line, with the app's stack and project", async () => {
    const f = vi.fn(() => Promise.resolve(new Response(pcmOf("Take the 7."), { headers: { "x-sample-rate": "22050" } })));
    const got = await synth(want("Take the 7."), f as unknown as typeof fetch, { STT_PROTOCOL: "speech", STT_BASE_URL: "http://gateway.test" } as unknown as NodeJS.ProcessEnv);
    expect(got?.rate).toBe(22_050);
    expect(sayOf(got!.pcm)).toBe("Take the 7.");
    const [url, init] = (f.mock.calls[0] as unknown as [string, RequestInit]);
    expect(url).toBe("http://gateway.test/tts");
    expect(JSON.parse(init.body as string)).toEqual({ text: "Take the 7.", stack: "multilingual", lang: "en" });
    expect(await synth(want("x"), (() => Promise.resolve(new Response("", { status: 503 }))) as unknown as typeof fetch, { STT_PROTOCOL: "speech", STT_BASE_URL: "http://gateway.test" } as unknown as NodeJS.ProcessEnv)).toBeNull();
  });
});

describe("GET /api/tts/clip/<key>", () => {
  it("serves a made clip as audio with immutable cache headers, and 404s one not made yet", async () => {
    const r = rig({ a: ["Take the 7."] });
    await r.sync.sync([alert("a")]);
    await r.queue.idle();
    const k = await key("Take the 7.");
    const res = await getClip(k, r.store);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/L16");
    expect(res.headers.get("x-sample-rate")).toBe("24000");
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(sayOf(new Uint8Array(await res.arrayBuffer()))).toBe("Take the 7.");
    const miss = await getClip("b".repeat(64), r.store);
    expect(miss.status).toBe(404);
    expect(miss.headers.get("cache-control")).toBe("no-store");
    expect((await getClip("../etc/passwd", r.store)).status).toBe(400);
    expect((await getClip(k, null)).status).toBe(404);
  });

  it("a clip whose file was removed is not ready, not an error", async () => {
    const r = rig({ a: ["Take the 7."] });
    await r.sync.sync([alert("a")]);
    await r.queue.idle();
    const k = await key("Take the 7.");
    await rm(join(dir, `${k}.24000.pcm`));
    expect((await getClip(k, r.store)).status).toBe(404);
    expect(r.store.has(k)).toBe(false);
  });

  it("an old file with no row is kept as unused and aged by its file time", async () => {
    const r = rig({ a: ["Take the 7."] });
    await r.sync.sync([alert("a")]);
    await r.queue.idle();
    const k = await key("Take the 7.");
    const old = new Date(now - ORPHAN_IDLE_MS - 1000);
    await utimes(join(dir, `${k}.24000.pcm`), old, old);
    const again = new ClipStore(dir, null, () => now, () => undefined);
    await again.load();
    expect(again.orphans().map((c) => c.key)).toEqual([k]);
    expect((await again.clean()).deleted).toBe(1);
  });
});

describe("the real walks", () => {
  const feed = JSON.parse(readFileSync("server/features/transit/__fixtures__/subway-alerts-2026-11-27.json", "utf8")) as { header?: { timestamp?: number }; entity?: MercuryAlert[] };
  const sys = JSON.parse(readFileSync("public/transit/subway.json", "utf8")) as StaticSystem;
  const at = Number(feed.header?.timestamp);
  const alerts = (feed.entity ?? []).flatMap((e) => slimAlert(e, at, at + 8 * 86_400) ?? []);
  // Every walk of every saved notice, built once: about 4 s here, longer on CI's shared runners.
  const lines = new Map<string, string[]>();
  beforeAll(() => { for (const a of alerts) lines.set(a.id, walkLines(a, sys, "en")); }, 60_000);

  it("the phone names each step of a walk with a key the server made", async () => {
    const a = alerts.find((x) => x.routes.includes("7") && noticeWalk(x as never, sys, "7", null).stops.length > 1)!;
    const server = new Set(await Promise.all(lines.get(a.id)!.map((t) => clipKey(t, "en", VOICE))));
    const w = noticeWalk(a as never, sys, "7", null);
    for (const trip of [null, { stop: w.stops[0], mode: "off" as const }, { stop: w.stops.at(-1)!, mode: "on" as const }]) {
      const steps = noticeWalk(a as never, sys, "7", trip).steps;
      const phone = await stepClips(steps.map((s) => s.say), "en", { voice: VOICE, langs: ["en"] });
      expect(phone.length).toBeGreaterThan(0);
      for (const k of phone) expect(server.has(k!)).toBe(true);
    }
  });

  it("lists every sentence a notice's walks can say, once each, and only in English for now", () => {
    const per = [...lines.values()];
    for (const lines of per) expect(new Set(lines).size).toBe(lines.length);
    expect(new Set(per.flat()).size).toBeGreaterThan(100);
    // English only until plan step 7 ships the other languages' sentences.
    expect(walkLines(alerts[0], sys, "es")).toEqual([]);
  });
});
