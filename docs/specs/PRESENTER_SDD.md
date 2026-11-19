# SDD: the presenter tour machine

*System design for the second edition of `/present`, per `docs/presenter/PDD.md`. Written 2026-11-18 before implementation. The proof obligations are in `docs/specs/PRESENTER_VALIDATION.md`. Repo conventions: XState v5 `setup().createMachine` as in `src/lib/screen/screenSpace.ts`, pure decision functions beside the machine, vitest for logic, Playwright for the screen.*

## Why a machine

The first edition kept tour state in six mutable variables (`current`, `bookmarked`, `history`, `guiding`, `actionId`, `live`) and resolved questions with ordered regex tables. Every interaction was a special case over that state; the demo found the combinations nobody had traced. A statechart makes the legal states and transitions explicit, keeps one source of truth for "where the visitor is", and lets us enumerate every reachable state in tests instead of hoping.

## Modules

```
src/features/presenter/
  spine.ts        data only: the 18 chapters in order, each with act, title,
                  views, narration key, suggestions, next label
  router.ts       pure: resolveQuestion(text, chapter) -> Resolution
  tourMachine.ts  XState v5 machine over spine + router
  flow.ts         renderer: subscribes to the actor, draws scenes, drives the
                  pet and media, sends DOM events into the machine
  scenes.ts pet.js chat.js microphone.ts  unchanged in role
```

The server contract does not change: `/api/presenter/{status,ask,chat,weather}` with the same guards, tracing, and answer envelope `{chapter, answer, sources}`. The machine validates the LLM's chapter against the spine; an out-of-range or unknown chapter never moves the tour.

## The spine (spine.ts)

One ordered array, index = chapter id (0–17), per the PDD:

- Act I, the walk: 0 Your trip, 1 Broadway entrance, 2 Uptown platform, 3 Platform elevator, 4 Mezzanine, 5 Street elevator, 6 Street.
- Act II, the technology: 7 First pitch, 8 GPS test, 9 Sign vision, 10 Elevator clue, 11 Pressure, 12 Frames become a place, 13 Fulton simulation, 14 Other cities, 15 The stack, 16 How the AI reads a sign.
- Act III: 17 Build with us.

Each chapter declares: `act`, `title`, `views` (the legal view modes, first is default), `suggestions` (three tappable questions, each verified by the router tests to resolve), `nextLabel`, and its media/narration keys. The walk stops keep their photo, arrow, and original-walk clip; chapter 12 keeps the 3D map / splat / points / pipeline / orbit views; chapter 8 keeps replay video / estimates map. **Views are options within a chapter, never chapters themselves.**

The old scene indices (walk stops 10–14, evidence 1–9) map onto the spine through one table in `scenes.ts`; the server's chapter numbers stay 1-based over the same 18, and `sources.json`/facts are untouched.

## The router (router.ts)

`resolveQuestion(text, currentChapter)` is a pure function returning one of:

- `{kind: "smalltalk"}` — greetings, venue, weather, continuations (the existing `chat.js` intents, moved behind one predicate). The machine answers in place; the tour does not move.
- `{kind: "navigate", chapter, view?}` — a substantive question. Resolution order: exact prepared-bank match → chapter-name/stop-name match → topic table (one compiled table, each entry tested) → command words with a current-chapter clip ("play this part") → `{kind: "unknown"}`.
- `{kind: "resume"}` / `{kind: "back"}` / `{kind: "advance"}` / `{kind: "restart"}` — the control phrases.
- `{kind: "unknown"}` — the machine says so plainly and offers the nearest chapter; it never answers substantively without moving or offering.

City questions (Washington, Singapore, London, Seoul) resolve to chapter 14 with the city view. Every suggestion string in `spine.ts` and every chip target is asserted to resolve by the validation tests — no phrase may depend on regex luck.

## The machine (tourMachine.ts)

Context:

```ts
{
  chapter: number;          // 0..17, the spine position
  view: string;             // one of spine[chapter].views
  clipTime: number;         // seconds into the chapter's clip
  playing: boolean;
  detour: null | { chapter, view, clipTime, playing, question };
  answer: null | { text, label, sources };
  live: boolean;            // status endpoint said haiku is configured
  sound: boolean;
}
```

States (flat, one active at a time):

- `touring` — the visitor is on the spine. Events: `ADVANCE`, `BACK`, `JUMP {chapter}`, `SET_VIEW {view}`, `ASK {text}`, `CLIP_STATE {time, playing}`, `SOUND`, `LIVE {on}`, `RESTART`.
- `detour` — a question moved the visitor off the spine; `context.detour` holds the exact interrupted state. Events: `RESUME` (restore detour fields exactly, clear detour), `ASK` (replace the detour target; the original detour snapshot is kept), `BACK` (= RESUME), `SET_VIEW`, `CLIP_STATE`, `SOUND`.
- `asking` — transient while a live answer is in flight; the tour snapshot is already taken. Events: `ANSWER {text, chapter?, sources, label}` → validate chapter, move if valid, else stay; `FAIL` → prepared fallback answer, stay or move per router; `ABORT` (a newer question or control) → back to the prior state. Small talk resolves synchronously and never leaves `touring`.

