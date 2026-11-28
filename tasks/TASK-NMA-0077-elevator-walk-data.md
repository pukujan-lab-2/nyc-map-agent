# TASK-NMA-0077 — Elevator Walk Data

<!-- continuity:task {"acceptance":["EL131 at 161 St-Yankee Stadium pins the entrance at the NE corner of 161 St and River Av; EL132 reads as inside the station", "each detour splits into journeys with a start, legs and an end, and names each detour station's elevator entrance or says it is not in our data", "231 St's two corner elevators find their own entrances; 61 St-Woodside's street elevator is unsure rather than guessed", "a report script runs over today's outages and lists matched, unsure and missing entrances"],"depends_on":[],"goal":"Turn each elevator outage into walk data: street or inside, which elevator entrance it is, the detour as journeys, and the elevator entrance at each detour station; step 6 of docs/PLAN-notice-walks.md, data half.","id":"NMA-0077","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/208","next_action":"define scope and observable acceptance checks, then begin bounded work","owner":"agent:claude-code/b525f1c1-5adf-4746-8520-2cc2f4859686","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Elevator outages have no walk; Yankee Stadium's two broken elevators showed as one block of MTA text with different detours."} -->

- Status: active
- Owner: agent:claude-code/b525f1c1-5adf-4746-8520-2cc2f4859686
- Priority: P1
- Depends on: none

## Goal

Turn each elevator outage into walk data: street or inside, which elevator entrance it is, the detour as journeys, and the elevator entrance at each detour station; step 6 of docs/PLAN-notice-walks.md, data half.

## Why

Elevator outages have no walk; Yankee Stadium's two broken elevators showed as one block of MTA text with different detours.

## Allowed files

- src/features/transit/elevatorWalk.ts, its test and fixtures
- scripts/elevator-walk-report.ts
- checkpoints/CURRENT.md, this task record

## Human outcome

The elevator walk (a later step) can say which elevator is out, that stairs riders are not affected, and the step-free way from where the rider is, with the working elevator at each station the detour uses.

## Scope and boundaries

- In scope: a pure module and its data from the MTA's serving and alternative-route text.
- Out of scope: any screen change; the walk UI uses this data later.
- Dependencies/uncertainty: outages carry from/to/upcoming since #279. Our station data lacks elevator entrances at several stations.

## Acceptance criteria

- [ ] EL131 at 161 St-Yankee Stadium pins the entrance at the NE corner of 161 St and River Av; EL132 reads as inside the station
- [ ] each detour splits into journeys with a start, legs and an end, and names each detour station's elevator entrance or says it is not in our data
- [ ] 231 St's two corner elevators find their own entrances; 61 St-Woodside's street elevator is unsure rather than guessed
- [ ] a report script runs over today's outages and lists matched, unsure and missing entrances

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
