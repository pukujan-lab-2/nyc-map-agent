# TASK-NMA-0065 — Train Run First

<!-- continuity:task {"acceptance":["replace this with observable, task-specific acceptance checks"],"depends_on":[],"goal":"Subway trains on the map take a normal time to run between stations, and stop for what the gap leaves.","id":"NMA-0065","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/257","next_action":"define scope and observable acceptance checks, then begin bounded work","owner":"claude-code","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The map gave every station a fixed stop and took it out of the run, so 12.9% of drawn legs were faster than a subway car can go (#257)."} -->

- Status: active
- Owner: claude-code
- Priority: P2
- Depends on: none

## Goal

Subway trains on the map take a normal time to run between stations, and stop for what the gap leaves.

## Why

The map gave every station a fixed stop and took it out of the run, so 12.9% of drawn legs were faster than a subway car can go (#257).

## Allowed files

- define bounded paths before implementation.

## Human outcome

Describe what becomes easier, safer, clearer, or possible when this task is complete.

## Scope and boundaries

- In scope:
- Out of scope:
- Dependencies/uncertainty:

## Acceptance criteria

- [ ] state observable, task-specific outcomes.

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

### 2026-11-20 16:21:07 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":["none"],"changed":["src/features/transit/dwell.ts, model.ts, four test files, checkpoints/CURRENT.md, this task record"],"completed":["Reversed the split of each gap between arrivals: the subway run gets its normal time for the distance first, and the station stop gets the rest"],"decisions":["run time is 1.5 times the fastest possible run for the distance, calibrated on seven days of subwaydata.nyc; station defaults stay as the upper limit; commuter rail is left as it was"],"evidence":["nothing this change touches fails (218 transit tests and the full 2,252 unit tests pass; type check and lint clean); on one live snapshot of 12,921 drawn legs, the share faster than a subway car can go falls from 12.9% to 0.5%"],"evidence_class":"observed","next_action":"open the pull request that closes #257, then look at trains on the live map after deploy","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0065","timestamp":"2026-11-20T16:21:07Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"38c2d73eb5a22eb66aa8f5802f5fe578fdfe5a1558ec87fedc1578a9a57181d8","request_id":"29f2f2e575b649be8aa3c4220efad745","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0065"} -->

Completed:
- Reversed the split of each gap between arrivals: the subway run gets its normal time for the distance first, and the station stop gets the rest

Evidence:
- nothing this change touches fails (218 transit tests and the full 2,252 unit tests pass; type check and lint clean); on one live snapshot of 12,921 drawn legs, the share faster than a subway car can go falls from 12.9% to 0.5%

Decisions:
- run time is 1.5 times the fastest possible run for the distance, calibrated on seven days of subwaydata.nyc; station defaults stay as the upper limit; commuter rail is left as it was

Changed:
- src/features/transit/dwell.ts, model.ts, four test files, checkpoints/CURRENT.md, this task record

Blocked/uncertain:
- none

Next:
- open the pull request that closes #257, then look at trains on the live map after deploy

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
