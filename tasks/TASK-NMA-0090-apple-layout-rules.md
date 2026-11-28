# TASK-NMA-0090 — Apple Layout Rules

<!-- continuity:task {"acceptance":["docs/DESIGN_RULES.md states one place for every panel, the map for getting around only, the person button, the top-right pair and the restroom rules","the agreed mockup is in docs/design/apple-layout/"],"depends_on":[],"goal":"Write the owner's 2026-11-27 layout decisions into the design rules: copy Apple Maps' layout, every panel in one sheet or left card, the map only for getting around, extras behind a person button and /info/, and how restrooms are picked and checked.","id":"NMA-0090","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/180","next_action":"let the pull request merge; the map-cleanup, one-sheet and restrooms pull requests build to these rules","owner":"agent:claude-code/a0ddded4-f8b2-47ac-8c96-8f125bb721f9","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Panels open in about six places on desktop and more on tablet, and the map carries buttons for things that are not getting around; three pull requests are rebuilding the screens in parallel and need one written rule to build to."} -->

- Status: active
- Owner: agent:claude-code/a0ddded4-f8b2-47ac-8c96-8f125bb721f9
- Priority: P1
- Depends on: none

## Goal

Write the owner's 2026-11-27 layout decisions into the design rules: copy Apple Maps' layout, every panel in one sheet or left card, the map only for getting around, extras behind a person button and `/info/`, and how restrooms are picked and checked.

## Why

Panels open in about six places on desktop and more on tablet, and the map carries buttons for things that are not getting around. Three pull requests are rebuilding the screens in parallel and need one written rule to build to.

## Allowed files

- `docs/DESIGN_RULES.md`
- `docs/design/apple-layout/map-shell.html`
- `checkpoints/CURRENT.md`, this task file

## Human outcome

Anyone changing a screen can read where a panel goes, what may sit on the map, and how the restroom pick works, and open the mockup the owner approved.

## Scope and boundaries

- In scope: the rules text and the mockup file.
- Out of scope: any code; the screens are built by the map-cleanup, one-sheet and restrooms pull requests.

## Acceptance criteria

- [x] The rules state one place for every panel, the map for getting around only, the person button, the top-right pair and the restroom rules.
- [x] The agreed mockup is in `docs/design/apple-layout/`.

### 2026-11-28 06:04:50 UTC — agent:claude-code/a0ddded4-f8b2-47ac-8c96-8f125bb721f9

<!-- continuity:checkpoint {"agent":"agent:claude-code/a0ddded4-f8b2-47ac-8c96-8f125bb721f9","blocked":[],"changed":["none"],"completed":["Design rules now describe the Apple Maps layout, the person button, /info/, and the restroom pick; mockup added"],"decisions":["Owner 2026-11-27: copy Apple Maps; one place for every panel; map only for getting around; My day removed; restrooms show nearest open with hours and a customers-only warning"],"evidence":["docs/DESIGN_RULES.md and docs/design/apple-layout/map-shell.html"],"evidence_class":"observed","next_action":"Merge this; the map-cleanup, one-sheet and restrooms pull requests build to it","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0090","timestamp":"2026-11-28T06:04:50Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"a8f8fae45433436f29008f7272be25be3105b76a3001f7ab3868b3727eeedf28","request_id":"1297b866010b4b86959efec027b3daad","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0090"} -->

Completed:
- Design rules now describe the Apple Maps layout, the person button, /info/, and the restroom pick; mockup added

Evidence:
- docs/DESIGN_RULES.md and docs/design/apple-layout/map-shell.html

Decisions:
- Owner 2026-11-27: copy Apple Maps; one place for every panel; map only for getting around; My day removed; restrooms show nearest open with hours and a customers-only warning

Changed:
- none

Blocked/uncertain:
- none

Next:
- Merge this; the map-cleanup, one-sheet and restrooms pull requests build to it
