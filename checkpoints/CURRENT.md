# Current repository checkpoint

<!-- continuity:current {"active_task": "NMA-0005", "active_task_file": "tasks/TASK-NMA-0005-line-status-eval.md", "protocol_version": "0.1.0-draft", "schema": "project-continuity.current.v1"} -->

Older state: [`history/2026-11.md`](history/2026-11.md) and earlier months in `history/`.

## Current projection

*Updated 2026-11-27. Read this first; it says where the work stands so a new agent does not have to rebuild that from branches and pull requests.*

## In flight

**The app's panels opened in about six places on desktop and more on tablet, and the map carried buttons for things that are not getting around, so the owner found it hard to use (owner, 2026-11-27; #180, task NMA-0090).** The owner chose to copy Apple Maps' layout and approved a clickable mockup, now `docs/design/apple-layout/map-shell.html`. `docs/DESIGN_RULES.md` now says every panel opens in one bottom sheet on phones and one left card from 640 px, the map is only for getting around, everything else sits behind a person button on the chat bar and a hub at `/info/`, My day is gone for now, and how the restroom pick, its hours and the arrival question work. Three pull requests build it in parallel, each from its own clone under the ACS scratch cache because this checkout is not in the worktree layout: map cleanup with `/info/` and `/city-data` (branch `feat/map-cleanup`), one sheet for every panel (`feat/one-sheet`, closes #180), and restrooms (`feat/restroom-pick`, refs #249; the owner allowed the LGPL `opening_hours` parser, server only). Next: merge the rules, then the three pull requests; one-sheet rebases onto the transit notice pull requests first.

**Elevator outages have no walk: at 161 St-Yankee Stadium two broken elevators, one at the street and one inside, showed as one block of MTA text with different detours (step 6 of `docs/PLAN-notice-walks.md`, data half, branch `feat/elevator-walk-data`, task NMA-0077, refs #208).** `src/features/transit/elevatorWalk.ts` reads each outage by rules: street or inside, which elevator entrance in `public/transit/subway.json` it is (by the corner the MTA names, or unsure), the detour split into journeys with a start, legs and an end, and each detour station's elevator entrance or "not in our data". On the 19 elevator outages out on 2026-11-27, 4 of the 11 street elevators match an entrance, none is unsure, and 7 are at stations with no elevator entrance in our data; 18 detours read into journeys and the last has none from the MTA. `scripts/elevator-walk-report.ts` prints the same report from the live feeds. Not done: the walk screen, which uses this data in a later step, and `public/transit/equipment.json`, which misses corners written "SW corner of ..." (E 149 St).

**Phones read the app in the first voice they list, often a robotic compact one, and on a phone with no Haitian Creole voice a Creole line was read by the English voice (notice-walks plan step 7, the voice half; issue 208, branch `feat/voice-choice`, task NMA-0074).** The phone's voice is now the best one it has for the language: Premium, Enhanced or Natural first, then voices on the phone itself (they keep working underground), Apple's novelty voices last (`src/lib/voice/tts.ts`, tested on voice lists shaped like iOS, Android, Chrome desktop and Edge). Where the phone has no voice for the language, the line stays on screen unread and a one-line note says so once a visit. Settings has a new Voice choice, App voice (Kokoro through the speech gateway, the default) or My phone's voice, kept on the phone as `nma.voice`. Speech routing is unchanged. Not done: the sentence-pattern translations, which wait for the walk builder, and the owner's decision 3 in the plan (which voice should be the default where both speak the language).

## Next

- The app has too many buttons and screens that do the same job: `docs/design/screen-inventory/index.html` (2026-11-27) shows 104 screens at phone and desktop size from main, 27 reviewed with numbered defects, and the five changes that would fix the most screens. The owner set it aside for later; start a UI makeover from it.
