import type { LocalAudioTrack, Room } from "livekit-client";

/**
 * The hands-free live call (pilot, `?flags=+liveCall`, issue 299, docs/PLAN-livekit-hands-free.md). A LiveKit room where our
 * voice worker (voice-agent/, `nyc-map-voice`) hears the rider and speaks; this page decides what to say. Each line the worker
 * hears arrives as a `copilot.turn` call, goes to `answer` (the page's own /api/agent path, with the same tools and map actions as
 * a typed question), and the line it returns is what the worker says. Adapted from pull request 243's presenter client, which
 * came from design-bakery's frontend/src/app/modules/copilot/voice.ts.
 *
 * `livekit-client` is imported only when a call starts, so it stays out of the app's first load (its own size-limit entry).
 * When the call cannot start or drops, `onEnd` says so and the page goes back to one question at a time. Audio is heard,
 * answered and dropped, never stored.
 */

export type CallStatus = "idle" | "connecting" | "live";
export interface CallState { status: CallStatus; muted: boolean }
/** Why a call ended: the rider ended it, it never connected, it dropped, or the microphone is blocked. */
export type CallEnd = "ended" | "failed" | "dropped" | "blocked";
interface CallHandlers {
  /** The line to say back for a line the worker heard. */
  answer: (heard: string) => Promise<string>;
  onEnd: (why: CallEnd) => void;
}
interface Grant { url: string; token: string; room: string }

const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");
/** The worker loads its speech models before it joins; longer than this and the rider is better off with turns. */
const JOIN_MS = 20_000;
/** The worker waits 45 s for a reply (voice-agent/agent.py); answer before it gives up. */
const ANSWER_MS = 40_000;
export const SORRY = "Sorry, I couldn't check that just now. Try asking again.";

/** The words in a `copilot.turn` payload, or "" when there are none. Pure, for tests. */
export function heardText(payload: string | undefined): string {
  try {
    const p = JSON.parse(payload || "{}") as { text?: unknown };
    return typeof p.text === "string" ? p.text.trim().slice(0, 2000) : "";
  } catch {
    return "";
  }
}

/** The one line the rider sees when a call ends by itself, or null when they ended it. Pure, for tests. */
export function endLine(why: CallEnd): string | null {
  if (why === "failed") return "The live call didn't connect, so hands-free is taking one question at a time.";
  if (why === "dropped") return "The live call dropped, so hands-free is taking one question at a time.";
  if (why === "blocked") return "Microphone access is blocked. Type your question instead.";
  return null;
}

/** A room token from /api/voice/token, or null when live calls are not set up or the server refused. */
export async function fetchGrant(signal?: AbortSignal): Promise<Grant | null> {
  try {
    const r = await fetch(`${API_BASE}/api/voice/token`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ use: "map" }), signal });
    if (!r.ok) return null;
    const g = (await r.json()) as Partial<Grant>;
    return typeof g.url === "string" && typeof g.token === "string" && typeof g.room === "string" ? (g as Grant) : null;
  } catch {
    return null;
  }
}

/** An answer, or SORRY once it takes longer than the worker will wait. */
export async function answerWithin(answer: () => Promise<string>, ms = ANSWER_MS): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<string>((resolve) => { timer = setTimeout(() => resolve(SORRY), ms); });
  try {
    return (await Promise.race([answer().catch(() => SORRY), late])) || "";
  } finally {
    clearTimeout(timer);
  }
}

