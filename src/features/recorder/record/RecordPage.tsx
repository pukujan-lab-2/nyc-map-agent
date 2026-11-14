import { useCallback, useEffect, useRef, useState } from "react";
import { removeShell } from "@/lib/shellDraft";
import { openBackCamera, stopStream } from "./camera";

/**
 * The recorder page at /record (#185): the back camera full screen with one
 * red Record button. No map and no chat bar here; the page is reached by its
 * address only and changes nothing on the map page.
 */
export default function RecordPage() {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [camError, setCamError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    setCamError(null);
    if (stream.current) return true;
    const cam = await openBackCamera();
    if (!cam.ok) { setCamError(cam.why); return false; }
    stream.current = cam.stream;
    if (video.current) {
      video.current.srcObject = cam.stream;
      await video.current.play().catch(() => undefined);
    }
    return true;
  }, []);

  useEffect(() => {
    // The static chat bar in index.html is the map page's; it never belongs here.
    removeShell();
    const title = document.title;
    document.title = "Record a station walk";
    void startCamera();
    return () => {
      document.title = title;
      stopStream(stream.current);
      stream.current = null;
    };
  }, [startCamera]);

  return (
    <main data-testid="record-page" className="fixed inset-0 overflow-hidden bg-black text-white">
      <video ref={video} data-testid="record-preview" className="absolute inset-0 h-full w-full object-cover" muted playsInline autoPlay />
      {camError && (
        <div role="alert" data-testid="record-camera-error" className="absolute inset-x-4 top-[max(1rem,env(safe-area-inset-top))] mx-auto max-w-md rounded-xl bg-black/75 px-4 py-3 text-center text-sm backdrop-blur">
          <p>{camError}</p>
          <button type="button" onClick={() => void startCamera()} className="mt-2 min-h-11 rounded-full bg-white px-4 text-sm font-semibold text-black">Try again</button>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex justify-center pb-[max(2rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          aria-label="Record"
          data-testid="record-button"
          className="grid h-20 w-20 place-items-center rounded-full border-4 border-white bg-transparent"
        >
          <span className="h-14 w-14 rounded-full bg-red-600" />
        </button>
      </div>
    </main>
  );
}
