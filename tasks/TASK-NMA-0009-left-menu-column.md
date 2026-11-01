# TASK-NMA-0009 — Left Menu Column

<!-- continuity:task {"acceptance":["at 1024 px and up the six menus are a vertical column at the left edge with the map beside it","phones and small tablets keep the swipeable row","the layout bar passes at all sizes and no existing e2e test fails"],"depends_on":[],"goal":"On wide screens the six menus are a left column with the map beside it.","id":"NMA-0009","issue_url":"https://github.com/Pukujan-lab/nyc-map-agent/issues/637","next_action":"fix the 6 failing e2e tests (4 need new left-edge numbers, 1 needs the map offset, the chat dialog covers the trip preview Play button), then update DESIGN_RULES and PDD, then take the PR out of draft","owner":"claude-code","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The top menu row is clipped and crowds the controls on desktop (#637)."} -->

- Status: active
- Owner: claude-code
- Priority: P2
- Depends on: none

## Goal

On wide screens the six menus are a left column with the map beside it.

## Why

The top menu row is clipped and crowds the controls on desktop (#637).

## Allowed files

- `src/components/MenuRow.tsx`, `src/pages/Index.tsx`, `src/components/MapPanel.tsx`, `src/components/ui/switch.tsx`, `src/lib/useMediaQuery.ts`, `e2e/`, `docs/DESIGN_RULES.md`, `docs/PDD.md`, `checkpoints/`, this file.

## Human outcome

On a laptop the menus are where people expect them and nothing overlaps.

## Scope and boundaries

- In scope: wide-screen placement of the menus.
- Out of scope: phones, tablets, what is inside each menu.
- Dependencies/uncertainty: other left-docked and fixed panels assume the old layout.

## Acceptance criteria

- [ ] The column and its dropdowns pass the layout bar at 1280x800 and 1024x768.
- [ ] The six failing tests pass.
- [ ] Design docs describe the wide layout.

## Evidence and sources

Local run against a build: 97 of 103 e2e tests pass. Draft PR #640.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Required leaf owning issue, parent ancestry and dependencies (or explicitly none): #637, no parent.
- Primary writer / branch / source issue revision / as-of status:
- Related PR/CI evidence and push receipt (request ID / SHA):

## Checkpoint log

No checkpoints yet.

### 2026-11-01 17:06:13 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":["6 failing e2e tests"],"changed":["src/components/MenuRow.tsx, src/pages/Index.tsx, src/components/MapPanel.tsx, src/components/ui/switch.tsx, src/lib/useMediaQuery.ts, e2e/menu-rail.spec.ts"],"completed":["Built the wide-screen menu column and opened draft PR #640; 97 of 103 e2e tests pass"],"decisions":["no new decisions"],"evidence":["local playwright run: 97 passed, 6 failed (4 hard-code the old left edge, 1 taps a map point, 1 chat dialog covers trip preview Play)"],"evidence_class":"observed","next_action":"fix the 6 failing tests, update DESIGN_RULES and PDD, then mark the PR ready with auto-merge","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0009","timestamp":"2026-11-01T17:06:13Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"c17faea329555a9af0e1a225ce383ea735a27978f92ba6925b15f705a848fe36","request_id":"883b9c9232a445eebab3570dbb115aec","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0009"} -->

Completed:
- Built the wide-screen menu column and opened draft PR #640; 97 of 103 e2e tests pass

Evidence:
- local playwright run: 97 passed, 6 failed (4 hard-code the old left edge, 1 taps a map point, 1 chat dialog covers trip preview Play)

Decisions:
- no new decisions

Changed:
- src/components/MenuRow.tsx, src/pages/Index.tsx, src/components/MapPanel.tsx, src/components/ui/switch.tsx, src/lib/useMediaQuery.ts, e2e/menu-rail.spec.ts

Blocked/uncertain:
- 6 failing e2e tests

Next:
- fix the 6 failing tests, update DESIGN_RULES and PDD, then mark the PR ready with auto-merge

### 2026-11-01 17:35:49 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":["6 failing e2e tests on the draft PR"],"changed":["tasks/TASK-NMA-0009-left-menu-column.md"],"completed":["Renumbered the left-menu-column task from NMA-0007 to NMA-0009 so it does not collide with the agent-sense task"],"decisions":["no new decisions"],"evidence":["git mv and id rewrite in the task file; no code changed"],"evidence_class":"observed","next_action":"fix the failing tests, update DESIGN_RULES and PDD, then mark #640 ready with auto-merge","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0009","timestamp":"2026-11-01T17:35:49Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"f822b7b2b009b222c0e5e97f334425ee69a5a0a6ae9da9db08d70edf26bf8a86","request_id":"557ae69ce88e4178b45c39c199f9e209","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0009"} -->

Completed:
- Renumbered the left-menu-column task from NMA-0007 to NMA-0009 so it does not collide with the agent-sense task

Evidence:
- git mv and id rewrite in the task file; no code changed

Decisions:
- no new decisions

Changed:
- tasks/TASK-NMA-0009-left-menu-column.md

Blocked/uncertain:
- 6 failing e2e tests on the draft PR

Next:
- fix the failing tests, update DESIGN_RULES and PDD, then mark #640 ready with auto-merge

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