/** One call at a time. `start` opens it; `end` closes it; `mute` stops the worker hearing the rider without ending the call. */
export function createLiveCall(handlers: CallHandlers) {
  let state: CallState = { status: "idle", muted: false };
  const listeners = new Set<() => void>();
  const set = (patch: Partial<CallState>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };
  let room: Room | null = null;
  let mic: LocalAudioTrack | null = null;
  let run = 0;
  let joinTimer: ReturnType<typeof setTimeout> | undefined;
  let grantAbort: AbortController | null = null;
  const audio = new Set<HTMLMediaElement>();

  const close = (why: CallEnd) => {
    if (state.status === "idle") return;
    run += 1;
    clearTimeout(joinTimer);
    grantAbort?.abort();
    grantAbort = null;
    mic?.stop();
    mic = null;
    const r = room;
    room = null;
    if (r) void r.disconnect();
    for (const a of audio) a.remove();
    audio.clear();
    set({ status: "idle", muted: false });
    handlers.onEnd(why);
  };

  const start = async () => {
    if (state.status !== "idle") return;
    const mine = ++run;
    set({ status: "connecting", muted: false });
    const ctl = new AbortController();
    grantAbort = ctl;
    joinTimer = setTimeout(() => { if (run === mine && state.status === "connecting") close("failed"); }, JOIN_MS);
    try {
      const [lk, grant] = await Promise.all([import("livekit-client"), fetchGrant(ctl.signal)]);
      if (run !== mine) return;
      if (!grant) return close("failed");
      const track = await lk.createLocalAudioTrack({ echoCancellation: true, noiseSuppression: true, autoGainControl: true });
      if (run !== mine) { track.stop(); return; }
      mic = track;
      const call = new lk.Room({ adaptiveStream: false, dynacast: false });
      room = call;
      const fromWorker = (identity: string) => call.remoteParticipants.get(identity)?.isAgent === true;
      call.registerRpcMethod("copilot.greet", (d) => (fromWorker(d.callerIdentity) ? Promise.resolve(JSON.stringify({ say: "I'm listening." })) : Promise.reject(new Error("not our worker"))));
      call.registerRpcMethod("copilot.turn", async (d) => {
        if (!fromWorker(d.callerIdentity)) throw new Error("not our worker");
        const heard = heardText(d.payload);
        if (!heard || run !== mine) return JSON.stringify({ say: heard ? "" : "Could you say that again?" });
        return JSON.stringify({ say: await answerWithin(() => handlers.answer(heard)) });
      });
      // A line the worker dropped as someone else's voice: the pilot just lets it go.
      call.registerRpcMethod("copilot.ignored", () => Promise.resolve("{}"));
      call.on(lk.RoomEvent.TrackSubscribed, (t) => {
        if (t.kind !== lk.Track.Kind.Audio || run !== mine) return;
        const el = t.attach();
        el.hidden = true;
        document.body.appendChild(el);
        audio.add(el);
      });
      const workerHere = () => [...call.remoteParticipants.values()].some((p) => p.isAgent);
      const live = () => { if (run === mine) { clearTimeout(joinTimer); set({ status: "live" }); } };
      call.on(lk.RoomEvent.ParticipantConnected, (p) => { if (p.isAgent) live(); });
      call.on(lk.RoomEvent.ParticipantDisconnected, (p) => { if (p.isAgent && run === mine && state.status === "live") close("dropped"); });
      call.on(lk.RoomEvent.Reconnecting, () => { if (run === mine) set({ status: "connecting" }); });
      call.on(lk.RoomEvent.Reconnected, () => { if (run !== mine) return; if (workerHere()) live(); else close("dropped"); });
      call.on(lk.RoomEvent.Disconnected, () => { if (run === mine) close(state.status === "live" ? "dropped" : "failed"); });
      await call.connect(grant.url, grant.token);
      if (run !== mine) return;
      await call.localParticipant.publishTrack(track, { source: lk.Track.Source.Microphone });
      if (workerHere()) live();
    } catch (e) {
      if (run !== mine) return;
      const name = e instanceof Error ? e.name : "";
      close(name === "NotAllowedError" || name === "SecurityError" ? "blocked" : "failed");
    }
  };

  return {
    start: () => { void start(); },
    end: () => close("ended"),
    async mute(on: boolean) {
      const track = mic;
      if (!track || state.muted === on) return;
      try {
        if (on) await track.mute();
        else await track.unmute();
        if (mic === track) set({ muted: on });
      } catch { /* the call ended meanwhile */ }
    },
    getState: () => state,
    subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
  };
}
