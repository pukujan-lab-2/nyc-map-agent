import { ArrowUp, Camera, Map, ScanLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { angleDiff } from "@/lib/compass/heading";
import { askSign, captureSignFrame } from "./SignScan";

type Point = [number, number];
type Sample = { yaw: number; time: number };
type CameraState = "starting" | "ready" | "blocked";
type ScanState = "idle" | "reading" | "unreadable" | "failed";
type HeadingState = "idle" | "waiting" | "aligned" | "unavailable";
const FRESH_MS = 2500;
const CAMERA = { video: { facingMode: { ideal: "environment" } }, audio: false };

/** Bearing of the rear camera's optical axis projected onto the horizontal plane. */
export function rearCameraYaw({ alpha, beta, gamma }: Pick<DeviceOrientationEvent, "alpha" | "beta" | "gamma">): number | null {
  if (alpha === null || beta === null || gamma === null || ![alpha, beta, gamma].every(Number.isFinite)) return null;
  const [a, b, g] = [alpha, beta, gamma].map((value) => value * Math.PI / 180);
  // The W3C rotation is Z-X-Y. Apply it to the rear camera's -Z axis.
  const east = -Math.cos(a) * Math.sin(g) - Math.sin(a) * Math.sin(b) * Math.cos(g);
  const north = -Math.sin(a) * Math.sin(g) + Math.cos(a) * Math.sin(b) * Math.cos(g);
  return Math.hypot(east, north) < 0.5 ? null : Math.atan2(east, north) * 180 / Math.PI;
}

function MiniMap({ path, level }: { path: Point[]; level: string }) {
  const [lon, lat] = path[0];
  const points = path.map(([x, y]) => [(x - lon) * Math.cos(lat * Math.PI / 180), lat - y] as Point);
  const minX = Math.min(...points.map(([x]) => x));
  const minY = Math.min(...points.map(([, y]) => y));
  const maxX = Math.max(...points.map(([x]) => x));
  const maxY = Math.max(...points.map(([, y]) => y));
  const scale = 65 / Math.max(maxX - minX, maxY - minY, 0.00001);
  const plot = points.map(([x, y]) => [60 + (x - (minX + maxX) / 2) * scale, 45 + (y - (minY + maxY) / 2) * scale] as Point);
  const [x, y] = plot[0];
  const [endX, endY] = plot[plot.length - 1];
  return (
    <figure className="m-0 w-[104px] shrink-0 overflow-hidden rounded-2xl border border-white/25 bg-slate-950/90 sm:w-[138px]" aria-label={`Route minimap, ${level}`}>
      <svg viewBox="0 0 120 90" className="block w-full" aria-hidden>
        <path d="M0 30H120M0 60H120M30 0V90M60 0V90M90 0V90" stroke="#263549" />
        <text x="9" y="16" fill="#cbd5e1" fontSize="11">N ↑</text>
        <polyline points={plot.map((p) => p.join(",")).join(" ")} stroke="#facc15" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx={endX} cy={endY} r="4" fill="#facc15" />
        <circle cx={x} cy={y} r="6" fill="#60a5fa" stroke="white" strokeWidth="2" data-testid="camera-minimap-position" />
      </svg>
      <figcaption className="border-t border-white/15 py-1 text-center text-xs font-semibold">{level}</figcaption>
    </figure>
  );
}

export function CameraGuide({ sign, matched, path, bearing, level, onFound, onClose }: {
  sign: { id: string; sign: string };
  matched: boolean;
  path: Point[];
  bearing: number | null;
  level: string;
  onFound: () => void;
  onClose: () => void;
}) {
  const [camera, setCamera] = useState<CameraState>("starting");
  const [scan, setScan] = useState<ScanState>("idle");
  const [heading, setHeading] = useState<HeadingState>("idle");
  const [cameraBearing, setCameraBearing] = useState<number | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const scanRequest = useRef<AbortController | null>(null);
  const sample = useRef<Sample | null>(null);
  const alignedAt = useRef<{ yaw: number; bearing: number } | null>(null);
  const alignPending = useRef<number | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;
    let stream: MediaStream | undefined;
    const root = document.getElementById("root");
    const returnFocus = document.activeElement;
    const wasInert = root?.inert ?? false;
    if (root) root.inert = true;
    closeButton.current?.focus();

    const stop = () => {
      active = false;
      stream?.getTracks().forEach((track) => track.stop());
      scanRequest.current?.abort();
      clearTimeout(timeout.current);
      sample.current = null;
      alignedAt.current = null;
      alignPending.current = null;
    };
    const suspend = () => {
      if (document.visibilityState !== "hidden") return;
      stop();
      setCamera("blocked");
      setCameraBearing(null);
      setHeading("unavailable");
    };
    const onOrientation = (event: DeviceOrientationEvent) => {
      if (!active) return;
      const yaw = rearCameraYaw(event);
      if (yaw === null) return;
      sample.current = { yaw, time: performance.now() };
      if (alignPending.current !== null) {
        alignedAt.current = { yaw, bearing: alignPending.current };
        alignPending.current = null;
        setHeading("aligned");
      }
      if (alignedAt.current === null) return;
      setCameraBearing(Math.round(alignedAt.current.bearing + angleDiff(alignedAt.current.yaw, yaw)));
      clearTimeout(timeout.current);
      timeout.current = setTimeout(() => {
        alignedAt.current = null;
        setHeading("unavailable");
        setCameraBearing(null);
      }, FRESH_MS);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
    };

    if (!navigator.mediaDevices?.getUserMedia) setCamera("blocked");
    else void navigator.mediaDevices.getUserMedia(CAMERA).then((media) => {
      if (!active) { media.getTracks().forEach((track) => track.stop()); return; }
      stream = media;
      if (video.current) video.current.srcObject = media;
      media.getVideoTracks().forEach((track) => track.addEventListener("ended", suspendCamera, { once: true }));
    }).catch(() => { if (active) setCamera("blocked"); });

    function suspendCamera() {
      if (!active) return;
      setCamera("blocked");
      setCameraBearing(null);
      stop();
    }
    document.addEventListener("visibilitychange", suspend);
    window.addEventListener("deviceorientation", onOrientation);
    window.addEventListener("keydown", escape, true);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", suspend);
      window.removeEventListener("deviceorientation", onOrientation);
      window.removeEventListener("keydown", escape, true);
      if (root) root.inert = wasInert;
      if (returnFocus instanceof HTMLElement) returnFocus.focus();
    };
  }, [onClose]);

  const align = async () => {
    if (bearing === null) return;
    const orientation = globalThis.DeviceOrientationEvent as (typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<"granted" | "denied">;
    }) | undefined;
    setHeading("waiting");
    alignedAt.current = null;
    setCameraBearing(null);
    try {
      if (orientation?.requestPermission && await orientation.requestPermission() !== "granted") {
        setHeading("unavailable");
        return;
      }
    } catch {
      setHeading("unavailable");
      return;
    }
    if (!video.current || !video.current.srcObject || document.hidden) return;
    if (sample.current && performance.now() - sample.current.time < 500) {
      alignedAt.current = { yaw: sample.current.yaw, bearing };
      setCameraBearing(bearing);
      setHeading("aligned");
    } else {
      alignPending.current = bearing;
    }
    clearTimeout(timeout.current);
    timeout.current = setTimeout(() => {
      alignPending.current = null;
      alignedAt.current = null;
      setCameraBearing(null);
      setHeading("unavailable");
    }, FRESH_MS);
  };

  const read = async () => {
    const image = video.current && captureSignFrame(video.current);
    if (!image || scanRequest.current) return;
    const request = new AbortController();
    scanRequest.current = request;
    setScan("reading");
    try {
      const id = await askSign(image, [sign], request.signal, sign.sign);
      if (request.signal.aborted) return;
      if (id === sign.id) { setScan("idle"); onFound(); }
      else setScan("unreadable");
    } catch {
      if (!request.signal.aborted) setScan("failed");
    } finally {
      scanRequest.current = null;
    }
  };

  const instructions = matched ? "Go under the Elevator to L sign and into the long corridor." : "Point at the Elevator to L sign.";
  const arrow = camera === "ready" && matched && bearing !== null && cameraBearing !== null ? Math.round(angleDiff(cameraBearing, bearing)) : null;
  const canAlign = camera === "ready" && matched && bearing !== null && heading !== "waiting";
  const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-slate-950/90 px-4 text-sm font-semibold text-white ring-1 ring-inset ring-white/30 disabled:opacity-70";
  return createPortal(
    <section role="dialog" aria-modal="true" aria-label="Camera guidance" data-testid="camera-guide"
      className="fixed inset-0 z-[1000] isolate overflow-hidden bg-slate-950 text-white">
      <video ref={video} autoPlay muted playsInline aria-hidden="true" data-testid="camera-guide-video"
        className="absolute inset-0 size-full object-cover"
        onPlaying={() => setCamera((status) => status === "starting" ? "ready" : status)} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/65 via-transparent to-black/70" />
      <header className="absolute inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] flex items-start justify-between gap-3 sm:inset-x-5">
        <div className="min-w-0 rounded-2xl bg-slate-950/90 px-3 py-2 ring-1 ring-inset ring-white/25">
          <p className="text-xs font-semibold text-slate-200">Simulation · {level}</p>
          <h2 className="text-sm font-bold sm:text-base">14 St–Union Sq</h2>
        </div>
        <button ref={closeButton} type="button" className={`shrink-0 ${button}`} onClick={onClose}><Map size={17} /> Map</button>
      </header>
      {arrow !== null ? (
        <div className="pointer-events-none absolute inset-x-0 top-[42%] flex justify-center" role="img" aria-label="Route direction">
          <div data-testid="camera-direction-arrow" data-turn={arrow} className="rounded-full bg-sky-300 p-4 text-slate-950 shadow-xl transition-transform duration-100 motion-reduce:transition-none" style={{ transform: `rotate(${arrow}deg)` }}>
            <ArrowUp size={55} strokeWidth={3} />
          </div>
        </div>
      ) : null}
      <div className="absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] flex flex-col gap-3 sm:inset-x-5">
        <div className="flex items-end justify-between gap-2">
          <div className="w-full max-w-[31rem] rounded-2xl bg-slate-950/90 px-3 py-2 ring-1 ring-inset ring-white/25" role="status">
            <p className="text-sm font-semibold sm:text-base">{camera === "blocked" ? "Camera unavailable. Use the map to continue." : instructions}</p>
            {camera === "starting" ? <p className="mt-1 text-xs text-slate-200">Starting camera…</p> : null}
            {scan === "unreadable" ? <p className="mt-1 text-xs text-amber-200">Sign unclear. Frame the words and try again.</p> : null}
            {scan === "failed" ? <p className="mt-1 text-xs text-amber-200">Sign service unavailable. Try again or return to the map.</p> : null}
            {camera === "ready" && matched && heading === "idle" ? <p className="mt-1 text-xs text-slate-200">Face along the corridor to align the arrow.</p> : null}
            {camera === "ready" && matched && heading === "unavailable" ? <p className="mt-1 text-xs text-amber-200">Heading unavailable. Follow the route on the minimap.</p> : null}
          </div>
          <MiniMap path={path} level={level} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {!matched && camera === "ready" ? <>
            <button type="button" className={button} onClick={() => void read()} disabled={scan === "reading"}><ScanLine size={18} /> {scan === "reading" ? "Reading sign…" : "Scan sign"}</button>
            <span className="rounded bg-slate-950/90 px-1.5 py-1 text-xs text-slate-200">Sends one frame for sign reading.</span>
          </> : null}
          {matched && camera === "ready" && bearing !== null ? <>
            <button type="button" className={button} onClick={() => void align()} disabled={!canAlign}><Camera size={17} /> {heading === "waiting" ? "Aligning…" : heading === "aligned" ? "Realign arrow" : "Align arrow"}</button>
            {arrow !== null ? <span className="rounded bg-slate-950/90 px-1.5 py-1 text-xs text-slate-200">Heading-based arrow</span> : null}
          </> : null}
        </div>
      </div>
    </section>,
    document.body,
  );
}
