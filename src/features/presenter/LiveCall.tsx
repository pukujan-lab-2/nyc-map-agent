import { useEffect, useState, useSyncExternalStore } from "react";
import { useFlags } from "@/lib/flags";
import { getLiveVoiceState, liveVoice, subscribeLiveVoice } from "./liveVoice";

/**
 * The live-call button (draft): shown only with ?flags=+liveVoice and a configured voice
 * service. While a call is up the visitor can mute after asking, so the answer finishes
 * uninterrupted, and end the call to return to turn-based dictation.
 */
export function LiveCall() {
  const flags = useFlags();
  const [configured, setConfigured] = useState(false);
  const call = useSyncExternalStore(subscribeLiveVoice, getLiveVoiceState, getLiveVoiceState);

  useEffect(() => {
    if (!flags.liveVoice) return;
    const controller = new AbortController();
    fetch("/api/presenter/status", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : {}))
      .then((status: { liveVoice?: boolean }) => setConfigured(status.liveVoice === true))
      .catch(() => undefined);
    return () => controller.abort();
  }, [flags.liveVoice]);

  if (!flags.liveVoice || !configured) return null;
  return (
    <>
      {call.status === "idle" ? (
        <button type="button" id="livecall" onClick={() => void liveVoice.start()}>Live call</button>
      ) : call.status === "connecting" ? (
        <button type="button" id="livecall" disabled>Connecting…</button>
      ) : (
        <>
          <button type="button" id="livecall-mute" aria-pressed={call.muted} onClick={() => void liveVoice.toggleMute()}>
            {call.muted ? "Unmute" : "Mute"}
          </button>
          <button type="button" id="livecall" onClick={() => liveVoice.stop()}>End call</button>
        </>
      )}
      {call.error ? <span className="livecall-error" role="status">{call.error}</span> : null}
    </>
  );
}