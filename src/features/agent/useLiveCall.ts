import { useCallback, useEffect, useRef, useState } from "react";
import type { CallEnd, CallState } from "@/lib/voice/liveCall";

type Call = ReturnType<typeof import("@/lib/voice/liveCall").createLiveCall>;

/**
 * The hands-free live call for this page (pilot, `liveCall` flag). `answer` is the page's own question path, so a heard line
 * gets the same tools and map actions as a typed one; `onFallback` gets the one line to show when the call ends by itself,
 * and whether the page should go back to one question at a time. The call's code (and LiveKit's) loads on the first start.
 */
export function useLiveCall(answer: (heard: string) => Promise<string>, onFallback: (line: string, turns: boolean) => void) {
  const answerRef = useRef(answer);
  answerRef.current = answer;
  const fallbackRef = useRef(onFallback);
  fallbackRef.current = onFallback;
  const callRef = useRef<Call | null>(null);
  // End pressed while the call's code was still loading: do not start it once it arrives.
  const wanted = useRef(false);
  const [state, setState] = useState<CallState>({ status: "idle", muted: false });

  const start = useCallback(() => {
    wanted.current = true;
    if (callRef.current) { callRef.current.start(); return; }
    setState({ status: "connecting", muted: false });
    void import("@/lib/voice/liveCall").then(({ createLiveCall, endLine }) => {
      const call = createLiveCall({
        answer: (heard) => answerRef.current(heard),
        onEnd: (why: CallEnd) => {
          const line = endLine(why);
          if (line) fallbackRef.current(line, why !== "blocked");
        },
      });
      callRef.current = call;
      call.subscribe(() => setState(call.getState()));
      if (wanted.current) call.start();
    }, () => {
      if (!wanted.current) return;
      setState({ status: "idle", muted: false });
      fallbackRef.current("The live call didn't connect, so hands-free is taking one question at a time.", true);
    });
  }, []);
  const end = useCallback(() => { wanted.current = false; if (callRef.current) callRef.current.end(); else setState({ status: "idle", muted: false }); }, []);
  const mute = useCallback((on: boolean) => callRef.current?.mute(on) ?? Promise.resolve(), []);
  useEffect(() => () => callRef.current?.end(), []);
  return { ...state, active: state.status !== "idle", start, end, mute };
}
