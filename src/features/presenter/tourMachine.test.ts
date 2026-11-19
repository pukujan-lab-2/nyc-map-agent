/**
 * Metamorphic validation of the tour (docs/specs/PRESENTER_VALIDATION.md).
 * M1–M9 and M12 run here over the machine itself: the tests enumerate states
 * and events, so coverage is structural. The first edition shipped 34
 * navigation defects because nothing checked these properties.
 */
import { describe, expect, it } from "vitest";
import { createActor } from "xstate";
import { tourMachine, type TourContext, type TourEvent } from "./tourMachine";
import { SPINE, legalView } from "./spine";
import { resolveQuestion, normalize, type BankEntry } from "./router";
import media from "./media.json";

const BANK = media.bank as BankEntry[];
const start = (live = false) => {
  const actor = createActor(tourMachine, { input: { bank: BANK, live } });
  actor.start();
  return actor;
};
const send = (actor: ReturnType<typeof start>, ...events: TourEvent[]) => {
  for (const e of events) actor.send(e);
  return actor.getSnapshot();
};
const position = (c: TourContext) => ({ chapter: c.chapter, view: c.view, clipTime: c.clipTime, playing: c.playing });

/** A substantive question that navigates away from any chapter except 15. */
const AWAY = "What is the tech stack?";
const AWAY_FROM_15 = "How did Washington do this?";
const awayFrom = (chapter: number) => (chapter === 15 ? AWAY_FROM_15 : AWAY);

describe("M1 — spine reachability and order", () => {
  it("advances through all eighteen chapters in order, then offers restart", () => {
    const actor = start();
    for (let i = 0; i < SPINE.length; i++) {
      const s = actor.getSnapshot();
      expect(s.context.chapter, `step ${i}`).toBe(i);
      expect(SPINE[i].nextLabel).toBeTruthy();
      actor.send({ type: "ADVANCE" });
    }
    const end = actor.getSnapshot();
    expect(end.context.chapter).toBe(17);
    expect(end.context.restartOffered).toBe(true);
    actor.send({ type: "ADVANCE" });
    expect(actor.getSnapshot().context.chapter).toBe(0);
    expect(actor.getSnapshot().context.restartOffered).toBe(false);
  });
});

describe("M2 — no dead ends, exhaustive", () => {
  it("every reachable state has a working advance and a way back, and every chapter is reachable", () => {
    // One representative per resolution class; M6 checks every suggestion and bank entry,
    // and the journey suite taps them all in the browser.
    const questions = [
      "What is the tech stack?",            // bank navigate
      "how did other countries do this?",   // topic navigate
      "show the pressure readings",         // view command
      "what do I do here?",                 // stop direction
      "hello",                              // small talk
      "why?",                               // continuation
      "take me to the mezzanine",           // composed navigate
      "keep going",                         // control advance
      "go back",                            // control back
      "resume",                             // control resume
      "start over",                         // control restart
      "nonsense words zzz",                 // unknown
    ];
    const alphabet: TourEvent[] = [
      { type: "ADVANCE" }, { type: "BACK" }, { type: "RESUME" }, { type: "RESTART" },
      { type: "FAIL" }, { type: "ABORT" },
      { type: "ANSWER", text: "live answer", chapter: 12 },
      { type: "ANSWER", text: "bad chapter", chapter: 99 },
      // MENU, SOUND and CLIP_STATE are independent flags no guard reads; M3 covers clip
      // identity exhaustively and M10/M11 cover menu rendering. LIVE changes branching, so it stays.
      { type: "LIVE", on: true }, { type: "LIVE", on: false },
      ...SPINE.map((c) => ({ type: "JUMP", chapter: c.id }) as TourEvent),
      // Representative views; M5 checks every chapter's full view set for legality.
      ...["walk", "map", "splat", "data", "washington", "video"].map((v) => ({ type: "SET_VIEW", view: v }) as TourEvent),
      ...questions.map((text) => ({ type: "ASK", text }) as TourEvent),
    ];
    // For dead-end legality only the SHAPE of memory matters (is there a snapshot, is there a
    // pending target), not its values — M3 proves value identity exhaustively on its own.
    const key = (ctx: TourContext, value: unknown) => JSON.stringify([
      value, ctx.chapter, ctx.view, !!ctx.detour,
      ctx.pending ? [ctx.pending.chapter, ctx.pending.view ?? null, !!ctx.pending.priorDetour] : null,
      ctx.askKind, ctx.restartOffered, ctx.offer, ctx.live,
    ]);
    // BFS over persisted snapshots: each edge restores an actor, sends one event, persists again.
    const step = (persisted: unknown, e: TourEvent) => {
      const a = createActor(tourMachine, { snapshot: persisted as never, input: { bank: BANK } });
      a.start();
      a.send(e);
      const snap = a.getSnapshot();
      const out = { persisted: a.getPersistedSnapshot(), ctx: snap.context, value: snap.value, status: snap.status };
      a.stop();
      return out;
    };
    const first = start();
    const initial = { persisted: first.getPersistedSnapshot(), ctx: first.getSnapshot().context, value: first.getSnapshot().value, status: first.getSnapshot().status };
    first.stop();
    const seen = new Map<string, typeof initial>();
    const queue = [initial];
    seen.set(key(initial.ctx, initial.value), initial);
    const reachedChapters = new Set<number>([0]);
    let deadEnds = 0;
    while (queue.length && seen.size < 40_000) {
      const s = queue.shift()!;
      reachedChapters.add(s.ctx.chapter);
      // The advance must always do something: move, resume, or offer restart.
      const advanced = step(s.persisted, { type: "ADVANCE" });
      if (advanced.status !== "done" && key(advanced.ctx, advanced.value) === key(s.ctx, s.value)) deadEnds++;
      expect(deadEnds, `dead end at ${JSON.stringify(position(s.ctx))} state ${JSON.stringify(s.value)}`).toBe(0);
      for (const e of alphabet) {
        const next = step(s.persisted, e);
        if (next.status === "done") continue;
        const k = key(next.ctx, next.value);
        if (!seen.has(k)) { seen.set(k, next); queue.push(next); }
      }
    }
    expect(seen.size).toBeLessThan(40_000);
    expect([...reachedChapters].sort((a, b) => a - b)).toEqual(SPINE.map((c) => c.id));
  }, 180_000);
});

