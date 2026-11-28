# Current repository checkpoint

<!-- continuity:current {"active_task": "NMA-0005", "active_task_file": "tasks/TASK-NMA-0005-line-status-eval.md", "protocol_version": "0.1.0-draft", "schema": "project-continuity.current.v1"} -->

Older state: [`history/2026-11.md`](history/2026-11.md) and earlier months in `history/`.

## Current projection

*Updated 2026-11-28. Read this first; it says where the work stands so a new agent does not have to rebuild that from branches and pull requests.*

## In flight

**Restroom on the home asked the agent, which could not say whether a restroom was open (#249, pull request 294, branch `feat/restroom-pick`, task NMA-0080).** Tapping Restroom now picks the closest open restroom with its hours, offers a free public one within five minutes, lists the rest, and asks on arrival whether it was available; the full record is in `history/2026-11.md`. Next: let it merge, then walk to a café restroom with a phone and answer the question.

## Next

- **Hands-free voice takes one turn at a time, and nobody has measured how long a turn takes (owner, 2026-11-28; issue 299, task NMA-0096).** `docs/PLAN-livekit-hands-free.md` plans a live LiveKit call behind a `liveCall` flag, reusing design-bakery's worker and the speech gateway's existing `nyc-map` route, with no routing change and no cloud speech. First move: measure today's hands-free turn end to end. Two questions wait for the owner: where the worker lives, and whose LiveKit server it uses.
- The app has too many buttons and screens that do the same job: `docs/design/screen-inventory/index.html` (2026-11-27) shows 104 screens at phone and desktop size from main, 27 reviewed with numbered defects, and the five changes that would fix the most screens. The owner set it aside for later; start a UI makeover from it.
- **The underground guide plan had no page people outside a chat could open (owner, 2026-11-27; issue #290).** `public/underground/index.html` puts it on the site at `/underground/`: the three-stage goal (camera on, phone in a pocket, a watch), what we tried, the 3D walk's problems, the 86 St barometer and GPS charts, a map of what each technology can do, the four tests, our data and station coverage, contributor tasks by device, and a scanning guide for iPhone Pro and iPad Pro owners. Keep it in step with issue #290 when a test result or decision lands. A separate home page for pages like this and `/partners/` is a question for the UI issues work.
