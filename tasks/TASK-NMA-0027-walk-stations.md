# TASK-NMA-0027 — Walk Stations

<!-- continuity:task {"acceptance":["walking onto a street stair takes you down it to the platforms at the right depth","underground you see floors, walls, ceilings, stairs and track beds","walls, platform edges and floors stop you","elevated stations take you up to the platform over the real city","walking back up returns you to the street"],"depends_on":[],"goal":"Walk into a station from street view: down the stairs to the platforms below the street, or up to an elevated platform over the city","id":"NMA-0027","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/62","next_action":"after the pull request merges, walk into Fulton St and an elevated station on a phone","owner":"claude-code","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Street view stopped at the pavement: walking onto a station stair did nothing, you could walk through walls, and elevated stations had no platforms at all"} -->

- Status: active
- Owner: claude-code
- Priority: P1
- Depends on: none

## Goal

Walk into a station from street view: down the stairs to the platforms below the street, or up to an elevated platform over the city

## Why

Street view stopped at the pavement: walking onto a station stair did nothing, you could walk through walls, and elevated stations had no platforms at all

## Allowed files

- `src/lib/map/stationWalk.ts`, `src/lib/map/stationNear.ts`, `src/lib/map/three/stationScene.ts` and the walk test
- `src/components/StationInside.tsx`, `src/components/MapView.tsx`, the `__walk` test handle in `src/features/transit/TransitLayer.tsx`
- `scripts/build-elevated.ts`, `public/transit/elevated.json`, `e2e/station-walk.spec.ts`

## Human outcome

In street view you can walk down a station's stairs to its platforms, or up to an elevated platform and look out over the city, and the walls and platform edges hold you in.

## Scope and boundaries

- In scope: a walkable model of each station built from the x-ray data and a new elevated-station file; the view below the street on its own canvas; the elevated platform drawn on the map.
- Out of scope: trains pulling in, station signs and exits by name, escalators that move.
- Dependencies/uncertainty: OpenStreetMap maps street stairs for only 21 of the 155 elevated stations, so most of their stairs are added where the entrance is; 13 of 274 underground and 7 of 155 elevated stations still have a platform you cannot reach.

## Acceptance criteria

- [x] Walking onto a street stair takes you down it to the platforms at the right depth (Fulton St: street, mezzanine at -5 m, platforms at -10 m and -15 m).
- [x] Underground you see floors, walls, ceilings, stairs and the track beds.
- [x] Walls, platform edges and floors stop you; a move into a wall slides along it.
- [x] Elevated stations take you up to the platform, 10 m over the real city.
- [x] Walking back up returns you to the street.

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