describe("M3 — resume identity", () => {
  it("restores chapter, view, time and playing exactly, for every chapter and view", () => {
    for (const c of SPINE) {
      for (const view of c.views) {
        for (const time of [0, 2.5]) {
          for (const playing of [false, true]) {
            const actor = start();
            send(actor, { type: "JUMP", chapter: c.id }, { type: "SET_VIEW", view }, { type: "CLIP_STATE", time, playing });
            const before = position(actor.getSnapshot().context);
            const s = send(actor, { type: "ASK", text: awayFrom(c.id) });
            expect(s.context.detour, `detour taken from ${c.id}/${view}`).not.toBeNull();
            const back = send(actor, { type: "RESUME" });
            expect(position(back.context), `resume ${c.id}/${view}/${time}/${playing}`).toEqual(before);
            expect(back.context.detour).toBeNull();
            expect(back.value).toBe("touring");
          }
        }
      }
    }
  });
  it("small talk never moves the tour or creates a detour", () => {
    for (const text of ["hello", "how are you?", "what's the weather in Union Square?", "we're presenting at the hackathon"]) {
      const actor = start();
      send(actor, { type: "JUMP", chapter: 4 }, { type: "SET_VIEW", view: "walk" }, { type: "CLIP_STATE", time: 2, playing: false });
      const before = position(actor.getSnapshot().context);
      const s = send(actor, { type: "ASK", text, chatMatch: true });
      expect(position(s.context)).toEqual(before);
      expect(s.context.detour).toBeNull();
      expect(s.context.askKind).toBe("smalltalk");
    }
  });
});

describe("M4 — detour persistence", () => {
  it("a second question keeps the original return point; a deliberate jump commits; restart clears it", () => {
    const actor = start();
    send(actor, { type: "JUMP", chapter: 8 }, { type: "SET_VIEW", view: "map" }, { type: "CLIP_STATE", time: 3, playing: true });
    const origin = position(actor.getSnapshot().context);
    send(actor, { type: "ASK", text: AWAY });
    send(actor, { type: "ASK", text: "How did Washington do this?" });
    expect(position(send(actor, { type: "RESUME" }).context)).toEqual(origin);
    send(actor, { type: "ASK", text: AWAY });
    const jumped = send(actor, { type: "JUMP", chapter: 12 });
    expect(jumped.context.detour).toBeNull();
    expect(jumped.value).toBe("touring");
    expect(send(actor, { type: "ADVANCE" }).context.chapter).toBe(13);
    send(actor, { type: "ASK", text: AWAY });
    const restarted = send(actor, { type: "RESTART" });
    expect(restarted.context.detour).toBeNull();
    expect(restarted.context.chapter).toBe(0);
  });
});

describe("M5 — view and mode preservation", () => {
  it("accepts exactly the declared views and rejects the rest", () => {
    for (const c of SPINE) {
      const actor = start();
      send(actor, { type: "JUMP", chapter: c.id });
      let current = c.views[0];
      for (const v of c.views) { current = v; expect(send(actor, { type: "SET_VIEW", view: v }).context.view).toBe(v); }
      for (const bad of ["walk", "splat", "data", "map", "video", "washington"]) {
        if (c.views.includes(bad)) continue;
        const s = send(actor, { type: "SET_VIEW", view: bad });
        expect(s.context.view, `${c.id} must reject ${bad}`).toBe(current);
      }
    }
  });
  it("a same-chapter live answer preserves the view; a continuation explains the current chapter", () => {
    const actor = start(true);
    send(actor, { type: "JUMP", chapter: 8 }, { type: "SET_VIEW", view: "map" });
    const s = send(actor, { type: "ASK", text: "How far off was GPS?" });
    expect(s.value).toBe("asking");
    const answered = send(actor, { type: "ANSWER", text: "14.4 m with GPS, 160.5 m without.", chapter: 9 });
    expect(answered.context.chapter).toBe(8);
    expect(answered.context.view).toBe("map");
    const explained = send(start(), { type: "JUMP", chapter: 12 }, { type: "ASK", text: "tell me more" });
    expect(explained.context.chapter).toBe(12);
    expect(explained.context.answer?.label).toContain("Prepared");
  });
});

