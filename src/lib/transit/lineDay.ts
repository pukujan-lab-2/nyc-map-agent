import { useSyncExternalStore } from "react";
import type { LineDay } from "./weekend";

export type { LineDay } from "./weekend";

/**
 * The time an answer asked about ("this weekend", a named day), for the line panel to open on
 * (owner, 2026-10-27: the 7's weekend work was invisible on a weekday). The panel picks the time
 * button that covers it most (src/lib/transit/periods.ts). null = no answer asked; the panel opens on
 * the button for the time now. A tap on a time button clears it, and so does closing the line.
 */
let day: LineDay | null = null;
const subs = new Set<() => void>();

export function setLineDay(next: LineDay | null): void {
  if (next?.from === day?.from && next?.to === day?.to && next?.label === day?.label) return;
  day = next;
  subs.forEach((f) => f());
}
export const getLineDay = (): LineDay | null => day;
export function useLineDay(): LineDay | null {
  return useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => day, () => null);
}
