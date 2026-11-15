# TASK-NMA-0059 — Bus Layover Jump

<!-- continuity:task {"acceptance":["The recorded reports of the parked M22 (bus 9673) replay with no jump and no backward movement, and the same test fails on the code before the fix","On a route that comes back down the street it went up, the bus's distance along the route never falls","The follow mini map names the next stop or shows nothing, never a stop id","After the deploy, a bus waiting at a terminal is watched on the live site for a few minutes with no backward jump"],"depends_on":[],"goal":"A bus on the map stays where the bus is: a bus waiting at its terminal is drawn waiting, and no bus jumps backward","id":"NMA-0059","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/200","next_action":"merge the pull request, then watch a bus on layover on the live site","owner":"agent:claude-code/8fe2e67a-1ee6-4ca6-be82-0ca5e680b896","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"On the live site a followed M22 parked at its Battery Park City terminal was drawn driving ahead and snapping back about four times"} -->

- Status: active
- Owner: agent:claude-code/8fe2e67a-1ee6-4ca6-be82-0ca5e680b896
- Priority: P1
- Depends on: none

## Goal

A bus on the map stays where the bus is: a bus waiting at its terminal is drawn waiting, and no bus jumps backward

## Why

On the live site a followed M22 parked at its Battery Park City terminal was drawn driving ahead and snapping back about four times

## Allowed files

- `src/features/transit/busEstimate.ts`, its test and `busLayover.fixture.json`
- `src/features/transit/followInfo.ts` and its test
- `src/features/transit/TransitLayer.tsx` (the mini map's stop name only)
- `e2e/panel-slot.spec.ts`

## Human outcome

Someone following a bus sees it where it is. A bus waiting to start its trip waits on the map too, and no bus snaps back along its route.

## Scope and boundaries

- In scope: the bus motion estimator and the follow mini map's next stop.
- Out of scope: trains, the server's bus feed code, and joining Bus Time's route pieces into one line per direction.
- Dependencies/uncertainty: the recording is one evening, one route, ten minutes.

## Acceptance criteria

- [ ] The recorded reports of the parked M22 (bus 9673) replay with no jump and no backward movement, and the same test fails on the code before the fix
- [ ] On a route that comes back down the street it went up, the bus's distance along the route never falls
- [ ] The follow mini map names the next stop or shows nothing, never a stop id
- [ ] After the deploy, a bus waiting at a terminal is watched on the live site for a few minutes with no backward jump

## Evidence and sources

The investigation record is issue #200. The recorded reports are `src/features/transit/busLayover.fixture.json`.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Required leaf owning issue, parent ancestry and dependencies (or explicitly none): #200, no parent
- Primary writer / branch / source issue revision / as-of status: this session, branch `fix/200-bus-layover-jump`
- Related PR/CI evidence and push receipt (request ID / SHA):

## Checkpoint log

No checkpoints yet.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
