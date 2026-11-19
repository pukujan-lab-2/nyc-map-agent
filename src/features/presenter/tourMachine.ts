/**
 * The tour: one statechart over the spine (docs/specs/PRESENTER_SDD.md).
 * The machine owns where the visitor is, what is legal, and what a detour
 * must restore. It never touches the DOM, the network, or the pet — the
 * renderer subscribes and acts. Every invariant here is a validation
 * relation in docs/specs/PRESENTER_VALIDATION.md.
 *
 * States: touring (on the spine), detour (a question moved the visitor; the
 * exact interrupted state is in context.detour), asking (a live answer is in
 * flight). The detour state is entered only when a snapshot exists, so the
 * advance button can never strand the visitor.
 */
import { assign, setup } from "xstate";
import { SPINE, chapter, legalView } from "./spine";
import { resolveQuestion, type BankEntry, type Resolution } from "./router";

export interface Snapshot { chapter: number; view: string; clipTime: number; playing: boolean }
export interface Answer { text: string; label: string; sources?: Array<{ title: string; page?: number | null }> }

export interface TourContext {
  bank: readonly BankEntry[];
  chapter: number;
  view: string;
  clipTime: number;
  playing: boolean;
  detour: Snapshot | null;
  pending: { chapter: number; view?: string; priorDetour: Snapshot | null } | null;
  answer: Answer | null;
  offer: number[] | null;
  askKind: "none" | "smalltalk" | "live";
  menuOpen: boolean;
  sound: boolean;
  live: boolean;
  restartOffered: boolean;
}

export type TourEvent =
  | { type: "ADVANCE" }
  | { type: "BACK" }
  | { type: "RESUME" }
  | { type: "RESTART" }
  | { type: "JUMP"; chapter: number; view?: string }
  | { type: "SET_VIEW"; view: string }
  | { type: "ASK"; text: string; chatMatch?: boolean }
  | { type: "SMALLTALK"; text: string; label?: string }
  | { type: "ANSWER"; text: string; chapter?: number; view?: string; label?: string; sources?: Answer["sources"] }
  | { type: "FAIL"; text?: string }
  | { type: "ABORT" }
  | { type: "CLIP_STATE"; time: number; playing: boolean }
  | { type: "MENU"; open: boolean }
  | { type: "SOUND"; on: boolean }
  | { type: "LIVE"; on: boolean };

const FALLBACK = "I can’t answer that one from what we’ve measured. Here’s what I can show you:";
const OFFER = [8, 9, 12, 17];
const snapshot = (c: TourContext): Snapshot => ({ chapter: c.chapter, view: c.view, clipTime: c.clipTime, playing: c.playing });

const enterChapter = (c: TourContext, to: number, view?: string): TourContext => {
  const ch = chapter(to);
  if (!ch) return c;
  const v = view && legalView(to, view) ? view : ch.views[0];
  return { ...c, chapter: to, view: v, clipTime: 0, playing: false, menuOpen: false, offer: null, restartOffered: false };
};

const advanceCtx = (c: TourContext): TourContext => {
  if (c.chapter >= SPINE.length - 1) {
    return c.restartOffered
      ? { ...c, chapter: 0, view: SPINE[0].views[0], clipTime: 0, playing: false, detour: null, answer: null, offer: null, restartOffered: false, menuOpen: false, askKind: "none" as const }
      : { ...c, restartOffered: true, answer: { text: "That’s the whole story. Press again to start over, or ask me anything.", label: "Design Baker" }, menuOpen: false };
  }
  return { ...enterChapter(c, c.chapter + 1), detour: null, pending: null, answer: null, askKind: "none" as const };
};

const restartCtx = (c: TourContext): TourContext => ({
  ...c, chapter: 0, view: SPINE[0].views[0], clipTime: 0, playing: false,
  detour: null, pending: null, answer: null, offer: null, askKind: "none" as const, menuOpen: false, restartOffered: false,
});

const resumeCtx = (c: TourContext): TourContext => {
  const s = c.detour;
  if (!s) return { ...c, menuOpen: false, askKind: "none" as const };
  return {
    ...c, chapter: s.chapter, view: s.view, clipTime: s.clipTime, playing: s.playing,
    detour: null, pending: null, answer: { text: "We’re back where you left off.", label: "Design Baker" },
    offer: null, askKind: "none" as const, menuOpen: false, restartOffered: false,
  };
};

