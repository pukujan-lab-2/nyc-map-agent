import { useEffect, useState } from "react";
import type { AppLang } from "@/lib/voice/langPref";

const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");
const done = new Map<string, string[]>();
/** Lines in one translate call (server/features/agent/translate.ts takes at most 24). */
const PER_CALL = 24;

/**
 * A notice's lines in the rider's language (#55), translated by the agent's model on the server.
 * English, or a failed call, keeps the lines as they are; `ready` turns true either way, so the
 * walk never waits on it for long. The call is marked for the offline worker (public/sw.js), which
 * keeps the answer on the phone: after a reload, or with no signal, the same notice reads in the
 * rider's language at once (#218). `source` ("notice:<id>") lets the server keep it for every rider.
 */
export function useNoticeLines(lines: string[], lang: AppLang, source = "notice"): { lines: string[]; ready: boolean; failed: boolean } {
  const key = `${lang}\u0000${lines.join("\u0000")}`;
  const [state, setState] = useState<{ key: string; lines: string[]; failed: boolean } | null>(null);
  useEffect(() => {
    if (lang === "en" || !lines.length || done.has(key)) return;
    const ctl = new AbortController();
    // Long enough for a cold model, short enough that the rider still hears the notice soon.
    const timer = setTimeout(() => ctl.abort(), 8000);
    // The server takes 24 lines a call; a long elevator detour is more, so it goes in parts and comes back whole.
    const parts: string[][] = [];
    for (let i = 0; i < lines.length; i += PER_CALL) parts.push(lines.slice(i, i + PER_CALL));
    const one = (part: string[]) => fetch(`${API_BASE}/api/agent/translate`, { method: "POST", headers: { "content-type": "application/json", "x-keep": "1", "x-speech-source": source }, body: JSON.stringify({ lang, lines: part }), signal: ctl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ lines?: unknown }>) : Promise.reject(new Error(String(r.status)))))
      .then((b) => {
        if (!Array.isArray(b.lines) || b.lines.length !== part.length) throw new Error("shape");
        return b.lines as string[];
      });
    Promise.all(parts.map(one))
      .then((got) => {
        const all = got.flat();
        done.set(key, all);
        setState({ key, lines: all, failed: false });
      })
      .catch(() => setState({ key, lines, failed: true }))
      .finally(() => clearTimeout(timer));
    return () => { clearTimeout(timer); ctl.abort(); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (lang === "en" || !lines.length) return { lines, ready: true, failed: false };
  const cached = done.get(key);
  if (cached) return { lines: cached, ready: true, failed: false };
  if (state?.key === key) return { lines: state.lines, ready: true, failed: state.failed };
  return { lines, ready: false, failed: false };
}
