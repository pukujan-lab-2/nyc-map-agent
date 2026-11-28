import { useSyncExternalStore } from "react";
import type { RestroomOption } from "./pick";

/**
 * The restroom a Walk me there is heading to, kept on the phone only, so the
 * arrival question knows which restroom it asks about. Cleared on arrival or
 * when the walk ends somewhere else.
 */
let target: RestroomOption | null = null;
const listeners = new Set<() => void>();

export function setWalkTarget(next: RestroomOption | null): void {
  target = next;
  for (const l of listeners) l();
}

export function useWalkTarget(): RestroomOption | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => target,
  );
}

/** Within this many metres of the restroom (less the fix's own error, up to 30 m) the walk has arrived. */
export const ARRIVE_M = 35;

export function hasArrived(distanceM: number, accuracyM: number | null): boolean {
  return distanceM - Math.min(Math.max(accuracyM ?? 0, 0), 30) <= ARRIVE_M;
}
