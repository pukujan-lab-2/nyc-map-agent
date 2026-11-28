import { useSyncExternalStore } from "react";

/**
 * The one open dropdown on the map's top-right buttons (#370): Layers or
 * Change view. Opening one closes the other.
 */
export type OpenMenu = "layers" | "view" | null;

let open: OpenMenu = null;
const subs = new Set<() => void>();

export function setOpenMenu(next: OpenMenu): void {
  if (next === open) return;
  open = next;
  subs.forEach((f) => f());
}

export function useOpenMenu(): OpenMenu {
  return useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => open, () => null);
}
