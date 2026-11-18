# TASK-NMA-0065 — Camera First Guidance

<!-- continuity:task {"acceptance":["Open Camera view from the Union Square demo and see the camera, current floor and minimap.","Scan Elevator to L and see the checkpoint change from platform to mezzanine.","Align the camera, turn it, and see the arrow change. Lose heading updates and keep the map and written direction.","Return to the map and confirm the camera stream stops."],"depends_on":[],"goal":"Show camera-first direction after a subway sign scan","id":"NMA-0065","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/232","next_action":"Rehearse the demo on a physical phone with a saved photo on a second screen.","owner":"agent:codex/01a1ec5e-b70c-7342-bade-77e99cb521db","priority":"high","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"A rider needs to see their next direction and a map while facing a station corridor."} -->

- Status: active
- Owner: agent:codex/01a1ec5e-b70c-7342-bade-77e99cb521db
- Priority: high
- Depends on: none

## Goal

Show camera-first direction after a subway sign scan

## Why

A rider needs to see their next direction and a map while facing a station corridor.

## Allowed files

- Walk guide, browser checks, and continuity records.

## Human outcome

The rider can see the corridor, the route and the next instruction together. They can still read directions if the phone stops giving heading updates.

## Scope and boundaries

- The opt-in Union Square simulation uses the existing sign reader, one route leg and phone orientation after manual alignment.
- Floor tracking in other stations, continuous position in the camera view and arrows pinned to the scene remain separate work.
- The scan needs the sign service. The arrow needs fresh orientation readings.

## Acceptance criteria

- [x] Open Camera view from the Union Square demo and see the camera, current floor and minimap.
- [x] Scan Elevator to L and see the checkpoint change from platform to mezzanine.
- [x] Align the camera, turn it, and see the arrow change. Lose heading updates and keep the map and written direction.
- [x] Return to the map and confirm the camera stream stops.

## Evidence and sources

The browser checks exercise the four required layouts, the sign response, arrow rotation, heading loss, and camera shutdown. The browser recording sends the saved public sign photo to the live service and uses simulated orientation events.

## Reproduction details (only when needed)

Open `/?flags=+walkGuide&walkDemo=union-square` and select Camera view. Scan the Elevator to L photo. Face along the corridor, select Align arrow and turn the phone. Use the map when heading is unavailable.

## Related records

- [Automatic floor detection](https://github.com/pukujan-lab-2/nyc-map-agent/issues/232) remains open.
- The camera view builds on the [Union Square sign demo](https://github.com/pukujan-lab-2/nyc-map-agent/pull/234).

## Checkpoint log

No checkpoints yet.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