/** Apply one resolution. `keepDetour` preserves an existing snapshot (a second question mid-detour). */
function applyAsk(c: TourContext, r: Resolution, keepDetour: boolean): { ctx: TourContext; state: "touring" | "detour" | "asking" } {
  const stay = keepDetour && c.detour ? "detour" : "touring";
  switch (r.kind) {
    case "advance": return { ctx: advanceCtx(c), state: "touring" };
    case "restart": return { ctx: restartCtx(c), state: "touring" };
    case "back": return keepDetour && c.detour
      ? { ctx: resumeCtx(c), state: "touring" }
      : { ctx: c.chapter > 0 ? enterChapter({ ...c, answer: null }, c.chapter - 1) : c, state: "touring" };
    case "resume": return { ctx: resumeCtx(c), state: "touring" };
    case "smalltalk": return { ctx: { ...c, askKind: "smalltalk", menuOpen: false }, state: stay };
    case "explain": {
      const text = chapter(c.chapter)?.direction ?? "";
      return { ctx: { ...c, askKind: "none" as const, answer: { text, label: "Design Baker · Prepared" }, menuOpen: false }, state: stay };
    }
    case "view":
      return { ctx: { ...c, view: r.view, clipTime: 0, playing: false, askKind: "none" as const, menuOpen: false }, state: stay };
    case "navigate": {
      const target = chapter(r.chapter) ? r.chapter : c.chapter;
      const moved = target !== c.chapter || (!!r.view && r.view !== c.view);
      if (r.answer) {
        const base: TourContext = { ...c, detour: moved && !keepDetour ? snapshot(c) : c.detour, offer: null };
        const next = enterChapter(base, target, r.view);
        return { ctx: { ...next, askKind: "none" as const, answer: { text: r.answer, label: "Design Baker · Prepared" } }, state: next.detour ? "detour" : "touring" };
      }
      if (!moved) {
        // Same place: keep the exact view and time; live only adds words and sources.
        const same: TourContext = { ...c, menuOpen: false, offer: null, restartOffered: false };
        return c.live
          ? { ctx: { ...same, askKind: "live", pending: { chapter: target, view: r.view, priorDetour: c.detour }, answer: null }, state: "asking" }
          : { ctx: { ...same, askKind: "none" as const, answer: null }, state: stay };
      }
      if (!c.live) {
        const base: TourContext = { ...c, detour: keepDetour ? c.detour : snapshot(c), offer: null };
        const next = enterChapter(base, target, r.view);
        return { ctx: { ...next, askKind: "none" as const, answer: null }, state: next.detour ? "detour" : "touring" };
      }
      // Live: hold position until the answer arrives (M9); the move happens in answerArrived.
      return { ctx: { ...c, askKind: "live", pending: { chapter: target, view: r.view, priorDetour: c.detour }, answer: null, menuOpen: false, offer: null }, state: "asking" };
    }
    case "unknown":
      return { ctx: { ...c, askKind: "none" as const, answer: { text: FALLBACK, label: "Design Baker" }, offer: r.offer, menuOpen: false }, state: stay };
  }
}

const resolve = (c: TourContext, e: TourEvent): Resolution | null =>
  e.type === "ASK" ? resolveQuestion(e.text, c.chapter, c.bank, e.chatMatch) : null;

