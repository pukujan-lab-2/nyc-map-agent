import { lazy, Suspense, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { prefetchWalk } from "./prefetch";
import { closeStationWalk, openStationWalk, useStationWalk } from "./store";
import { WalkLoading } from "./WalkLoading";

const StationWalk = lazy(() => import("@/lib/map/three/StationWalkScene").then((m) => ({ default: m.StationWalk })));

/**
 * Mounts the walk inside Fulton St while it is open, under a loading card until the walker is on
 * screen; nothing otherwise. Street view near Fulton St has usually started the download already.
 */
export function StationWalkHost() {
  const open = useStationWalk();
  // Ready belongs to one opening, so opening again starts under the card.
  const [readyFor, setReadyFor] = useState<typeof open>(null);
  const ready = open !== null && readyFor === open;
  useEffect(() => { if (open) void prefetchWalk(); }, [open]);
  // Dev and test hook: window.__walkInside() opens it without going through the station card.
  useEffect(() => {
    const w = window as unknown as { __walkInside?: (exit?: [number, number]) => void };
    w.__walkInside = (exit) => openStationWalk(exit ?? null);
    return () => { delete w.__walkInside; };
  }, []);
  // The walk covers the whole screen: the app behind it takes no taps, keys or screen-reader focus.
  useEffect(() => {
    const app = document.getElementById("root");
    if (!open || !app) return;
    app.inert = true;
    return () => { app.inert = false; };
  }, [open]);
  if (!open) return null;
  // Drawn beside the app, not inside it, so the inert app does not take the walk with it.
  return createPortal(
    <>
      {/* Under the loading card the walk's own buttons take no taps or focus until it shows. */}
      <div inert={!ready}>
        <Suspense fallback={null}>
          <StationWalk exit={open.exit} onClose={closeStationWalk} onReady={() => setReadyFor(open)} />
        </Suspense>
      </div>
      {ready ? null : <WalkLoading onClose={closeStationWalk} />}
    </>,
    document.body,
  );
}
