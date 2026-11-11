# TASK-NMA-0050 — Fulton Stair To Hall

<!-- continuity:task {"acceptance":["Replaying the trip preview's camera along the live walk to the E exit, the stair from the mezzanine down to the hall shows a clean opening, with no wall pieces at odd angles, dark gaps or slab across it","No wall stands across that stair's treads","Steps stay 2 m wide and routes are unchanged; unit tests, typecheck and lint pass","A fresh live recording is clean from 60 to 73 s"],"depends_on":[],"goal":"The trip to the E exit on Fulton Street goes down the stair from the mezzanine to the hall through a clean opening and without passing a wall","id":"NMA-0050","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/117","next_action":"Merge the pull request, then record the 4 train trip to Fulton St on the live site","owner":"claude-code","priority":"high","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The live recording after #116 still showed wall pieces, a dark slab and a wall across the treads at that stair"} -->

- Status: active
- Owner: claude-code
- Priority: high
- Depends on: none

## Goal

The trip to the E exit on Fulton Street goes down the stair from the mezzanine to the hall through a clean opening and without passing a wall

## Why

The live recording after #116 still showed wall pieces, a dark slab and a wall across the treads at that stair

## Allowed files

- src/lib/map/stationWalk.ts
- src/lib/map/stationWalk.test.ts
- src/lib/map/three/stationScene.ts
- checkpoints/CURRENT.md
- tasks/TASK-NMA-0049-fulton-stair-top.md
- this task record

## Human outcome

Watching the trip to the E exit on Fulton Street, past the J Z sign the stair down to the hall opens in the floor with parapets round it and a wall at its far end, and the walk goes down it into the hall with nothing in the way.

## Scope and boundaries

- In scope: the floor round a stair going down from a room, the room's walls where a stair crosses them, a stair's side and head walls where that floor runs beside them, and the stair's own ceiling.
- Out of scope: routes, stair widths, the station data and the camera.
- Dependencies/uncertainty: Fulton St's hall height is approximate (#97).

## Acceptance criteria

- [ ] Replaying the trip preview's camera along the live walk to the E exit, the stair from the mezzanine down to the hall shows a clean opening, with no wall pieces at odd angles, dark gaps or slab across it
- [ ] No wall stands across that stair's treads
- [ ] Steps stay 2 m wide and routes are unchanged; unit tests, typecheck and lint pass
- [ ] A fresh live recording is clean from 60 to 73 s

## Evidence and sources

- The live recording after #116 (10:35 UTC): from about 64 s, wall pieces at odd angles and dark gaps round the opening, a dark slab across it, and at about 68 s a wall filling the view.
- The player's camera replayed along the live route in a local build on the MacBook Pro matches it. Raycasts at those frames: a hall wall 1.8 m up the stair on its middle line; nothing at all past the opening's far end; the stair's sloping ceiling facing the floor above.
- The stair's cells in the data are 4.3 m wide and it is drawn 2 m wide; the mezzanine's floor had a hole the width of the cells.
- 26 fixed views of Fulton St stairs change only by walls closing gaps over openings and fewer stray walls.
- Unit tests passed (1,820); typecheck and lint clean.

## Reproduction details (only when needed)

Starting revision d13b69e. Ask the live app "take the 4 train from Grand Central to Fulton Street leaving at 9am tomorrow", play the preview, and watch the step "Use the E exit on Fulton Street" past the J Z sign.

## Related records

- Required leaf owning issue, parent ancestry and dependencies (or explicitly none): #117; follows #115
- Primary writer / branch / source issue revision / as-of status: claude-code / fix/fulton-stair-footprint / 2026-11-11
- Related PR/CI evidence and push receipt (request ID / SHA):

## Checkpoint log

No checkpoints yet.
