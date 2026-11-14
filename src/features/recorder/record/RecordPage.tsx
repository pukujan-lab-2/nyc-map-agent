import { useCallback, useEffect, useRef, useState } from "react";
import { removeShell } from "@/lib/shellDraft";
import type { Recording } from "../format";
import { openBackCamera, stopStream } from "./camera";
import { askMotion, motionNeedsAsking, watchSensors } from "./sensors";
import { createCollector, deviceName, fileStem, motionRow, pickVideoType, videoExt, type Collector } from "./session";

/** What Stop hands on: the recording and its video. */
interface Take {
  recording: Recording;
  video: Blob | null;
  videoFile: string | null;
}

interface Live {
  collector: Collector;
  recorder: MediaRecorder | null;
  chunks: Blob[];
  videoStartedAt: number | null;
  stopSensors: () => void;
}

/** How long to wait for a first motion row before saying the device sends none. */
const MOTION_WAIT_MS = 1500;
type MotionState = "unknown" | "ok" | "none" | "blocked";

/**
 * The recorder page at /record (#185): the back camera full screen with one
 * red Record button. No map and no chat bar here; the page is reached by its
 * address only and changes nothing on the map page.
 */
export default function RecordPage() {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const live = useRef<Live | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "starting" | "recording" | "done">("idle");
  const [, setTake] = useState<Take | null>(null);
  const [motion, setMotion] = useState<MotionState>("unknown");
  const [locationBlocked, setLocationBlocked] = useState(false);

  const startCamera = useCallback(async () => {
    setCamError(null);
    if (stream.current?.active) return stream.current;
    const cam = await openBackCamera();
    if (!cam.ok) { setCamError(cam.why); return null; }
    stream.current = cam.stream;
    if (video.current) {
      video.current.srcObject = cam.stream;
      await video.current.play().catch(() => undefined);
    }
    return cam.stream;
  }, []);

  useEffect(() => {
    // The static chat bar in index.html is the map page's; it never belongs here.
    removeShell();
    const title = document.title;
    document.title = "Record a station walk";
    void startCamera();
    // A laptop sends no motion, or empty events. An iPhone sends none until Record has asked, so only others are judged here.
    let seen = false;
    const onMotion = (e: DeviceMotionEvent) => { if (motionRow(0, e)) seen = true; };
    let wait: number | undefined;
    if (!motionNeedsAsking()) {
      window.addEventListener("devicemotion", onMotion);
      wait = window.setTimeout(() => setMotion((m) => (m === "unknown" ? (seen ? "ok" : "none") : m)), MOTION_WAIT_MS);
    }
    return () => {
      window.removeEventListener("devicemotion", onMotion);
      window.clearTimeout(wait);
      document.title = title;
      live.current?.stopSensors();
      if (live.current?.recorder?.state === "recording") live.current.recorder.stop();
      stopStream(stream.current);
      stream.current = null;
    };
  }, [startCamera]);

  const record = () => {
    // Inside the tap, before any await: an iPhone only shows the motion prompt here.
    const motionAsked = askMotion();
    setPhase("starting");
    setLocationBlocked(false);
    void (async () => {
      const motionAllowed = await motionAsked;
      const cam = await startCamera();
      const startedAt = Date.now();
      const collector = createCollector(startedAt, deviceName(navigator.userAgent));
      const l: Live = { collector, recorder: null, chunks: [], videoStartedAt: null, stopSensors: () => undefined };
      live.current = l;
      l.stopSensors = watchSensors(collector, () => setLocationBlocked(true));
      if (!motionAllowed) setMotion("blocked");
      else window.setTimeout(() => { if (live.current === l) setMotion(collector.counts().motion ? "ok" : "none"); }, MOTION_WAIT_MS);
      if (cam && typeof MediaRecorder !== "undefined") {
        const type = pickVideoType((t) => MediaRecorder.isTypeSupported(t));
        try {
          const rec = new MediaRecorder(cam, type ? { mimeType: type } : undefined);
          rec.ondataavailable = (e) => { if (e.data.size) l.chunks.push(e.data); };
          rec.onstart = () => { l.videoStartedAt = Date.now(); };
          rec.start(1000);
          l.recorder = rec;
        } catch {
          setCamError("This browser cannot record video here. Marks and sensors still record.");
        }
      }
      setPhase("recording");
    })();
  };

  const stop = () => {
    const l = live.current;
    if (!l) return;
    l.stopSensors();
    const finish = () => {
      const type = l.recorder?.mimeType || l.chunks[0]?.type || "";
      const blob = l.chunks.length ? new Blob(l.chunks, { type }) : null;
      const videoFile = blob ? `${fileStem(l.collector.recording.startedAt)}.${videoExt(type)}` : null;
      const recording = l.collector.finish(blob && videoFile ? { file: videoFile, startedAt: l.videoStartedAt ?? l.collector.recording.startedAt } : undefined);
      live.current = null;
      setTake({ recording, video: blob, videoFile });
      setPhase("done");
    };
    if (l.recorder && l.recorder.state !== "inactive") {
      l.recorder.onstop = finish;
      l.recorder.stop();
    } else finish();
  };

  return (
    <main data-testid="record-page" className="fixed inset-0 overflow-hidden bg-black text-white">
      <video ref={video} data-testid="record-preview" className="absolute inset-0 h-full w-full object-cover" muted playsInline autoPlay />
      {camError && (
        <div role="alert" data-testid="record-camera-error" className="absolute inset-x-4 top-[max(1rem,env(safe-area-inset-top))] mx-auto max-w-md rounded-xl bg-black/75 px-4 py-3 text-center text-sm backdrop-blur">
          <p>{camError}</p>
          {phase === "idle" && <button type="button" onClick={() => void startCamera()} className="mt-2 min-h-11 rounded-full bg-white px-4 text-sm font-semibold text-black">Try again</button>}
        </div>
      )}
      {(motion === "none" || motion === "blocked" || locationBlocked) && phase !== "done" && (
        <div data-testid="record-notes" className="absolute inset-x-4 bottom-[calc(max(2rem,env(safe-area-inset-bottom))+6.5rem)] mx-auto max-w-md space-y-1 rounded-xl bg-black/60 px-4 py-2 text-center text-sm backdrop-blur">
          {motion === "none" && <p data-testid="motion-note">No motion sensors here. Video and marks still record; motion needs a phone.</p>}
          {motion === "blocked" && <p data-testid="motion-note">Motion is blocked. Allow motion for this site, then record again.</p>}
          {locationBlocked && <p data-testid="location-note">Location is blocked. The walk records without it.</p>}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex justify-center pb-[max(2rem,env(safe-area-inset-bottom))]">
        {phase === "recording" ? (
          <button type="button" aria-label="Stop" data-testid="stop-button" onClick={stop} className="grid h-20 w-20 place-items-center rounded-full border-4 border-white bg-transparent">
            <span className="h-8 w-8 rounded-md bg-red-600" />
          </button>
        ) : (
          <button type="button" aria-label="Record" data-testid="record-button" onClick={record} disabled={phase === "starting"} className="grid h-20 w-20 place-items-center rounded-full border-4 border-white bg-transparent disabled:opacity-60">
            <span className="h-14 w-14 rounded-full bg-red-600" />
          </button>
        )}
      </div>
    </main>
  );
}
