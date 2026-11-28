import { assign, setup } from "xstate";
import type { SheetLevel } from "@/components/sheetSwipe";

/**
 * What the one sheet shows (docs/DESIGN_RULES.md, "Every panel opens in one place"; issue #145).
 * A phone's bottom sheet and, from 640 px, the left card are the same stack of views. This one
 * machine decides:
 *
 * - which view is in the sheet: the newest, or one raised again by its id or tag; the ones under
 *   it stay mounted and draw nothing, so two panels never stack;
 * - the Back stack (closing the top view shows the one under it) and Close (every view, newest first);
 * - how high the sheet is: the top view's peek, half or full;
 * - the navigation banner at the top while walking or following: the newest one shows;
 * - who gets the screen (docs/PDD.md, "Screen space: who wins and what closes what"): the answer
 *   folds to its chip while a task runs or a menu is open, the line panel folds to its pill on a
 *   phone under the answer or the orb, and a task, the orb or a line closes an open menu;
 * - the details slot (the More layers drawer and the details sheet: one at a time, minimised to a
 *   chip, Esc and Back close the top one first);
 * - the one open dropdown, and the left card's portal targets from 640 px.
 *
 * Pure: the running actor, its React hooks and what it writes to the page live in ./sheet.ts.
 */

export type ScreenSize = "small" | "phone" | "wide";
export type OpenMenu = "myDay" | "layers" | "filters" | "data" | "cityData" | "settings" | "view" | null;
export type NavBanner = "walk" | "follow";
type SheetHeight = "peek" | "half" | "full";

interface SheetView {
  id: number;
  close: () => void;
  /** A name another part of the app raises this view by (say "line:7"). */
  tag?: string;
  /** The height this view asks for; the answer card has none. */
  level?: SheetLevel;
}

/** The details slot: the More layers drawer and the details sheet share it. */
export interface SlotState {
  drawerOpen: boolean;
  /** A details sheet is in the slot (its content lives in PanelContext). */
  sheet: boolean;
  /** The sheet is folded down to its peek chip. */
  minimized: boolean;
}

export const EMPTY_SLOT: SlotState = { drawerOpen: false, sheet: false, minimized: false };

export type SlotAction =
  | { type: "showSheet" }
  | { type: "closeSheet" }
  | { type: "openDrawer" }
  | { type: "closeDrawer" }
  | { type: "toggleDrawer" }
  | { type: "minimize" }
  | { type: "restore" }
  | { type: "emptyTap" }
  | { type: "dismissTop" };

/** The left card from 640 px: where the top view and the status chips print, and whether it is drawn. */
export interface LeftColumn {
  slot: HTMLElement | null;
  sheet: boolean;
  chips: HTMLElement | null;
}

export interface SheetContext {
  views: readonly SheetView[];
  /** Until then, the next view to open goes under the one showing instead of over it. */
  underUntil: number;
  slot: SlotState;
  menu: OpenMenu;
  column: LeftColumn;
  banners: readonly NavBanner[];
  size: ScreenSize;
  task: boolean;
  voice: boolean;
  answer: boolean;
  line: boolean;
  /** The person tapped the answer's chip (or sent a question) since the last fold. */
  answerReveal: boolean;
  /** The person tapped the line pill since the last fold. */
  lineReveal: boolean;
}

export type SheetEvent =
  | { type: "OPEN"; id: number; close: () => void; tag?: string; now: number }
  | { type: "RELEASE"; id: number }
  | { type: "RAISE"; id: number }
  | { type: "RAISE_TAG"; tag: string }
  | { type: "OPEN_UNDER"; now: number }
  | { type: "LEVEL"; id: number; level: SheetLevel }
  | { type: "SLOT"; action: SlotAction }
  | { type: "MENU"; menu: OpenMenu }
  | { type: "LEFT"; column: Partial<LeftColumn> }
  | { type: "BANNER"; banner: NavBanner; on: boolean }
  | { type: "SIZE"; size: ScreenSize }
  | { type: "TASK" | "VOICE" | "ANSWER" | "LINE"; on: boolean }
  | { type: "SEND" | "SHOW_ANSWER" | "SHOW_LINE" };

/** The event types that only report a screen fact: AgentOverlay and LinePanel send these. */
export type ScreenEvent = Extract<SheetEvent, { type: "SIZE" | "TASK" | "VOICE" | "ANSWER" | "LINE" | "SEND" | "SHOW_ANSWER" | "SHOW_LINE" }>;