export const tourMachine = setup({
  types: {
    context: {} as TourContext,
    events: {} as TourEvent,
    input: {} as { bank?: readonly BankEntry[]; live?: boolean },
  },
  guards: {
    validJump: ({ event }) => event.type === "JUMP" && !!chapter(event.chapter),
    legalViewHere: ({ context, event }) => event.type === "SET_VIEW" && legalView(context.chapter, event.view),
    canBack: ({ context }) => context.chapter > 0,
    hasDetour: ({ context }) => !!context.detour,
    askAsks: ({ context, event }) => { const r = resolve(context, event); return !!r && !["advance", "back", "resume", "restart"].includes(r.kind); },
    askControl: ({ context, event }) => { const r = resolve(context, event); return !!r && ["advance", "resume", "restart"].includes(r.kind); },
    askLive: ({ context, event }) => { const r = resolve(context, event); return !!r && applyAsk(context, r, !!context.detour).state === "asking"; },
    askDetour: ({ context, event }) => { const r = resolve(context, event); return !!r && applyAsk(context, r, !!context.detour).state === "detour"; },
    answerMoves: ({ context, event }) => {
      if (event.type !== "ANSWER") return false;
      const target = event.chapter !== undefined ? event.chapter - 1 : context.pending?.chapter;
      return target !== undefined && !!chapter(target) && (target !== context.chapter || !!event.view);
    },
  },
  actions: {
    advance: assign(({ context }) => advanceCtx(context)),
    back: assign(({ context }) => enterChapter({ ...context, answer: null }, Math.max(0, context.chapter - 1))),
    resume: assign(({ context }) => resumeCtx(context)),
    restart: assign(({ context }) => restartCtx(context)),
    jump: assign(({ context, event }) => {
      if (event.type !== "JUMP" || !chapter(event.chapter)) return context;
      // A deliberate jump commits to the new place; questions keep the return point (M4).
      return { ...enterChapter(context, event.chapter, event.view), detour: null, pending: null, answer: null, askKind: "none" as const };
    }),
    setView: assign(({ context, event }) => event.type === "SET_VIEW" && legalView(context.chapter, event.view)
      ? { ...context, view: event.view, clipTime: 0, playing: false, menuOpen: false } : context),
    ask: assign(({ context, event }) => {
      const r = resolve(context, event);
      return r ? applyAsk(context, r, !!context.detour).ctx : context;
    }),
    answerArrived: assign(({ context, event }) => {
      if (event.type !== "ANSWER") return context;
      const target = event.chapter !== undefined ? event.chapter - 1 : context.pending?.chapter;
      const answer: Answer = { text: event.text, label: event.label ?? "Design Baker · Live", sources: event.sources };
      const prior = context.pending?.priorDetour ?? null;
      // Invalid chapter, or same chapter with no new view: words only, position untouched (M5, M9).
      if (target === undefined || !chapter(target) || (target === context.chapter && !event.view)) {
        return { ...context, pending: null, askKind: "none" as const, detour: prior, answer };
      }
      const next = enterChapter(context, target, event.view ?? context.pending?.view);
      return { ...next, detour: prior ?? snapshot(context), pending: null, askKind: "none" as const, answer };
    }),
    failed: assign(({ context, event }) => ({
      ...context, pending: null, askKind: "none" as const, detour: context.pending?.priorDetour ?? context.detour,
      answer: { text: event.type === "FAIL" && event.text ? event.text : FALLBACK, label: "Design Baker · Prepared" },
      offer: OFFER,
    })),
    aborted: assign(({ context }) => ({ ...context, pending: null, askKind: "none" as const, detour: context.pending?.priorDetour ?? context.detour })),
    smalltalkAnswer: assign(({ event }) => event.type === "SMALLTALK" ? { answer: { text: event.text, label: event.label ?? "Design Baker" }, askKind: "none" as const } : {}),
    clipState: assign(({ event }) => event.type === "CLIP_STATE" ? { clipTime: event.time, playing: event.playing } : {}),
    menu: assign(({ event }) => event.type === "MENU" ? { menuOpen: event.open } : {}),
    sound: assign(({ event }) => event.type === "SOUND" ? { sound: event.on } : {}),
    live: assign(({ event }) => event.type === "LIVE" ? { live: event.on } : {}),
  },
}).createMachine({
  id: "tour",
  context: ({ input }) => ({
    bank: input.bank ?? [],
    chapter: 0, view: SPINE[0].views[0], clipTime: 0, playing: false,
    detour: null, pending: null, answer: null, offer: null,
    askKind: "none" as const, menuOpen: false, sound: true, live: input.live ?? false, restartOffered: false,
  }),
  initial: "touring",
  on: {
    CLIP_STATE: { actions: "clipState" },
    MENU: { actions: "menu" },
    SOUND: { actions: "sound" },
    LIVE: { actions: "live" },
  },
  states: {
    touring: {
      on: {
        ADVANCE: { actions: "advance" },
        BACK: { guard: "canBack", actions: "back" },
        RESTART: { actions: "restart" },
        JUMP: { guard: "validJump", actions: "jump" },
        SET_VIEW: { guard: "legalViewHere", actions: "setView" },
        ASK: [
          { guard: "askLive", actions: "ask", target: "asking" },
          { guard: "askDetour", actions: "ask", target: "detour" },
          { guard: "askControl", actions: "ask", target: "touring" },
          { guard: "askAsks", actions: "ask" },
          { actions: "ask" },
        ],
        SMALLTALK: { actions: "smalltalkAnswer" },
      },
    },
    detour: {
      on: {
        ADVANCE: { actions: "resume", target: "touring" },
        BACK: { actions: "resume", target: "touring" },
        RESUME: { actions: "resume", target: "touring" },
        RESTART: { actions: "restart", target: "touring" },
        JUMP: { guard: "validJump", actions: "jump", target: "touring" },
        SET_VIEW: { guard: "legalViewHere", actions: "setView" },
        ASK: [
          { guard: "askLive", actions: "ask", target: "asking" },
          { guard: "askControl", actions: "ask", target: "touring" },
          { guard: "askAsks", actions: "ask" },
          { actions: "ask" },
        ],
        SMALLTALK: { actions: "smalltalkAnswer" },
      },
    },
    asking: {
      on: {
        ADVANCE: { actions: "advance", target: "touring" },
        ANSWER: [
          { guard: "answerMoves", actions: "answerArrived", target: "detour" },
          { guard: "hasDetour", actions: "answerArrived", target: "detour" },
          { actions: "answerArrived", target: "touring" },
        ],
        FAIL: [
          { guard: "hasDetour", actions: "failed", target: "detour" },
          { actions: "failed", target: "touring" },
        ],
        ABORT: [
          { guard: "hasDetour", actions: "aborted", target: "detour" },
          { actions: "aborted", target: "touring" },
        ],
        ASK: [
          { guard: "askLive", actions: "ask" },
          { guard: "askControl", actions: "ask", target: "touring" },
          { guard: "hasDetour", actions: "ask", target: "detour" },
          { actions: "ask", target: "touring" },
        ],
        RESUME: { actions: "resume", target: "touring" },
        RESTART: { actions: "restart", target: "touring" },
        BACK: [
          { guard: "hasDetour", actions: "resume", target: "touring" },
          { target: "touring" },
        ],
      },
    },
  },
});