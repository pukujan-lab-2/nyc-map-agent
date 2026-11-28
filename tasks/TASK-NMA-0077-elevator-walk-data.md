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

### 2026-11-28 01:36:10 UTC — agent:claude-code/b525f1c1-5adf-4746-8520-2cc2f4859686

<!-- continuity:checkpoint {"agent":"agent:claude-code/b525f1c1-5adf-4746-8520-2cc2f4859686","blocked":[],"changed":["src/features/transit/elevatorWalk.ts, its test and fixtures, scripts/elevator-walk-report.ts"],"completed":["Elevator outages had no walk data; each outage now reads as street or inside, its elevator entrance (or unsure), the detour as journeys, and each detour station's elevator entrance or not in our data."],"decisions":["Corners come from a bearing to the MTA's intersection; when it lands near a quarter line, each corner gets the nearest entrance only if that pairing is clearly best."],"evidence":["15 new unit tests pass on the feeds saved 2026-11-27; on the 19 outages out that day, 4 of 11 street elevators match an entrance, none unsure, 7 at stations with no elevator entrance in our data, 18 detours read into journeys."],"evidence_class":"observed","next_action":"Open the pull request with auto-merge; then the elevator walk screen uses this data.","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0077","timestamp":"2026-11-28T01:36:10Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"398f241bf8cc791f84c21994b5a75bd94d7ed2065bf3ddc487487b6a33bc80c8","request_id":"b4500ecce1964da1ae8c4262a90b0e80","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0077"} -->

Completed:
- Elevator outages had no walk data; each outage now reads as street or inside, its elevator entrance (or unsure), the detour as journeys, and each detour station's elevator entrance or not in our data.

Evidence:
- 15 new unit tests pass on the feeds saved 2026-11-27; on the 19 outages out that day, 4 of 11 street elevators match an entrance, none unsure, 7 at stations with no elevator entrance in our data, 18 detours read into journeys.

Decisions:
- Corners come from a bearing to the MTA's intersection; when it lands near a quarter line, each corner gets the nearest entrance only if that pairing is clearly best.

Changed:
- src/features/transit/elevatorWalk.ts, its test and fixtures, scripts/elevator-walk-report.ts

Blocked/uncertain:
- none

Next:
- Open the pull request with auto-merge; then the elevator walk screen uses this data.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