export function slotReducer(s: SlotState, a: SlotAction): SlotState {
  switch (a.type) {
    case "showSheet":
      return { drawerOpen: false, sheet: true, minimized: false };
    case "closeSheet":
      return s.sheet ? { ...s, sheet: false, minimized: false } : s;
    case "openDrawer":
      return s.drawerOpen ? s : { ...s, drawerOpen: true };
    case "closeDrawer":
      return s.drawerOpen ? { ...s, drawerOpen: false } : s;
    case "toggleDrawer":
      return { ...s, drawerOpen: !s.drawerOpen };
    case "minimize":
      return s.sheet ? { ...s, minimized: true } : s;
    case "restore":
      return s.sheet ? { drawerOpen: false, sheet: true, minimized: false } : s;
    case "emptyTap":
      if (s.drawerOpen) return s;
      return s.sheet ? { ...s, sheet: false, minimized: false } : s;
    case "dismissTop":
      if (s.drawerOpen) return { ...s, drawerOpen: false };
      if (s.sheet) return { ...s, sheet: false, minimized: false };
      return s;
  }
}

/** What Esc / Back acts on next: the top panel, then the active mode. */
export function escapeTarget(s: SlotState, modeActive: boolean): "drawer" | "sheet" | "mode" | null {
  if (s.drawerOpen) return "drawer";
  if (s.sheet) return "sheet";
  return modeActive ? "mode" : null;
}

/** The label on a minimised sheet's chip, e.g. "Q · 2 min". */
export function peekChipLabel(title: string, peek?: string): string {
  return peek?.trim() || title;
}

/** Where a view sits: whether it is the one showing, and whether another waits under it. */
export function viewPlace(c: SheetContext, id: number | null): { top: boolean; below: boolean } {
  if (id === null) return { top: false, below: false };
  return { top: c.views.at(-1)?.id === id, below: c.views.findIndex((v) => v.id === id) > 0 };
}

/** How high the sheet stands: the top view's height, or null when that view sets none. */
export function sheetHeight(c: SheetContext): SheetHeight | null {
  const level = c.views.at(-1)?.level;
  return level === undefined ? null : level === 0 ? "peek" : level === 1 ? "half" : "full";
}

/** The navigation banner that shows: the newest one up. */
export function shownBanner(c: SheetContext): NavBanner | null {
  return c.banners.at(-1) ?? null;
}

const raise = (views: readonly SheetView[], id: number | undefined): readonly SheetView[] => {
  const v = views.find((x) => x.id === id);
  if (!v || views.at(-1)?.id === id) return views;
  return [...views.filter((x) => x.id !== id), v];
};

const menuUp = (c: SheetContext) => c.menu !== null;
const answerFolds = (c: SheetContext) => !c.answerReveal && (c.task || menuUp(c) || (c.size === "small" && c.line && c.lineReveal));
const answerOpen = (c: SheetContext) => c.answer && !answerFolds(c);
const lineFolds = (c: SheetContext) => c.size !== "wide" && !c.lineReveal && (answerOpen(c) || c.voice);

const rising = (key: "task" | "voice" | "line") => ({ context: c, event: e }: { context: SheetContext; event: SheetEvent }) =>
  "on" in e && e.on && !c[key];

