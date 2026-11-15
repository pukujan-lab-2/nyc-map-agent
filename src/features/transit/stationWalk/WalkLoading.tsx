import { ArrowLeft, RotateCw } from "lucide-react";
import { prefetchWalk, useWalkLoad, type WalkStep } from "./prefetch";

/** What the card says while each step is still to come, in the order they usually finish. */
const STEPS: Array<[WalkStep, string]> = [
  ["model", "Fetching the station"],
  ["code", "Downloading the walk"],
  ["station", "Building the station"],
  ["physics", "Starting the walk"],
];

/**
 * Covers the screen while the walk inside Fulton St loads (#126), with a line that fills as each
 * step finishes, so the tap never lands on a blank or frozen screen. Back to the map works throughout.
 */
export function WalkLoading({ onClose }: { onClose: () => void }) {
  const { done, failed } = useWalkLoad();
  const left = STEPS.find(([k]) => !done.has(k));
  // Everything fetched and built: the scene is putting the station on screen.
  const label = failed ? "Couldn't load the station." : left ? `${left[1]}…` : "Opening Fulton St…";
  const share = (done.size + 1) / (STEPS.length + 1);
  return (
    <div data-testid="station-walk-loading" className="fixed inset-0 z-[71] grid place-items-center bg-[#1d1f23] px-4 text-white">
      <div className="w-full max-w-xs text-center">
        <p className="text-lg font-semibold">Walk inside Fulton St</p>
        <p role="status" aria-live="polite" className="mt-1 text-sm text-white/80">{label}</p>
        {failed ? (
          <button type="button" onClick={() => void prefetchWalk()}
            className="mx-auto mt-4 flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            <RotateCw className="h-4 w-4" aria-hidden />
            Try again
          </button>
        ) : (
          <div role="progressbar" aria-label="Loading the walk" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)}
            className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-[#00933c] transition-[width] duration-300" style={{ width: `${share * 100}%` }} />
          </div>
        )}
        <p className="mt-6 text-xs text-white/55">Station model: Project Subway NYC (projectsubwaynyc.com)</p>
      </div>
      <button type="button" onClick={onClose} data-testid="station-walk-loading-close"
        className="absolute left-[var(--edge,12px)] top-[calc(env(safe-area-inset-top)+12px)] flex h-11 items-center gap-1.5 rounded-full bg-black/55 px-4 text-sm font-semibold text-white backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to the map
      </button>
    </div>
  );
}
