# TASK-NMA-0026 — Trip Street View

<!-- continuity:task {"acceptance": ["on the default Map view, every street walk in the trip preview is seen from a 1.7 m eye facing along the route", "boarding eases back to the overhead camera and getting off eases into the eye again", "where the station's x-ray ways connect, the walk in goes down the mapped steps to the platform by the train and the walk out climbs to the exit; elsewhere the plain overhead switch stays", "unit tests cover the path picking, the eye rig and the stair timing"], "depends_on": [], "goal": "Trip preview walks at street level and goes down the station's real stairs", "id": "NMA-0026", "issue_url": "https://github.com/pukujan-lab-2/nyc-map-agent/issues/52", "next_action": "merge the pull request, then watch a trip preview on a phone", "owner": "claude-code", "priority": "medium", "protocol_version": "0.1.0-draft", "schema": "project-continuity.task.v1", "status": "active", "why": "The preview showed walks from above and slid the marker through walls into the station"} -->

- Status: active
- Owner: claude-code
- Priority: medium
- Depends on: none

## Goal

Trip preview walks at street level and goes down the station's real stairs

## Why

The preview showed walks from above and slid the marker through walls into the station

## Allowed files

- `src/features/agent/` (usePlayer, flythrough, stationStairs, tripCamera and their tests), `src/lib/transit/stationXray.ts`, `src/features/transit/xray.ts` (re-export only), `tasks/`, `checkpoints/CURRENT.md`

## Human outcome

Pressing Play on a subway trip shows the walk to the station from the rider's eyes, goes down the station's real stairs with the station drawn in x-ray, rides overhead, then climbs out and walks to the door at eye level.

## Scope and boundaries

- In scope: the trip preview's camera on foot and its path through stations.
- Out of scope: the x-ray data and its hand-made station layouts (another pull request), the real street view mode, a view picked from Change view (still wins).
- Dependencies/uncertainty: 77 of 273 stations with x-ray data connect an entrance to a platform today; the rest fall back.

## Acceptance criteria

- [x] on the default Map view, every street walk in the trip preview is seen from a 1.7 m eye facing along the route
- [x] boarding eases back to the overhead camera and getting off eases into the eye again
- [x] where the station's x-ray ways connect, the walk in goes down the mapped steps to the platform by the train and the walk out climbs to the exit; elsewhere the plain overhead switch stays
- [x] unit tests cover the path picking, the eye rig and the stair timing

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
