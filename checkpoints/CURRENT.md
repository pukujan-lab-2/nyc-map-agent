# Current repository checkpoint

<!-- continuity:current {"active_task": "NMA-0005", "active_task_file": "tasks/TASK-NMA-0005-line-status-eval.md", "protocol_version": "0.1.0-draft", "schema": "project-continuity.current.v1"} -->

Older state: [`history/2026-11.md`](history/2026-11.md) and earlier months in `history/`.

## Current projection

*Updated 2026-11-27. Read this first; it says where the work stands so a new agent does not have to rebuild that from branches and pull requests.*

## In flight

**The app's panels opened in about six places on desktop and more on tablet, and the map carried buttons for things that are not getting around, so the owner found it hard to use (owner, 2026-11-27; #180, task NMA-0090).** The owner chose to copy Apple Maps' layout and approved a clickable mockup, now `docs/design/apple-layout/map-shell.html`. `docs/DESIGN_RULES.md` now says every panel opens in one bottom sheet on phones and one left card from 640 px, the map is only for getting around, everything else sits behind a person button on the chat bar and a hub at `/info/`, My day is gone for now, and how the restroom pick, its hours and the arrival question work. Three pull requests build it in parallel, each from its own clone under the ACS scratch cache because this checkout is not in the worktree layout: map cleanup with `/info/` and `/city-data` (branch `feat/map-cleanup`), one sheet for every panel (`feat/one-sheet`, closes #180), and restrooms (`feat/restroom-pick`, refs #249; the owner allowed the LGPL `opening_hours` parser, server only). Next: merge the rules, then the three pull requests; one-sheet rebases onto the transit notice pull requests first.

## Next

- The app has too many buttons and screens that do the same job: `docs/design/screen-inventory/index.html` (2026-11-27) shows 104 screens at phone and desktop size from main, 27 reviewed with numbered defects, and the five changes that would fix the most screens. The owner set it aside for later; start a UI makeover from it.
