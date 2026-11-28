import { useEffect, useState } from "react";
import { clipKey, spokenText } from "./clipKey";

/**
 * Which pre-made clip says each step of a notice walk (server/features/agent/noticeClips.ts). The server names the
 * voice it makes clips with (GET /api/tts/voice); the phone keeps that answer so a walk it has heard before still
 * finds its clips with no signal, where the offline worker (public/sw.js) has kept them.
 */
interface VoiceInfo { voice: string; langs: string[] }

const KEY = "nma.voice.clips";
let asked: Promise<VoiceInfo | null> | undefined;

const saved = (): VoiceInfo | null => { try { return JSON.parse(localStorage.getItem(KEY) ?? "null") as VoiceInfo | null; } catch { return null; } };

/** The server's clip voice, asked once a visit; the last answer this phone saved when the server can't be reached. */
const voiceInfo = (): Promise<VoiceInfo | null> =>
  (asked ??= fetch(`${(import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "")}/api/tts/voice`, { signal: AbortSignal.timeout(3000) })
    .then((r) => r.json() as Promise<VoiceInfo>)
    .then((v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private window */ } return v; })
    .catch(saved));

/** Each line's clip key in `lang`, or null where the server makes no clips (another language, clips off). */
export async function stepClips(texts: string[], lang: string, info: VoiceInfo | null): Promise<Array<string | null>> {
  if (!info?.langs.includes(lang)) return texts.map(() => null);
  return Promise.all(texts.map((t) => clipKey(spokenText(t), lang, info.voice)));
}

const NONE: Array<string | null> = [];

/** `stepClips` for a component: `ready` once the keys are known (none when there are none). */
export function useStepClips(texts: string[], lang: string): { clips: Array<string | null>; ready: boolean } {
  const id = [lang, ...texts].join("\u0000");
  const [got, setGot] = useState<[string, Array<string | null>]>();
  useEffect(() => {
    let alive = true;
    const [l, ...lines] = id.split("\u0000");
    void voiceInfo().then((v) => stepClips(lines, l, v)).catch(() => NONE).then((c) => { if (alive) setGot([id, c]); });
    return () => { alive = false; };
  }, [id]);
  const ready = got?.[0] === id;
  return { clips: ready ? got[1] : NONE, ready };
}
