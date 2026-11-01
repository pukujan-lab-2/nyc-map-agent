# TASK-NMA-0007 — Left Menu Column

<!-- continuity:task {"acceptance":["at 1024 px and up the six menus are a vertical column at the left edge with the map beside it","phones and small tablets keep the swipeable row","the layout bar passes at all sizes and no existing e2e test fails"],"depends_on":[],"goal":"On wide screens the six menus are a left column with the map beside it.","id":"NMA-0007","issue_url":"https://github.com/Pukujan-lab/nyc-map-agent/issues/637","next_action":"fix the 6 failing e2e tests (4 need new left-edge numbers, 1 needs the map offset, the chat dialog covers the trip preview Play button), then update DESIGN_RULES and PDD, then take the PR out of draft","owner":"claude-code","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The top menu row is clipped and crowds the controls on desktop (#637)."} -->

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

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
