import type { LocalAudioTrack, Room } from "livekit-client";

/**
 * The live call for the presenter (draft, behind ?flags=+liveVoice): a LiveKit room where the
 * dispatched voice agent hears the visitor and speaks the answer. Ported from design-bakery's
 * frontend/src/app/modules/copilot/voice.ts, without that site's copilot store, hold lines and
 * nudges. The agent's heard question goes through the presenter's own /api/presenter/ask, so the
 * answer keeps its sources and the prepared fallback. Default behavior of /present is unchanged.
 */

export type LiveVoiceState = {
  status: "idle" | "connecting" | "connected";
  error: string;
  muted: boolean;
};

let state: LiveVoiceState = { status: "idle", error: "", muted: false };
const listeners = new Set<() => void>();
const set = (patch: Partial<LiveVoiceState>) => {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
};

export const subscribeLiveVoice = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getLiveVoiceState = (): LiveVoiceState => state;

let room: Room | null = null;
let microphone: LocalAudioTrack | null = null;
let generation = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const audioElements = new Set<HTMLMediaElement>();

function close(error = "") {
  generation += 1;
  clearTimeout(timer);
  microphone?.stop();
  microphone = null;
  const current = room;
  room = null;
  if (current) void current.disconnect();
  for (const audio of audioElements) audio.remove();
  audioElements.clear();
  set({ status: "idle", error, muted: false });
}

/** The scene the tour is on right now, so the answer knows what the visitor is looking at. */
function currentScene(): number {
  const scene = Number(document.querySelector("#presenter")?.getAttribute("data-scene"));
  return Number.isInteger(scene) && scene >= 1 && scene <= 15 ? scene : 1;
}

async function answerHeard(question: string): Promise<string> {
  try {
    const response = await fetch("/api/presenter/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: question.slice(0, 500), scene: currentScene() }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) throw new Error("ask failed");
    const result = await response.json() as { answer?: string; chapter?: number };
    if (typeof result.answer !== "string" || !result.answer.trim()) throw new Error("no answer");
    return result.answer;
  } catch {
    return "I couldn't check that right now. We can keep going from here.";
  }
}

export const liveVoice = {
  stop: () => close(),
  /** Mute after asking, so the answer finishes uninterrupted (the owner's demo flow). */
  async toggleMute() {
    const track = microphone;
    if (!track) return;
    const next = !state.muted;
    try {
      if (next) await track.mute();
      else await track.unmute();
      if (microphone === track) set({ muted: next });
    } catch {
      /* the call may have ended */
    }
  },
  async start() {
    if (state.status !== "idle") return;
    const run = ++generation;
    set({ status: "connecting", error: "", muted: false });
    let step = "load";
    try {
      const grantRequest = fetch("/api/presenter/voice-token", { signal: AbortSignal.timeout(20_000) })
        .then((response) => {
          if (!response.ok) throw new Error("voice service unavailable");
          return response.json() as Promise<{ url: string; token: string }>;
        });
      const lk = await import("livekit-client");
      step = "mic";
      const [mic, grantResult] = await Promise.allSettled([
        lk.createLocalAudioTrack({ echoCancellation: true, noiseSuppression: true, autoGainControl: true }),
        grantRequest,
      ]);
      if (mic.status === "fulfilled" && (generation !== run || grantResult.status === "rejected")) mic.value.stop();
      if (generation !== run) return;
      if (mic.status === "rejected") throw mic.reason;
      step = "grant";
      if (grantResult.status === "rejected") throw grantResult.reason;
      const track = mic.value;
      const grant = grantResult.value;
      microphone = track;
      const call = new lk.Room({ adaptiveStream: false, dynacast: false });
      room = call;
      const isAgent = (identity: string) => call.remoteParticipants.get(identity)?.isAgent === true;
      call.registerRpcMethod("copilot.greet", (data) => {
        if (!isAgent(data.callerIdentity)) return Promise.reject(new Error("Unrecognized voice participant"));
        return Promise.resolve(JSON.stringify({ say: "Hi, I'm Design Baker. Ask me about the walk, the evidence, or the project." }));
      });
      call.registerRpcMethod("copilot.turn", async (data) => {
        if (!isAgent(data.callerIdentity)) throw new Error("Unrecognized voice participant");
        let question = "";
        try {
          const heard = JSON.parse(data.payload || "{}") as { text?: unknown };
          if (typeof heard.text === "string") question = heard.text.slice(0, 2000);
        } catch { /* invalid speech payload */ }
        if (!question || generation !== run) return JSON.stringify({ say: "Could you say that again?" });
        return JSON.stringify({ say: await answerHeard(question) });
      });
      call.registerRpcMethod("copilot.ignored", () => Promise.resolve("{}"));
      call.on(lk.RoomEvent.TrackSubscribed, (track) => {
        if (track.kind !== lk.Track.Kind.Audio || generation !== run) return;
        const audio = track.attach();
        audio.hidden = true;
        document.body.appendChild(audio);
        audioElements.add(audio);
      });
      call.on(lk.RoomEvent.ParticipantConnected, (participant) => {
        if (participant.isAgent && generation === run) { clearTimeout(timer); set({ status: "connected" }); }
      });
      call.on(lk.RoomEvent.Reconnecting, () => { if (generation === run) set({ status: "connecting" }); });
      call.on(lk.RoomEvent.Reconnected, () => {
        if (generation !== run) return;
        if ([...call.remoteParticipants.values()].some((p) => p.isAgent)) set({ status: "connected" });
        else close("The voice agent disconnected. You can continue typing.");
      });
      call.on(lk.RoomEvent.Disconnected, () => {
        if (generation === run) close("The call disconnected. You can continue typing.");
      });
      timer = setTimeout(() => {
        if (generation === run && state.status === "connecting") close("The voice agent did not answer. You can continue typing.");
      }, 60_000);
      step = "connect";
      await call.connect(grant.url, grant.token);
      if (generation !== run) return;
      step = "publish";
      await call.localParticipant.publishTrack(track, { source: lk.Track.Source.Microphone });
      if ([...call.remoteParticipants.values()].some((participant) => participant.isAgent)) {
        clearTimeout(timer);
        set({ status: "connected" });
      }
    } catch (error) {
      if (generation !== run) return;
      const name = error instanceof Error ? error.name : "";
      void step;
      close(name === "NotAllowedError" || name === "SecurityError"
        ? "Microphone access is blocked. Allow it in your browser or continue typing."
        : "Voice is unavailable right now. You can continue typing.");
    }
  },
};