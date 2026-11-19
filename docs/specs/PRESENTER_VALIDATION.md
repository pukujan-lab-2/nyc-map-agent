# Metamorphic validation: the presenter tour

*The proof obligations for the second edition of `/present`, per `docs/presenter/PDD.md` and `docs/specs/PRESENTER_SDD.md`. Written 2026-11-18 before implementation. The first edition shipped with 34 navigation defects (`docs/presenter/DEFECT_AUDIT.md`) because its tests checked isolated clicks, not the properties of the tour as a whole. These are metamorphic relations: properties that must hold across transformations of inputs and states, checked exhaustively over the machine rather than by example.*

## How to read

Each relation has an identifier, a statement, and the test that checks it. `M1–M9` run as model-based tests over the XState machine (vitest, no browser): the test enumerates states and events, so coverage is structural, not sampled. `M10–M12` run as Playwright journeys on the built page. A relation fails the build; none may be skipped or weakened to pass.

## The relations

**M1 — Spine reachability and order.** From the initial state, applying ADVANCE exactly 17 times visits chapters 0…17 in order, each once, and the 18th ADVANCE offers the restart (never a silent loop). The progress indicator reads `n / 18` with the act named at every step, and every chapter's next label equals the spine's declared label. *Test: iterate the actor, assert the chapter sequence and the rendered labels (labels via the spine data the renderer reads).*

**M2 — No dead ends (exhaustive).** Build the reachable state graph by breadth-first traversal from the initial state over the full event alphabet: ADVANCE, BACK, RESUME, RESTART, JUMP to every chapter, SET_VIEW to every legal view, ASK with every suggestion text and every prepared-bank question, ANSWER with valid and invalid chapters, FAIL, CLIP_STATE, SOUND, LIVE. For every reachable state: ADVANCE is enabled and changes the state (or offers restart at 17); BACK or RESUME is enabled; at least one ASK resolves to a navigation or a tappable offer. The traversal also asserts the graph is finite and every chapter is reachable. *Test: BFS over `machine.transition`, cap 20k states, assert the properties per state. This is the relation the first edition could not even express.*

**M3 — Resume identity.** For every chapter c and every legal view v of c, and for clip times {0, 2.5} and playing {false, true}: snapshot = (c, v, t, playing); ASK with a substantive question that navigates away; then RESUME restores all four fields exactly, and `detour` is null. Small talk (greeting, venue, weather) never creates a detour and never changes the four fields. *Test: nested loop over spine × views × times × playing, actor-level.*

**M4 — Detour persistence.** While in a detour: a second ASK replaces the visible answer/target but RESUME still restores the *original* snapshot; a direct JUMP does not destroy the snapshot; RESTART clears it deliberately. *Test: sequences ASK→ASK→RESUME, ASK→JUMP→RESUME, ASK→RESTART.*

**M5 — View and mode preservation.** SET_VIEW accepts exactly the chapter's declared views and rejects others (state unchanged). An answer that stays on the current chapter preserves the view. A continuation ("why?", "tell me more") resolves against the current chapter, not a stale chat topic. *Test: legal/illegal view pairs per chapter; same-chapter ANSWER; continuation after small talk.*

**M6 — Router totality (by construction).** Every suggestion string in the spine, every opening chip target, every prepared-bank question, and every intent-table phrase resolves to a valid chapter with a legal view — checked by iterating the data structures themselves, so adding a chip or bank entry that does not resolve fails the build. The fallback for an unknown question renders its offered chapters as JUMP-able chips. Composed intents ("take me to X", "go back to X") resolve stops before topics; city words without a city name land on the research chapter with a prepared answer. *Test: data-driven iteration + router unit cases for each composed intent and each audit defect D3–D9, D25–D28, D33.*

**M7 — View closure and visibility.** Every declared view of every chapter renders a non-empty stage with its focus element, and the view switcher is visible on the stage (not inside the popover) whenever a chapter has more than one view. *Test: actor-level view legality; Playwright renders each chapter×view and asserts the switcher and stage.*

**M8 — Back semantics.** On the spine with no detour, BACK after ADVANCE returns to the previous chapter; BACK at chapter 0 is disabled or offers restart, never a jump into the void. In a detour, BACK is RESUME (M3). The transition log records every state change, so BACK never skips past the interrupted state. *Test: ADVANCE/BACK pairs across the spine; detour BACK.*

**M9 — Live answer safety.** ANSWER with a chapter outside 0…17, or a view illegal for its chapter, changes the answer text only — position and view are untouched. FAIL produces the prepared fallback with a tappable offer, never silence. A 429 from the server surfaces an honest "give me a moment" state, not a silent fallback. *Test: actor-level invalid ANSWER/FAIL; Playwright with a mocked 429.*

**M10 — Page-level invariants.** Deep links `#chapter-n` work on mount and on hashchange. `blockedVoice` never re-speaks after a transition. The menu is closed in every state whose context says closed — no click sequence can strand it open over the stage. The bubble and pet never cover a control (layout bar). *Test: Playwright journeys + the existing layout bar at all four sizes for every chapter.*

**M11 — Menu as state.** For every event sequence in the M2 traversal that includes menu toggles, the rendered menu visibility equals the machine's `menuOpen`. *Test: renderer subscription unit test with a fake DOM + Playwright spot checks.*

**M12 — Stop authority and demo honesty.** At a walk stop, "what do I do / where do I go" answers from the stop's prepared direction with zero network requests. Live stop questions send the real stop id; the server constrains chapter choice to the stop or declared evidence. The ask route allows a 20/min demo burst and traces it. *Test: Playwright with request interception (zero asks for stop directions); server unit tests for the burst and the constrained schema.*

## The journey suite (Playwright, generated from the spine)

1. **The whole story**: ADVANCE through all 18 chapters at 390×844 and 1280×800, asserting chapter, act, progress, next label, and a non-empty stage at each; layout bar at each.
2. **Ask and return, per act**: at one chapter per act, pause a clip at a known second, ask a substantive question, assert the target, RESUME, assert exact identity (chapter, view, time, playing).
3. **Every chip and suggestion**: tap each opening chip and each chapter's suggestions, assert the resolved chapter renders (generated from the spine data — new entries are covered automatically).
4. **The menu cannot strand**: open the menu, interrupt with a question, jump, advance — assert visibility matches state after each.
5. **Small talk stays put**: greeting/venue/weather at a walk stop with a paused clip — position, view and time unchanged.
6. **Unknown question offers actions**: ask nonsense, assert the fallback chips are tappable and land on their chapters.

## Done when

Every relation passes in CI, the journey suite passes at all four sizes, the defect audit's 34 items are each closed by a named relation, and the public site replays the whole story without a single dead end.