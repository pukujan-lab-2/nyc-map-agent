# Defect audit: /present navigation, 2026-11-18

*Empirical inventory produced after the failed live demo, before the XState rebuild. Method: full read of flow.js (668 lines), scenes.js, chat.js, the 31-entry prepared bank, PresentPage.tsx and both e2e specs; 30 prepared-mode questions, 6 live-mode questions, a 10-step Guide-me trace and 5 interrupt/resume identity probes against the newest code. Probe scripts and raw output: `~/.cache/acs/scratch/deadend-audit/`. Every defect below is mapped to a rule in `docs/specs/PRESENTER_SDD.md` and a relation in `docs/specs/PRESENTER_VALIDATION.md`.*

## A. The guided spine is broken

Observed Guide-me trace from the opening: Your trip → Broadway entrance → Uptown platform → Platform elevator → Mezzanine → Street elevator → Street → GPS replay → **Your trip (loop)** → the walk repeats forever. The walk spine works; the tech story is one scene deep. `onward()` computes `WALK[(WALK.indexOf(scene)+1) % WALK.length]`; for any evidence scene indexOf is −1, so the visitor is dumped at the walk start. Scenes sign-vision → elevator-clue → pressure → 3D → Fulton → research → stack → AI-pipeline → open-data are never guided. The authored `next` labels ("Look through the camera", "Feel the climb"…) are dead code: `updateNav` shows them only for walk members.

## B. Defect table

| # | Entry point | Observed | Root cause | Eliminated by |
|---|---|---|---|---|
| D1 | Guide me from any evidence scene | Loops to walk start | onward() array arithmetic, indexOf −1 | spine order, M1 |
| D2 | Evidence next labels | Always "Start the walk →" | updateNav shows scene.next only for WALK | spine nextLabel, M1 |
| D3 | "What is the tech stack?" | Lands on 3D map, not stack | bank chapter predates scenes 15/16 | router contract tests, M6 |
| D4 | "What did the AI actually do?" (+3 variants) | Lands on sign photo, not AI pipeline | bank targets stale | M6 |
| D5 | "What's under the hood?" | Open data, not stack | bank target stale | M6 |
| D6 | green line / elevator out / helps people | Questionable targets | intent→scene unreviewed | router table review, M6 |
| D7 | chip "What did the phone record?" | Dead-end fallback | chip text ≠ bank text, exact match only | suggestions resolve by construction, M6 |
| D8 | chips "What do I do here?" | Dead end | stop regex lacks "here" suffix | M6 |
| D9 | chips "Show me the sign match", "How does this become 3D?", "How was this made?" | Dead ends | no matching pattern | M6 |
| D10 | "Watch the replay" at GPS scene | Menu stuck open | commandView returns removed "video" mode; deliver clicks null, returns before closeRoute | legalView guard + menu as state, M7/M11 |
| D11 | Any deliver glide failure | Menu left open | four early returns skip closeRoute | menu is machine state, M11 |
| D12 | Question in non-default view | View silently reset | automated show() carries no mode | same-chapter answers preserve view, M5 |
| D13 | "What do I do?" at stops, live | Prepared direction bypassed for Haiku | live path always taken when destination undefined | prepared stop directions authoritative, M12 |
| D14 | Free-form live questions | Answer without navigation | chapter==current or out-of-range → speak-only | validated chapter + offer action, M9 |
| D15 | Walk-stop questions, live | Context always scene 4; other chapters yank visitor out | hardcoded scene mapping | real stop id + constrained choice, M12 |
| D16 | Any stay-in-place question | Guide me becomes "Resume route" to the same place | bookmark set regardless of movement | detour only on actual movement, M3 |
| D17 | Direct command after detour | Resume point destroyed | direct clears bookmark | detour snapshot kept until RESUME, M4 |
| D18 | Evidence→evidence jump then Guide me | Walk start | bookmark only for WALK scenes | one resume semantics, M3/M4 |
| D19 | Paused clip + small talk + keep going | Advances, loses view and time | bookmark only when playing | snapshot on any interrupt, M3 |
| D20 | Back after detour | Lands before interrupted scene | detour/mode changes never push history | machine transition log, M8 |
| D21 | Deep link hash change after mount | Ignored | hash read once | hashchange listener, M10 |
| D22 | View-mode buttons | Invisible (hidden in Route popover) | actions relocated to menu | on-stage view switcher, M7 |
| D23 | Progress meter | Never renders | empty div, no dots created | progress from spine, M1 |
| D24 | Opening chips | No stack/AI chips | chip list predates scenes | chips from spine, M6 |
| D25 | "How did other countries do this?" | Dead end | pattern only "anyone else/other people" | intent table, M6 |
| D26 | "Go back to the elevator" | Dead end | back regex exact-match only | composed back+target intent, M6 |
| D27 | "Take me to Union Square" | Sign photo, not the stop | evidence pattern outranks navigation | navigation intent resolves stops first, M6 |
| D28 | waymap/wmata without city | "Open the live guide…" dead end | citySources[undefined] fallback | research chapter with prepared answer, M6 |
| D29 | bare "why" after small talk | Stolen by chat continuation | lastTopic continuation | continuation resolves current scene first, M5 |
| D30 | Rapid demo questions | Silent prepared fallback | 8 req/min/IP trips with no signal | demo burst allowance + honest state, M12 |
| D31 | Click after blocked autoplay | Re-speaks stale answer | blockedVoice not cleared on nav | cleared on every transition, M10 |
| D32 | Back with empty history | Jumps to scene 0 | WALK[max(0,−1)] | defined back semantics, M8 |
| D33 | Fallback answer | Speaks options, nothing tappable | plain text fallback | fallback renders action chips, M6 |
| D34 | Scene 3 dual identity; global mode strings | "video" means different things per scene | commandView treats modes globally | per-chapter views, M7 |

## C. Resume-identity matrix (empirical)

- Walk stop, clip paused t=2 → stack question → Resume: **exact** (the one path e2e covers).
- Same paused clip → "hello" → keep going: advanced, view and time lost (D19).
- Evidence→evidence via menu → Guide me: walk start (D18+D1).
- GPS scene in map view → question: view reset (D12).
- Detour exists → direct command: resume point destroyed (D17).
- Live detour → Back: lands before the interrupted scene (D20).
- Playing clip → detour → resume: time restored; playing restore can silently fail on autoplay policy (fragile).

## D. Why it shipped

The e2e suite covered layout, one click-sequence, one clip resume, one bank question, chip visibility, one suggestion. No guided-spine test, no question→target matrix, no resume-identity matrix, no menu-stuck or mode-preservation assertions. The rebuild generates these from the spine and the intent table; see the validation spec.