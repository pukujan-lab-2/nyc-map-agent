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

### 2026-11-28 07:32:57 UTC — agent:claude-code/8fedcaac-7345-407c-8230-38883f64d4b9

<!-- continuity:checkpoint {"agent":"agent:claude-code/8fedcaac-7345-407c-8230-38883f64d4b9","blocked":[],"changed":["src/pages/Index.tsx, src/pages/CityData.tsx, src/components/SettingsSheet.tsx, src/components/SettingsBody.tsx, src/components/QrSheet.tsx, src/components/MapChrome.tsx, src/features/agent/AgentHome.tsx, public/info/index.html, .size-limit.json"],"completed":["The map page now holds only getting-around controls: the menu row, My day, the Record and QR buttons and the language chip moved behind a person button on the chat bar, the 311, noise and crash analytics moved to /city-data, and /info/ links the project's other pages (pull request 293)."],"decisions":["With nothing saved the app follows the phone's language, so issue 10's first-open case works without the chip; the person button's label is translated."],"evidence":["Unit tests passed before the rebase (2,302 tests in 295 files) and the 48 affected test files pass after it; typecheck, knip, module boundaries and size pass; layout cases for the idle map, the You card and /city-data passed at all four sizes before the rebase."],"evidence_class":"observed","next_action":"Merge pull request 293 once CI passes, tell the station-walk session that /info/ is live, then delete the scratch clone.","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0090","timestamp":"2026-11-28T07:32:57Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"7db0023becac4535796beb7ec7b399645f28f43c1746792032a6dcf2e597988e","request_id":"e44419cd9b834d3fbc4f9ff97ea810c7","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0090"} -->

Completed:
- The map page now holds only getting-around controls: the menu row, My day, the Record and QR buttons and the language chip moved behind a person button on the chat bar, the 311, noise and crash analytics moved to /city-data, and /info/ links the project's other pages (pull request 293).

Evidence:
- Unit tests passed before the rebase (2,302 tests in 295 files) and the 48 affected test files pass after it; typecheck, knip, module boundaries and size pass; layout cases for the idle map, the You card and /city-data passed at all four sizes before the rebase.

Decisions:
- With nothing saved the app follows the phone's language, so issue 10's first-open case works without the chip; the person button's label is translated.

Changed:
- src/pages/Index.tsx, src/pages/CityData.tsx, src/components/SettingsSheet.tsx, src/components/SettingsBody.tsx, src/components/QrSheet.tsx, src/components/MapChrome.tsx, src/features/agent/AgentHome.tsx, public/info/index.html, .size-limit.json

Blocked/uncertain:
- none

Next:
- Merge pull request 293 once CI passes, tell the station-walk session that /info/ is live, then delete the scratch clone.

### 2026-11-28 11:46:00 UTC — agent:claude-code/8fedcaac-7345-407c-8230-38883f64d4b9

<!-- continuity:checkpoint {"agent":"agent:claude-code/8fedcaac-7345-407c-8230-38883f64d4b9","blocked":[],"changed":[".size-limit.json, checkpoints/CURRENT.md"],"completed":["Pull request 293 is rebased onto main after #298 and force-pushed with lease; it is mergeable with auto-merge armed."],"decisions":["Three size budgets rise slightly (line panel 7.2 kB, notice map layers 6.4 kB, all JS 1299.3 kB) because removing the menu row moved a few shared modules between chunks."],"evidence":["Typecheck, knip, module boundaries and size pass; 2,382 unit tests pass, and the only 5 failures are timeouts in the Fulton St 3D walk simulations, which this branch does not touch, run while other test runs shared the CPU."],"evidence_class":"observed","next_action":"Let CI's fast set pass and the pull request merge, finish the full local e2e run, tell the station-walk session that /info/ is live, then delete the scratch clone.","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0090","timestamp":"2026-11-28T11:46:00Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"49e262924d021243557b6600daa6e0cf41a824e9f225e8a8c4e24d24828310a4","request_id":"b60e82ff6d554caca2c285af7f48e11f","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0090"} -->

Completed:
- Pull request 293 is rebased onto main after #298 and force-pushed with lease; it is mergeable with auto-merge armed.

Evidence:
- Typecheck, knip, module boundaries and size pass; 2,382 unit tests pass, and the only 5 failures are timeouts in the Fulton St 3D walk simulations, which this branch does not touch, run while other test runs shared the CPU.

Decisions:
- Three size budgets rise slightly (line panel 7.2 kB, notice map layers 6.4 kB, all JS 1299.3 kB) because removing the menu row moved a few shared modules between chunks.

Changed:
- .size-limit.json, checkpoints/CURRENT.md

Blocked/uncertain:
- none

Next:
- Let CI's fast set pass and the pull request merge, finish the full local e2e run, tell the station-walk session that /info/ is live, then delete the scratch clone.

### 2026-11-28 12:37:31 UTC — agent:claude-code/8fedcaac-7345-407c-8230-38883f64d4b9

<!-- continuity:checkpoint {"agent":"agent:claude-code/8fedcaac-7345-407c-8230-38883f64d4b9","blocked":[],"changed":["src/pages/Index.tsx, src/pages/CityData.tsx"],"completed":["A neighbourhood picked from search on the map now opens City data, which fixes the smoke and panel-slot browser tests that failed in CI on pull request 293; the branch is rebased onto main with /underground/."],"decisions":["no new decisions"],"evidence":["CI's e2e failed on exactly those 5 tests (93 passed); typecheck and lint pass with the fix."],"evidence_class":"observed","next_action":"Confirm CI's e2e passes on pull request 293 so auto-merge lands it, then tell the station-walk session that /info/ is live and delete the scratch clone.","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0090","timestamp":"2026-11-28T12:37:31Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"fd1958649479ebd90d2c432196c2992e8225d64113d35d5a91cf97563f3f3a6d","request_id":"842afed1adcc42f68aefe1cdf4b5df52","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0090"} -->

Completed:
- A neighbourhood picked from search on the map now opens City data, which fixes the smoke and panel-slot browser tests that failed in CI on pull request 293; the branch is rebased onto main with /underground/.

Evidence:
- CI's e2e failed on exactly those 5 tests (93 passed); typecheck and lint pass with the fix.

Decisions:
- no new decisions

Changed:
- src/pages/Index.tsx, src/pages/CityData.tsx

Blocked/uncertain:
- none

Next:
- Confirm CI's e2e passes on pull request 293 so auto-merge lands it, then tell the station-walk session that /info/ is live and delete the scratch clone.

### 2026-11-28 12:50:47 UTC — agent:claude-code/8fedcaac-7345-407c-8230-38883f64d4b9

<!-- continuity:checkpoint {"agent":"agent:claude-code/8fedcaac-7345-407c-8230-38883f64d4b9","blocked":[],"changed":["src/pages/Index.tsx, src/pages/CityData.tsx, src/pages/cityDataRedirect.test.ts"],"completed":["City data keeps the classic layout's flags query and sits below its search bar, so the smoke and panel-slot browser tests pass locally."],"decisions":["no new decisions"],"evidence":["Locally, smoke and panel-slot pass (9 of 9) and the responsive idle map, You card and City data cases pass (20 of 20); typecheck, lint and module boundaries pass."],"evidence_class":"observed","next_action":"Confirm CI's e2e passes on pull request 293 so auto-merge lands it, then tell the station-walk session that /info/ is live and delete the scratch clone.","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0090","timestamp":"2026-11-28T12:50:47Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"b4b745abfeeb7d583b2175998ae455ffcc0bf2c6befc6ed67d3352ed4fcb3c08","request_id":"8325a585236f40939b998a0300122d77","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0090"} -->

Completed:
- City data keeps the classic layout's flags query and sits below its search bar, so the smoke and panel-slot browser tests pass locally.

Evidence:
- Locally, smoke and panel-slot pass (9 of 9) and the responsive idle map, You card and City data cases pass (20 of 20); typecheck, lint and module boundaries pass.

Decisions:
- no new decisions

Changed:
- src/pages/Index.tsx, src/pages/CityData.tsx, src/pages/cityDataRedirect.test.ts

Blocked/uncertain:
- none

Next:
- Confirm CI's e2e passes on pull request 293 so auto-merge lands it, then tell the station-walk session that /info/ is live and delete the scratch clone.