describe("M6 — router totality", () => {
  it("every suggestion resolves to a legal chapter and view, never unknown", () => {
    for (const c of SPINE) {
      for (const text of c.suggestions) {
        const r = resolveQuestion(text, c.id, BANK);
        expect(r.kind, `suggestion "${text}" at ${c.id}`).not.toBe("unknown");
        if (r.kind === "navigate") {
          expect(SPINE[r.chapter], `target of "${text}"`).toBeTruthy();
          if (r.view) expect(legalView(r.chapter, r.view), `view ${r.view} of "${text}"`).toBe(true);
        }
        if (r.kind === "view") expect(legalView(c.id, r.view)).toBe(true);
      }
    }
  });
  it("every bank entry lands on a real chapter", () => {
    for (const b of BANK) {
      const r = resolveQuestion(b.question, 0, BANK);
      expect(r.kind, b.question).toBe("navigate");
      if (r.kind === "navigate") expect(SPINE[r.chapter], b.question).toBeTruthy();
    }
  });
  it("composed intents, cities without names, and the audit's dead phrasings resolve", () => {
    const cases: Array<[string, number, number]> = [
      ["take me to Union Square", 0, 3],
      ["go back to the elevator", 8, 3],
      ["how did other countries do this?", 0, 14],
      ["waymap", 0, 14],
      ["what is the tech stack?", 6, 15],
      ["what did the AI actually do?", 4, 16],
      ["show me the sign match", 16, 9],
      ["how does this become 3D?", 11, 12],
      ["how was this made?", 12, 12],
      ["what do I do here?", 2, 2],
    ];
    for (const [text, from, to] of cases) {
      const r = resolveQuestion(text, from, BANK);
      if (text === "what do I do here?") { expect(r.kind).toBe("explain"); continue; }
      expect(r.kind, text).toBe("navigate");
      if (r.kind === "navigate") expect(r.chapter, text).toBe(to);
    }
    expect(normalize("  What’s  the STACK? ")).toBe("whats the stack");
  });
  it("an unknown question offers tappable chapters", () => {
    const actor = start();
    const s = send(actor, { type: "ASK", text: "zzz nonsense qqq" });
    expect(s.context.offer?.length).toBeGreaterThan(0);
    for (const target of s.context.offer ?? []) {
      const jumped = send(actor, { type: "JUMP", chapter: target });
      expect(jumped.context.chapter).toBe(target);
    }
  });
});

describe("M8 — back semantics", () => {
  it("back undoes advance on the spine, is a no-op at the start, and resumes in a detour", () => {
    const actor = start();
    const s0 = actor.getSnapshot();
    send(actor, { type: "BACK" });
    expect(actor.getSnapshot().context.chapter).toBe(0);
    for (let i = 0; i < 5; i++) actor.send({ type: "ADVANCE" });
    expect(send(actor, { type: "BACK" }).context.chapter).toBe(4);
    send(actor, { type: "ASK", text: AWAY });
    const origin = 4;
    expect(send(actor, { type: "BACK" }).context.chapter).toBe(origin);
    // Typed "go back" in a detour resumes too, like the button.
    send(actor, { type: "ASK", text: AWAY });
    expect(send(actor, { type: "ASK", text: "go back" }).context.chapter).toBe(origin);
    expect(s0.context.chapter).toBe(0);
  });
});

describe("M9 — live answer safety", () => {
  it("an invalid chapter changes the words only; failure offers actions, never silence", () => {
    const actor = start(true);
    send(actor, { type: "JUMP", chapter: 4 }, { type: "SET_VIEW", view: "walk" }, { type: "CLIP_STATE", time: 2, playing: false });
    const before = position(actor.getSnapshot().context);
    send(actor, { type: "ASK", text: "what does the barometer measure?" });
    expect(actor.getSnapshot().value).toBe("asking");
    const bad = send(actor, { type: "ANSWER", text: "something", chapter: 99 });
    expect(position(bad.context)).toEqual(before);
    expect(bad.context.answer?.text).toBe("something");
    const failed = send(start(true), { type: "ASK", text: "what does the barometer measure?" }, { type: "FAIL" });
    expect(failed.context.answer?.text).toBeTruthy();
    expect(failed.context.offer?.length).toBeGreaterThan(0);
  });
});

describe("M12 — stop authority", () => {
  it("stop directions answer from the spine with no network ask", () => {
    for (const c of SPINE.filter((x) => x.act === 1 && x.id >= 1 && x.id <= 6)) {
      const actor = start(true);
      send(actor, { type: "JUMP", chapter: c.id });
      const s = send(actor, { type: "ASK", text: "what do I do here?" });
      expect(s.context.askKind, c.title).toBe("none");
      expect(s.context.chapter).toBe(c.id);
      expect(s.context.answer?.text).toBe(c.direction);
    }
  });
});