import { useSyncExternalStore } from "react";
import { useMediaQuery } from "@/lib/useMediaQuery";

/**
 * The one left card on screens 640 px and wider (owner, 2026-10-28 and 2026-11-27: one place for
 * every panel, as Apple Maps does). AgentHome draws it at every such size: the ask box at its foot,
 * and whatever sheet view is on top of the one stack (src/lib/store/pullSheet.ts) above it, in
 * `slot`. A phone gets the same views as its one bottom sheet instead.
 */
export const COLUMN_QUERY = "(min-width: 640px)";

interface LeftColumn {
  /** Where the top sheet view goes, while the card is drawn. */
  slot: HTMLElement | null;
  /** The card is drawn (640 px and up, outside full-screen modes): the ask box is at the left. */
  sheet: boolean;
  /** The chip row at the top of the left side (live paused, back to street). */
  chips: HTMLElement | null;
}

let state: LeftColumn = { slot: null, sheet: false, chips: null };
const subs = new Set<() => void>();

function set(next: Partial<LeftColumn>) {
  if (Object.entries(next).every(([k, v]) => state[k as keyof LeftColumn] === v)) return;
  state = { ...state, ...next };
  subs.forEach((f) => f());
}

export const setLeftSlot = (slot: HTMLElement | null) => set({ slot });
export const setLeftSheet = (sheet: boolean) => set({ sheet });
export const setLeftChips = (chips: HTMLElement | null) => set({ chips });

export function useLeftColumn<T>(pick: (s: LeftColumn) => T): T {
  return useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => pick(state), () => pick(state));
}

/** True from 640 px: sheet views go in the left card, not a bottom sheet. */
export function useColumnWide(): boolean {
  return useMediaQuery(COLUMN_QUERY);
}

/**
 * Where a small status chip goes on wide screens: one row at the top of the left
 * side, instead of floating over the middle of the map. Null on phones and before
 * the row is drawn; the chip then keeps its own place.
 */
export function useLeftChips(): HTMLElement | null {
  return useLeftColumn((s) => s.chips);
}