Guards: `validChapter` (0 ≤ n < 18), `legalView` (view ∈ spine[chapter].views), `hasDetour`, `isSmalltalk`, `resolved`. Actions are `assign` only; side effects (fetch, speech, pet flight, media) live in `flow.ts`, which subscribes to state changes. The machine never touches the DOM.

Invariants (each is a validation obligation):

1. `chapter` is always a valid spine index; `view` always legal for it.
2. `detour` is non-null exactly in `detour`/`asking` states entered by a question.
3. `RESUME` restores `(chapter, view, clipTime, playing)` to the snapshot, bit for bit.
4. `ADVANCE` from chapter 17 goes to 17's invitation action (restart offer), never silently loops.
5. A live answer with an invalid chapter changes the answer text only, never the position.
6. Small talk never changes `(chapter, view, clipTime, playing)`.

## The renderer (flow.ts)

One actor per page mount (`createActor(tourMachine, {input})`), started in `PresentPage`'s effect, stopped on unmount. The renderer:

- draws `spine[chapter]` via `scenes.ts` on every state change (idempotent draw keyed by chapter+view),
- reports media time/play state back as `CLIP_STATE` (throttled), so the snapshot is always current,
- turns DOM clicks into events: next → ADVANCE, back → BACK/RESUME, menu/chip → JUMP, mode button → SET_VIEW, form submit → ASK,
- performs the pet flight + visible click choreography for JUMP/ANSWER moves (the machine decides; the pet only animates),
- fetches live answers for `asking` and sends ANSWER/FAIL; prepared answers resolve inside the router/machine input,
- speaks via the existing narration clips / `say()`, honoring the sound flag and the original-audio rule.

The old `bookmarked`/`history`/`guiding`/`actionId` variables are deleted; interrupt safety comes from the actor (a new ASK aborts the previous fetch via the renderer's AbortController keyed to the machine's state id).

## Migration and compatibility

- URL deep links `#stop-n` map through the spine table.
- The e2e specs keep their DOM contracts (`#presenter` datasets, control ids); `data-scene` becomes the 1-based spine chapter, and the specs are updated in the same PR with the journey tests.
- The server, media, tracing, QR end screens, and LiveKit draft (#243) are untouched; the draft's `liveVoice.ts` reads the current chapter from the actor instead of the old variable when it lands.

## Defect appendix

The full empirical inventory is `docs/presenter/DEFECT_AUDIT.md`: 34 defects, each mapped above to the rule that eliminates it. The design decisions it forces, beyond the core machine:

- **Menu and view switcher are state, not click side effects.** `menuOpen` lives in context; every transition that leaves the menu state closes it (no exit path can strand it, D10/D11). The view switcher renders **on the stage** as a visible segmented control, not inside the popover (D22). Views are per-chapter declarations; no global mode strings (D34).
- **Progress and chips are generated from the spine** (D23/D24): "n / 18" with the act named, and the opening chips are the spine's evidence chapters — nothing can drift out of date.
- **Prepared stop directions are authoritative** (D13/D15): at a walk stop, "what do I do / where do I go" answers from the stop's own direction without a network round trip; live answers at stops send the real stop id and may only choose the stop itself or a declared evidence chapter.
- **Detour semantics** (D16–D20): a snapshot is taken only when an answer actually moves the visitor; small talk never snapshots; the snapshot survives further questions and direct jumps until RESUME; BACK in a detour is RESUME; BACK on the spine is the previous chapter.
- **The fallback is tappable** (D33): an unknown question renders its offered chapters as action chips that send JUMP.
- **Composed intents** (D26/D27): "go back to X" and "take me to X" resolve against stop and chapter names before topic patterns; navigation intent outranks evidence keywords.
- **Server adjustments** (D30, small, same PR): the ask route's burst limit rises to 20/min/IP for the demo surface (still capped, still traced), and a 429 answer carries a plain "give me a moment" message the client shows honestly instead of a silent prepared fallback. The forced-tool schema's chapter range becomes 1–18 over the spine.
- **Deep links and stale audio** (D21/D31): hashchange is listened to for the page's life; `blockedVoice` is cleared on every transition.

## Risks

- The refactor touches the whole client flow; the journey e2e suite (advance through all 18, ask/resume per act, every chip and suggestion) is the safety net and runs before merge.
- XState adds ~13 kB to the presenter chunk (already in the app via screenSpace, shared); the size budget is checked, raised modestly only if needed and noted in the PR.