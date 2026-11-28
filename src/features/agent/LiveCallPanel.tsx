import { Mic, MicOff, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CallStatus } from "@/lib/voice/liveCall";

/** The live call in the sheet, where the hands-free orb sits: what the call is doing, Mute and End call. */
export function LiveCallPanel({ status, muted, onMute, onEnd }: { status: CallStatus; muted: boolean; onMute: (on: boolean) => void; onEnd: () => void }) {
  const label = status === "live" ? (muted ? "Muted" : "On a call") : "Connecting…";
  return (
    <section aria-label="Live call" data-testid="live-call" className="flex flex-col items-center gap-3 px-2 py-2 text-center">
      <p role="status" className="m-0 text-sm font-semibold text-slate-50">{label}</p>
      <div className="flex items-center gap-3">
        <Button type="button" variant="secondary" aria-pressed={muted} disabled={status !== "live"} onClick={() => onMute(!muted)}
          className="h-11 gap-2 rounded-full px-4">
          {muted ? <MicOff className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
          {muted ? "Unmute" : "Mute"}
        </Button>
        <Button type="button" variant="destructive" onClick={onEnd} className="h-11 gap-2 rounded-full px-4">
          <PhoneOff className="h-4 w-4" aria-hidden="true" /> End call
        </Button>
      </div>
    </section>
  );
}
