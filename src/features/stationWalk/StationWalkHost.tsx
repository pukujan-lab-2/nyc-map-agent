import { lazy, Suspense, useEffect } from "react";
import { openStationWalk, useStationWalk } from "./store";

const StationWalk = lazy(() => import("./StationWalk").then((m) => ({ default: m.StationWalk })));

/** Mounts the walk inside Fulton St while it is open; nothing (and no download) otherwise. */
export function StationWalkHost() {
  const open = useStationWalk();
  // Dev and test hook: window.__walkInside() opens it without going through the station card.
  useEffect(() => {
    const w = window as unknown as { __walkInside?: (exit?: [number, number]) => void };
    w.__walkInside = (exit) => openStationWalk(exit ?? null);
    return () => { delete w.__walkInside; };
  }, []);
  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <StationWalk exit={open.exit} />
    </Suspense>
  );
}
