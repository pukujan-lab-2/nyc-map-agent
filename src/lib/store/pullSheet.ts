import { useSyncExternalStore } from "react";

/**
 * The one sheet's views, oldest first: a phone's bottom sheet, and from 640 px
 * the left card (src/lib/store/leftColumn.ts). Only the newest one shows; the
 * ones under it stay mounted but draw nothing, so two panels never stack
 * (owner, 2026-11-07 and 2026-11-27: one sheet with drill-in views and a back
 * arrow, the way Apple and Google Maps do it). Closing the top one brings back
 * the one under it. The answer card is a view too (AgentHome).
 */
interface Entry { id: number; close: () => void; tag?: string }
let stack: readonly Entry[] = [];
let nextId = 1;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

/** Until then, the next view to come up goes under the one showing instead of over it. */
let underUntil = 0;

/**
 * The next view (within a second) opens under the one showing: an answer that opens its line by itself
 * keeps the answer in front, and closing the answer shows the line.
 */
export function openNextUnderTop(now = Date.now()): void {
  underUntil = now + 1000;
}

/** A sheet came up: it goes on top. Returns its id and the call that takes it off again. */
export function pullSheetMounted(close: () => void, now = Date.now(), tag?: string): { id: number; release: () => void } {
  const id = nextId++;
  const under = now < underUntil && stack.length > 0;
  underUntil = 0;
  const entry: Entry = { id, close, tag };
  stack = under ? [...stack.slice(0, -1), entry, stack.at(-1)!] : [...stack, entry];
  emit();
  return { id, release: () => { stack = stack.filter((e) => e.id !== id); emit(); } };
}

/** Bring a view that is already up back to the top (a new question over a line it opened). */
export function raiseSheet(id: number): void {
  const e = stack.find((x) => x.id === id);
  if (!e || stack.at(-1)?.id === id) return;
  stack = [...stack.filter((x) => x.id !== id), e];
  emit();
}

/** Bring the view with this tag (say "line:7") to the top, if it is up: asked for again, it shows again. */
export function raiseTag(tag: string): void {
  const e = stack.find((x) => x.tag === tag);
  if (e) raiseSheet(e.id);
}

/** Close every sheet in the stack, newest first: the close button empties the sheet, back only pops one view. */
export function closeSheets(): void {
  for (const e of [...stack].reverse()) e.close();
}

const subscribe = (f: () => void) => (subs.add(f), () => subs.delete(f));

export function usePullSheetUp(): boolean {
  return useSyncExternalStore(subscribe, () => stack.length > 0, () => false);
}

/** Where a sheet sits: whether it is the one showing, and whether another waits under it. */
export function useSheetPlace(id: number | null): { top: boolean; below: boolean } {
  const top = useSyncExternalStore(subscribe, () => id !== null && stack.at(-1)?.id === id, () => true);
  const below = useSyncExternalStore(subscribe, () => id !== null && stack.findIndex((e) => e.id === id) > 0, () => false);
  return { top, below };
}
