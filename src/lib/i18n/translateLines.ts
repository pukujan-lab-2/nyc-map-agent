import type { AppLang } from "@/lib/voice/langPref";

const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");
/** The server takes this many lines a call. */
const BATCH = 24;
const MAX_LINE = 400;
const done = new Map<string, string>();

/**
 * Translations are kept on the phone too (#132), so a station walk replayed underground, or after
 * a reload with no signal, still reads in the rider's language. Only the app's own step lines go
 * through here (station and street names, turns), nothing the rider typed. Versioned key; each
 * language keeps its newest lines.
 */
export const KEPT_KEY = "nyc-map:translations-v1";
export const KEPT_PER_LANG = 1500;
type Kept = Record<string, Record<string, string>>;
let kept: Kept | null = null;

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function keptLines(): Kept {
  if (kept) return kept;
  kept = {};
  try {
    const raw = storage()?.getItem(KEPT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object") kept = parsed as Kept;
  } catch {
    /* unreadable: start again */
  }
  for (const [lang, lines] of Object.entries(kept)) {
    for (const [l, t] of Object.entries(lines ?? {})) if (typeof t === "string") done.set(`${lang}\u0000${l}`, t);
  }
  return kept;
}

function keepLines(lang: string, got: Array<[string, string]>): void {
  const all = keptLines();
  const mine = { ...(all[lang] ?? {}) };
  for (const [l, t] of got) {
    delete mine[l]; // re-added last, so the newest stay when the list is trimmed
    mine[l] = t;
  }
  const keys = Object.keys(mine);
  for (const k of keys.slice(0, Math.max(0, keys.length - KEPT_PER_LANG))) delete mine[k];
  all[lang] = mine;
  try {
    storage()?.setItem(KEPT_KEY, JSON.stringify(all));
  } catch {
    /* full or blocked: they stay for this page's life */
  }
}

/**
 * Short lines in the rider's language, by the agent's model on the server (POST /api/agent/translate,
 * which keeps station, street and line names as written). Returns each line's translation by its
 * English text; a line that could not be translated is left out, so the caller shows it as it is.
 * English asks nothing. Answers are remembered on the phone, so lines seen once need no server.
 */
export async function translateLines(lines: string[], lang: AppLang, signal?: AbortSignal): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (lang === "en") return out;
  const want = [...new Set(lines.map((l) => l.trim()).filter((l) => l && l.length <= MAX_LINE))];
  const ask: string[] = [];
  keptLines();
  for (const l of want) {
    const hit = done.get(`${lang}\u0000${l}`);
    if (hit) out.set(l, hit);
    else ask.push(l);
  }
  for (let i = 0; i < ask.length; i += BATCH) {
    const batch = ask.slice(i, i + BATCH);
    try {
      const r = await fetch(`${API_BASE}/api/agent/translate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lang, lines: batch }), signal });
      if (!r.ok) continue;
      const b = (await r.json()) as { lines?: unknown };
      if (!Array.isArray(b.lines) || b.lines.length !== batch.length) continue;
      const got: Array<[string, string]> = [];
      batch.forEach((l, k) => {
        const t = (b.lines as unknown[])[k];
        if (typeof t !== "string" || !t.trim()) return;
        done.set(`${lang}\u0000${l}`, t);
        out.set(l, t);
        got.push([l, t]);
      });
      if (got.length) keepLines(lang, got);
    } catch {
      // Offline, slow or cut short: those lines stay in English.
    }
  }
  return out;
}
