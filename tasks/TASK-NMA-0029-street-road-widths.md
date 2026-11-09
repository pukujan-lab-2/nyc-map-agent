# TASK-NMA-0029 — Street Road Widths

<!-- continuity:task {"acceptance":["At eye level roads and sidewalks use NYC widths by class (side street 11 m + 3.75 m sidewalks, avenue 20 m + 5 m)","Motorway and trunk decks one level up stand 6 m over the street on piers, ramping down at loose ends, and are not painted on the street below","Walking snaps to the ground street, not a raised deck"],"depends_on":[],"goal":"Draw street-view roads and sidewalks at NYC's real widths and lift motorway and trunk overpasses off the street below them","id":"NMA-0029","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/67","next_action":"define scope and observable acceptance checks, then begin bounded work","owner":"unassigned","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Roads were too narrow with bare ground to the buildings, and the FDR and BQE decks were painted flat on the streets under them"} -->

- Status: active
- Owner: unassigned
- Priority: P2
- Depends on: none

## Goal

Draw street-view roads and sidewalks at NYC's real widths and lift motorway and trunk overpasses off the street below them

## Why

Roads were too narrow with bare ground to the buildings, and the FDR and BQE decks were painted flat on the streets under them

## Allowed files

- src/lib/map/basemap.ts, src/lib/map/three/overpasses.ts (+ test), src/lib/map/threeLayer.ts, src/lib/map/city3d.ts, src/components/MapView.tsx, e2e/street-roads.spec.ts, checkpoints/CURRENT.md

## Human outcome

Describe what becomes easier, safer, clearer, or possible when this task is complete.

## Scope and boundaries

- In scope:
- Out of scope:
- Dependencies/uncertainty:

## Acceptance criteria

- [x] Roads and sidewalks at NYC widths by class at eye level (screenshots in the pull request).
- [x] Motorway and trunk overpasses one level up drawn at 6 m with piers and ramped loose ends; their flat paint hidden while walking.
- [x] Walking skips raised decks when it snaps to a street.

## Evidence and sources

Link repository state at a revision and cite external factual claims directly. Record commands and results for claims that need verification.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Required leaf owning issue, parent ancestry and dependencies (or explicitly none):
- Primary writer / branch / source issue revision / as-of status:
- Related PR/CI evidence and push receipt (request ID / SHA):

## Checkpoint log

No checkpoints yet.

### 2026-11-09 04:39:16 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["src/lib/map/basemap.ts, src/lib/map/three/overpasses.ts, src/lib/map/city3d.ts, src/components/MapView.tsx"],"completed":["Roads at NYC widths by class; motorway and trunk overpasses lifted to 6 m with ramps and piers; walking skips raised decks"],"decisions":["no new decisions"],"evidence":["vitest 1702 passed; e2e street-roads and street-xray pass; before/after screenshots at E 7th St, 5th Ave, Park Ave under the BQE and South St under the FDR"],"next_action":"Merge the pull request, then walk under the FDR at South St on a phone","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0029","timestamp":"2026-11-09T04:39:16Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"e4bf3ff55111c59f96b8f09c1fc68c0c95c6e57f2e35f76d1465e266de544ad6","request_id":"417e6a255b974c9bb78621e74ef52af5","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0029"} -->

Completed:
- Roads at NYC widths by class; motorway and trunk overpasses lifted to 6 m with ramps and piers; walking skips raised decks

Evidence:
- vitest 1702 passed; e2e street-roads and street-xray pass; before/after screenshots at E 7th St, 5th Ave, Park Ave under the BQE and South St under the FDR

Decisions:
- no new decisions

Changed:
- src/lib/map/basemap.ts, src/lib/map/three/overpasses.ts, src/lib/map/city3d.ts, src/components/MapView.tsx

Blocked/uncertain:
- none

Next:
- Merge the pull request, then walk under the FDR at South St on a phone

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
