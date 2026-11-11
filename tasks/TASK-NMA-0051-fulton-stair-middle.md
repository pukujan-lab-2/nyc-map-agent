# TASK-NMA-0051 — Fulton Stair Middle

<!-- continuity:task {"acceptance":["Every route point partway down a stair at an angle to the station data's 0.5 m grid sits on that stair's line, within 5 cm","Replaying the trip preview's camera along the live walk to the E exit, the eye goes down the stair from the mezzanine to the hall on the middle of its treads, the same distance from each side wall, looking down the stair","The other stairs on the walk get no closer to a wall; unit tests, typecheck and lint pass"],"depends_on":[],"goal":"The trip to the E exit on Fulton Street goes down the middle of the stair from the mezzanine to the hall, looking down it","id":"NMA-0051","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/119","next_action":"Merge the pull request, then record the 4 train trip to Fulton St on the live site and check 60 to 70 s","owner":"claude-code","priority":"high","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The live recording after #118 showed mostly wall for about two seconds going down that stair, because the walk ran off its middle"} -->

- Status: active
- Owner: claude-code
- Priority: high
- Depends on: none

## Goal

The trip to the E exit on Fulton Street goes down the middle of the stair from the mezzanine to the hall, looking down it

## Why

The live recording after #118 showed mostly wall for about two seconds going down that stair, because the walk ran off its middle

## Allowed files

- src/lib/map/stationRoute.ts
- src/lib/map/stationRoute.test.ts
- checkpoints/CURRENT.md
- tasks/TASK-NMA-0050-fulton-stair-to-hall.md
- this task record

## Human outcome

Watching the trip to the E exit on Fulton Street, the walk goes down the stair from the mezzanine to the hall in the middle of its treads, with a wall on each side at the same distance, looking down the stair.

## Scope and boundaries

- In scope: where the route through a station runs on a stair whose line it already follows to within 0.3 m.
- Out of scope: where a route steps onto a stair from its side, stair widths, the station data, the scene and the camera rules.
- Dependencies/uncertainty: Fulton St's hall height is approximate (#97).

## Acceptance criteria

- [ ] Every route point partway down a stair at an angle to the station data's 0.5 m grid sits on that stair's line, within 5 cm
- [ ] Replaying the trip preview's camera along the live walk to the E exit, the eye goes down the stair from the mezzanine to the hall on the middle of its treads, the same distance from each side wall, looking down the stair
- [ ] The other stairs on the walk get no closer to a wall; unit tests, typecheck and lint pass

## Evidence and sources

- The live recording after #118: about 64 s in, going down the stair to the hall, one side wall takes most of the screen for about two seconds.
- The player's camera replayed in a local build on the MacBook Pro matches it. The route's points on that stair sat 0.2 to 0.27 m off its line, and the eye ran 0.76 m from one wall and 1.22 m from the other; the heading was already the stair's own, 45 degrees. With the points moved onto the line, the eye is 1 m from each wall.
- Moving points onto a stair's line from up to 1.3 m away made two later stairs worse; only points within 0.3 m move.

## Reproduction details (only when needed)

Starting revision e297663. Ask the live app "take the 4 train from Grand Central to Fulton Street leaving at 9am tomorrow", play the preview, and watch the step "Use the E exit on Fulton Street" down the stair to the hall.

## Related records

- Required leaf owning issue, parent ancestry and dependencies (or explicitly none): #119; follows #117
- Primary writer / branch / source issue revision / as-of status: claude-code / fix/fulton-stair-middle / 2026-11-11
- Related PR/CI evidence and push receipt (request ID / SHA):

## Checkpoint log

No checkpoints yet.
