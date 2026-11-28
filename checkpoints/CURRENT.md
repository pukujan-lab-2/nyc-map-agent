# Current repository checkpoint

<!-- continuity:current {"active_task": "NMA-0005", "active_task_file": "tasks/TASK-NMA-0005-line-status-eval.md", "protocol_version": "0.1.0-draft", "schema": "project-continuity.current.v1"} -->

Older state: [`history/2026-11.md`](history/2026-11.md) and earlier months in `history/`.

## Current projection

*Updated 2026-11-28. Read this first; it says where the work stands so a new agent does not have to rebuild that from branches and pull requests.*

## In flight

**Nobody knew how long a hands-free turn takes, so the LiveKit live-call pilot had nothing to beat (step 1 of `docs/PLAN-livekit-hands-free.md`, issue 299, task NMA-0100, branch `perf/hands-free-baseline`).** Against the deployed app the first word of the answer comes 9.3 s after the rider stops talking (median of 9 turns, 6.1 to 12.4 s): 1.2 s waiting for silence, 0.4 s converting and sending the clip, 1.6 s speech-to-text, 3.5 s to the agent's first token, and 1.1 s to the app voice's first sound, which only starts once the whole answer is in. With instant server replies a turn still takes 2.5 s. `scripts/voice-baseline.ts` reruns it; the numbers are in `docs/eval/hands-free-baseline/`. Next: step 2, the worker, token endpoint and `liveCall` flag.

## Next

- **Hands-free voice takes one turn at a time, and nobody has measured how long a turn takes (owner, 2026-11-28; issue 299, task NMA-0096).** `docs/PLAN-livekit-hands-free.md` plans a live LiveKit call behind a `liveCall` flag, reusing design-bakery's worker and the speech gateway's existing `nyc-map` route, with no routing change and no cloud speech. First move: measure today's hands-free turn end to end. Two questions wait for the owner: where the worker lives, and whose LiveKit server it uses.
- The app has too many buttons and screens that do the same job: `docs/design/screen-inventory/index.html` (2026-11-27) shows 104 screens at phone and desktop size from main, 27 reviewed with numbered defects, and the five changes that would fix the most screens. The owner set it aside for later; start a UI makeover from it.
- **The underground guide plan had no page people outside a chat could open (owner, 2026-11-27; issue #290).** `public/underground/index.html` puts it on the site at `/underground/`: the three-stage goal (camera on, phone in a pocket, a watch), what we tried, the 3D walk's problems, the 86 St barometer and GPS charts, a map of what each technology can do, the four tests, our data and station coverage, contributor tasks by device, and a scanning guide for iPhone Pro and iPad Pro owners. Keep it in step with issue #290 when a test result or decision lands. A separate home page for pages like this and `/partners/` is a question for the UI issues work.
