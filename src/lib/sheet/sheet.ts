import { useLayoutEffect, useSyncExternalStore } from "react";
import { createActor } from "xstate";
import type { SheetLevel } from "@/components/sheetSwipe";
import { useMediaQuery } from "@/lib/useMediaQuery";
import {
  sheetHeight,
  sheetMachine,
  shownBanner,
  viewPlace,
  type LeftColumn,
  type NavBanner,
  type OpenMenu,
  type ScreenEvent,
  type ScreenSize,
  type ScreenView,
  type SheetContext,
  type SlotAction,
} from "./sheetMachine";

export type { OpenMenu } from "./sheetMachine";
export { escapeTarget, peekChipLabel } from "./sheetMachine";

/**
 * The running sheet machine (./sheetMachine.ts) and the hooks the app reads it through. Every
 * panel, the answer card, the line panel, the menus and the left card report here; nothing
 * else keeps its own copy of what the sheet shows.
 */
const actor = createActor(sheetMachine, { input: {} });
actor.start();

const subscribe = (f: () => void) => { const s = actor.subscribe(f); return () => s.unsubscribe(); };
const context = (): SheetContext => actor.getSnapshot().context;
/** `server` is what a server render (and the first hydrating one) sees; by default the live value. */
const useSheet = <T,>(pick: (c: SheetContext) => T, server?: T): T =>
  useSyncExternalStore(subscribe, () => pick(context()), () => (server === undefined ? pick(context()) : server));

// ── The stack of views ───────────────────────────────────────────────────────────────────────

let nextId = 1;

/** A view came up: it goes on top. Returns its id and the call that takes it off again. */
export function pullSheetMounted(close: () => void, now = Date.now(), tag?: string): { id: number; release: () => void } {
  const id = nextId++;
  actor.send({ type: "OPEN", id, close, tag, now });
  return { id, release: () => actor.send({ type: "RELEASE", id }) };
}

/**
 * The next view (within a second) opens under the one showing: an answer that opens its line by itself
 * keeps the answer in front, and closing the answer shows the line.
 */
export const openNextUnderTop = (now = Date.now()): void => actor.send({ type: "OPEN_UNDER", now });

/** Bring a view that is already up back to the top (a new question over a line it opened). */
export const raiseSheet = (id: number): void => actor.send({ type: "RAISE", id });

/** Bring the view with this tag (say "line:7") to the top, if it is up: asked for again, it shows again. */
export const raiseTag = (tag: string): void => actor.send({ type: "RAISE_TAG", tag });

/** The height a view asks for; the top view's is the sheet's. */
export const setSheetLevel = (id: number, level: SheetLevel): void => actor.send({ type: "LEVEL", id, level });

/**
 * Close every view, newest first: Close empties the sheet, Back only takes the top one off. Each view's
 * own close runs here, outside the machine, and takes the view off as it unmounts.
 */
export function closeSheets(): void {
  for (const v of [...context().views].reverse()) v.close();
}

/** Back: take the top view off, showing the one under it. */
export function sheetBack(): void {
  context().views.at(-1)?.close();
}

export const usePullSheetUp = (): boolean => useSheet((c) => c.views.length > 0, false);

/** Where a view sits: whether it is the one showing, and whether another waits under it. */
export function useSheetPlace(id: number | null): { top: boolean; below: boolean } {
  // A server render draws every view as the one showing, since nothing has opened yet.
  const top = useSheet((c) => viewPlace(c, id).top, true);
  const below = useSheet((c) => viewPlace(c, id).below, false);
  return { top, below };
}

// ── The details slot (PanelContext) ──────────────────────────────────────────────────────────

export const sendSlot = (action: SlotAction): void => actor.send({ type: "SLOT", action });
export const useSlot = () => useSheet((c) => c.slot);
export const getSlot = () => context().slot;

// ── The one open dropdown ────────────────────────────────────────────────────────────────────

/** Opening one menu closes the other (#370). */
export const setOpenMenu = (menu: OpenMenu): void => actor.send({ type: "MENU", menu });
export const useOpenMenu = (): OpenMenu => useSheet((c) => c.menu, null);

// ── The left card from 640 px ────────────────────────────────────────────────────────────────

export const COLUMN_QUERY = "(min-width: 640px)";

export const setLeftSlot = (slot: HTMLElement | null) => actor.send({ type: "LEFT", column: { slot } });
export const setLeftSheet = (sheet: boolean) => actor.send({ type: "LEFT", column: { sheet } });
export const setLeftChips = (chips: HTMLElement | null) => actor.send({ type: "LEFT", column: { chips } });

export function useLeftColumn<T>(pick: (s: LeftColumn) => T): T {
  return useSheet((c) => pick(c.column));
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

// ── The navigation banner ────────────────────────────────────────────────────────────────────

/**
 * Walking guidance or a followed train puts its banner up while `up`; true while this one is the
 * banner showing (the newest, so two never sit on top of each other).
 */
export function useNavBanner(banner: NavBanner, up = true): boolean {
  useLayoutEffect(() => {
    if (!up) return;
    actor.send({ type: "BANNER", banner, on: true });
    return () => actor.send({ type: "BANNER", banner, on: false });
  }, [banner, up]);
  // A server render has run no effects, so nothing is registered yet: draw the banner as before.
  const shown = useSheet((c) => shownBanner(c) === banner, true);
  return up && shown;
}

// ── Who gets the screen ──────────────────────────────────────────────────────────────────────

export const sendScreen = (event: ScreenEvent): void => actor.send(event);

/** What the answer and the line panel should show right now. */
export function useScreen<T>(pick: (v: ScreenView) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => pick(actor.getSnapshot().value as ScreenView),
    () => pick(actor.getSnapshot().value as ScreenView),
  );
}

/** The screen's size class: "wide" from 640 px, which docks panels to the side instead of over the chat. */
export const useScreenSize = (): ScreenSize => useSheet((c) => c.size);

// ── What the machine writes to the page ──────────────────────────────────────────────────────

if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
  const sizeOf = (): ScreenSize =>
    window.matchMedia(COLUMN_QUERY).matches ? "wide" : window.matchMedia("(max-width: 374px), (max-height: 699px)").matches ? "small" : "phone";
  const update = () => sendScreen({ type: "SIZE", size: sizeOf() });
  for (const q of [COLUMN_QUERY, "(max-width: 374px), (max-height: 699px)"]) window.matchMedia(q).addEventListener?.("change", update);
  update();
}

if (typeof document !== "undefined") {
  // A phone sheet's height, for the map buttons: locate rides above an open sheet and steps aside from a full one.
  let last: string | null = null;
  actor.subscribe(() => {
    const c = context();
    const h = c.size === "wide" ? null : sheetHeight(c);
    const value = h === "half" ? "open" : h === "full" ? "full" : null;
    if (value === last) return;
    last = value;
    if (value) document.documentElement.dataset.pullSheet = value;
    else delete document.documentElement.dataset.pullSheet;
  });
}
