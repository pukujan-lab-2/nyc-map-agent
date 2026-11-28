import { useEffect, useMemo, useState } from "react";
import { clipKey, spokenText } from "./clipKey";

/**
 * Which pre-made clip says each step of a notice walk (server/features/agent/noticeClips.ts). The server names the
 * voice it makes clips with (GET /api/tts/voice); the phone keeps that answer so a walk it has heard before still
 * finds its clips with no signal, where the offline worker (public/sw.js) has kept them.
 */
interface VoiceInfo { voice: string; langs: string[] }

const KEY = "nma.voice.clips";
let asked: Promise<VoiceInfo | null> | null = null;

const valid = (v: unknown): v is VoiceInfo =>
  !!v && typeof (v as VoiceInfo).voice === "string" && Array.isArray((v as VoiceInfo).langs) && (v as VoiceInfo).langs.every((l) => typeof l === "string");

function saved(): VoiceInfo | null {
  try { const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null"); return valid(v) ? v : null; } catch { return null; }
}

/** The server's clip voice, asked once a visit; the last answer this phone saved when the server can't be reached. */
function voiceInfo(f: typeof fetch = fetch): Promise<VoiceInfo | null> {
  return (asked ??= (async () => {
    try {
      const base = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");
      const res = await f(`${base}/api/tts/voice`, { signal: AbortSignal.timeout(3000) });
      const v: unknown = res.ok ? await res.json() : null;
      if (!valid(v)) return saved();
      try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private window: this visit only */ }
      return v;
    } catch {
      return saved();
    }
  })());
}

/** Each line's clip key in `lang`, or null where the server makes no clips (another language, clips off). */
export async function stepClips(texts: string[], lang: string, info: VoiceInfo | null): Promise<Array<string | null>> {
  if (!info?.langs.includes(lang)) return texts.map(() => null);
  return Promise.all(texts.map((t) => clipKey(spokenText(t), lang, info.voice)));
}

/** `stepClips` for a component: `ready` once the keys are known (nulls when there are none). */
export function useStepClips(texts: string[], lang: string): { clips: Array<string | null>; ready: boolean } {
  const joined = texts.join("\u0000");
  const [got, setGot] = useState<{ for: string; clips: Array<string | null> } | null>(null);
  useEffect(() => {
    let alive = true;
    const lines = joined ? joined.split("\u0000") : [];
    void voiceInfo()
      .then((info) => stepClips(lines, lang, info))
      .catch(() => lines.map(() => null))
      .then((clips) => { if (alive) setGot({ for: `${lang}\u0001${joined}`, clips }); });
    return () => { alive = false; };
  }, [joined, lang]);
  const none = useMemo(() => (joined ? joined.split("\u0000") : []).map(() => null), [joined]);
  const ready = got?.for === `${lang}\u0001${joined}`;
  return { clips: ready ? got.clips : none, ready };
}
