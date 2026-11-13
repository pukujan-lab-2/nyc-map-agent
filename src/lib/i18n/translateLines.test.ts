import { afterEach, describe, expect, it, vi } from "vitest";
import { translateLines } from "./translateLines";

const reply = (lines: string[]) => Promise.resolve(new Response(JSON.stringify({ lines }), { status: 200 }));

describe("translateLines", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("asks nothing for English", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect((await translateLines(["Walk to Fulton St"], "en")).size).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns each line's translation by its English text, asking for a line once", async () => {
    const fetch = vi.fn((_url: string, init: { body: string }) => reply((JSON.parse(init.body) as { lines: string[] }).lines.map((l) => `es:${l}`)));
    vi.stubGlobal("fetch", fetch);
    const got = await translateLines(["Walk to Fulton St", "Walk to Fulton St", " Use the N exit "], "es");
    expect(got.get("Walk to Fulton St")).toBe("es:Walk to Fulton St");
    expect(got.get("Use the N exit")).toBe("es:Use the N exit");
    expect(fetch).toHaveBeenCalledTimes(1);
    // Remembered: the same lines again ask nothing.
    await translateLines(["Walk to Fulton St"], "es");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("sends at most 24 lines a call", async () => {
    const fetch = vi.fn((_url: string, init: { body: string }) => reply((JSON.parse(init.body) as { lines: string[] }).lines.map((l) => `fr:${l}`)));
    vi.stubGlobal("fetch", fetch);
    const got = await translateLines(Array.from({ length: 30 }, (_, i) => `step ${i}`), "fr");
    expect(got.size).toBe(30);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("leaves lines out when the server fails, so they show as written", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("no", { status: 502 }))));
    expect((await translateLines(["Board the 4 train"], "ko")).size).toBe(0);
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    expect((await translateLines(["Board the 5 train"], "ko")).size).toBe(0);
  });
});

/** A Storage stand-in, since the tests run without a browser. */
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

describe("translations kept on the phone (#132)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("a reload with no server still has the lines translated before", async () => {
    const store = memoryStorage();
    vi.stubGlobal("localStorage", store);
    vi.stubGlobal("fetch", vi.fn((_url: string, init: { body: string }) => reply((JSON.parse(init.body) as { lines: string[] }).lines.map((l) => `zh:${l}`))));
    vi.resetModules();
    const first = await import("./translateLines");
    await first.translateLines(["Up the stairs to Nassau St"], "zh");
    expect(JSON.parse(store.getItem(first.KEPT_KEY) ?? "{}")).toEqual({ zh: { "Up the stairs to Nassau St": "zh:Up the stairs to Nassau St" } });

    // A fresh page, offline.
    const offline = vi.fn(() => Promise.reject(new Error("offline")));
    vi.stubGlobal("fetch", offline);
    vi.resetModules();
    const again = await import("./translateLines");
    const got = await again.translateLines(["Up the stairs to Nassau St"], "zh");
    expect(got.get("Up the stairs to Nassau St")).toBe("zh:Up the stairs to Nassau St");
    expect(offline).not.toHaveBeenCalled();
  });

  it("keeps each language's newest lines only", async () => {
    const store = memoryStorage();
    vi.stubGlobal("localStorage", store);
    vi.stubGlobal("fetch", vi.fn((_url: string, init: { body: string }) => reply((JSON.parse(init.body) as { lines: string[] }).lines.map((l) => `es:${l}`))));
    vi.resetModules();
    const mod = await import("./translateLines");
    const many = Array.from({ length: mod.KEPT_PER_LANG + 10 }, (_, i) => `line ${i}`);
    await mod.translateLines(many, "es");
    const es = (JSON.parse(store.getItem(mod.KEPT_KEY) ?? "{}") as Record<string, Record<string, string>>).es;
    expect(Object.keys(es)).toHaveLength(mod.KEPT_PER_LANG);
    expect(es["line 0"]).toBeUndefined();
    expect(es[`line ${many.length - 1}`]).toBe(`es:line ${many.length - 1}`);
  });

  it("works when storage is blocked", async () => {
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
    vi.stubGlobal("fetch", vi.fn(() => reply(["fr:Exit"])));
    vi.resetModules();
    const mod = await import("./translateLines");
    expect((await mod.translateLines(["Exit"], "fr")).get("Exit")).toBe("fr:Exit");
  });
});