export const sheetMachine = setup({
  types: { context: {} as SheetContext, events: {} as SheetEvent, input: {} as Partial<SheetContext> },
  actions: { menuShut: assign({ menu: null }) },
  guards: {
    answerShows: ({ context }) => answerOpen(context),
    answerFolds: ({ context }) => context.answer && answerFolds(context),
    lineShows: ({ context }) => context.line && !lineFolds(context),
    lineFolds: ({ context }) => context.line && lineFolds(context),
  },
}).createMachine({
  id: "sheet",
  context: ({ input }) => ({
    views: [],
    underUntil: 0,
    slot: EMPTY_SLOT,
    menu: null,
    column: { slot: null, sheet: false, chips: null },
    banners: [],
    size: "phone",
    task: false,
    voice: false,
    answer: false,
    line: false,
    answerReveal: false,
    lineReveal: false,
    ...input,
  }),
  type: "parallel",
  on: {
    // A view came up: it goes on top, or under the one showing when OPEN_UNDER asked within a second.
    OPEN: {
      actions: assign(({ context: c, event: e }) => {
        const view: SheetView = { id: e.id, close: e.close, tag: e.tag };
        const under = e.now < c.underUntil && c.views.length > 0;
        return { underUntil: 0, views: under ? [...c.views.slice(0, -1), view, c.views.at(-1)!] : [...c.views, view] };
      }),
    },
    RELEASE: { actions: assign({ views: ({ context, event }) => context.views.filter((v) => v.id !== event.id) }) },
    RAISE: { actions: assign({ views: ({ context, event }) => raise(context.views, event.id) }) },
    RAISE_TAG: { actions: assign({ views: ({ context, event }) => raise(context.views, context.views.find((v) => v.tag === event.tag)?.id) }) },
    OPEN_UNDER: { actions: assign({ underUntil: ({ event }) => event.now + 1000 }) },
    LEVEL: {
      guard: ({ context, event }) => context.views.some((v) => v.id === event.id && v.level !== event.level),
      actions: assign({ views: ({ context, event }) => context.views.map((v) => (v.id === event.id ? { ...v, level: event.level } : v)) }),
    },
    SLOT: { actions: assign({ slot: ({ context, event }) => slotReducer(context.slot, event.action) }) },
    MENU: [
      { guard: ({ context, event }) => event.menu !== null && context.menu === null, actions: assign({ menu: ({ event }) => event.menu, answerReveal: false }) },
      { actions: assign({ menu: ({ event }) => event.menu }) },
    ],
    LEFT: {
      guard: ({ context, event }) => Object.entries(event.column).some(([k, v]) => context.column[k as keyof LeftColumn] !== v),
      actions: assign({ column: ({ context, event }) => ({ ...context.column, ...event.column }) }),
    },
    BANNER: {
      actions: assign({
        banners: ({ context, event }) => {
          const rest = context.banners.filter((b) => b !== event.banner);
          return event.on ? [...rest, event.banner] : rest;
        },
      }),
    },
    SIZE: { actions: assign({ size: ({ event }) => event.size }) },
    TASK: [
      { guard: rising("task"), actions: [assign({ task: true, answerReveal: false }), "menuShut"] },
      { actions: assign({ task: ({ event }) => event.on }) },
    ],
    VOICE: [
      { guard: rising("voice"), actions: [assign({ voice: true, lineReveal: false }), "menuShut"] },
      { actions: assign({ voice: ({ event }) => event.on }) },
    ],
    LINE: [
      { guard: rising("line"), actions: [assign({ line: true, lineReveal: false }), "menuShut"] },
      { actions: assign({ line: ({ event }) => event.on, lineReveal: false }) },
    ],
    // A question the person just sent (SEND) opens its answer even over a task: only a closing answer forgets that.
    ANSWER: { guard: ({ context, event }) => event.on !== context.answer, actions: assign({ answer: ({ event }) => event.on, answerReveal: ({ context, event }) => event.on && context.answerReveal, lineReveal: false }) },
    SEND: { actions: [assign({ answerReveal: true, lineReveal: false }), "menuShut"] },
    SHOW_ANSWER: { actions: [assign({ answerReveal: true, lineReveal: false }), "menuShut"] },
    SHOW_LINE: { actions: assign({ lineReveal: true, answerReveal: false }) },
  },
  states: {
    answer: {
      initial: "none",
      states: {
        none: { always: [{ guard: "answerShows", target: "open" }, { guard: "answerFolds", target: "chip" }] },
        open: { always: [{ guard: "answerFolds", target: "chip" }, { guard: ({ context }) => !context.answer, target: "none" }] },
        chip: { always: [{ guard: "answerShows", target: "open" }, { guard: ({ context }) => !context.answer, target: "none" }] },
      },
    },
    line: {
      initial: "none",
      states: {
        none: { always: [{ guard: "lineShows", target: "open" }, { guard: "lineFolds", target: "pill" }] },
        open: { always: [{ guard: "lineFolds", target: "pill" }, { guard: ({ context }) => !context.line, target: "none" }] },
        pill: { always: [{ guard: "lineShows", target: "open" }, { guard: ({ context }) => !context.line, target: "none" }] },
      },
    },
  },
});

export type ScreenView = { answer: "none" | "open" | "chip"; line: "none" | "open" | "pill" };
