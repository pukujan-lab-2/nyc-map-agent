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

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
