# TASK-NMA-0066 — Train Motion Score

<!-- continuity:task {"acceptance":["replace this with observable, task-specific acceptance checks"],"depends_on":[],"goal":"The tracker health page shows how subway trains are drawn: how many stand at a station and how many stretches are run faster than a train can go.","id":"NMA-0066","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/260","next_action":"define scope and observable acceptance checks, then begin bounded work","owner":"claude-code","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Nothing measured drawn motion, so the racing in #257 was caught only because the owner watched the map (#260)."} -->

- Status: active
- Owner: claude-code
- Priority: P2
- Depends on: none

## Goal

The tracker health page shows how subway trains are drawn: how many stand at a station and how many stretches are run faster than a train can go.

## Why

Nothing measured drawn motion, so the racing in #257 was caught only because the owner watched the map (#260).

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

### 2026-11-20 17:21:12 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":["the pull request waits for #258 to merge, so its diff holds only this change"],"changed":["server/features/transit/motionScore.ts and its test, health.ts, scripts/transit-observe.ts, a migration, TrackerHealthPage.tsx, e2e/tracker-health.spec.ts, model.ts, dwell.ts, openapi.json"],"completed":["Built the score for how subway trains are drawn: counts in the observer job, a table, the totals in the accuracy endpoint and a card on the tracker health page"],"decisions":["the score imports the map's own motion code so it cannot drift from what is drawn; lines with a service notice are counted apart"],"evidence":["nothing this change touches fails (2,274 unit tests pass; type check and lint clean); the card's browser test has not run, because the test browser would not install locally; on one live snapshot the score reads 223 of 509 trains standing at a station and 14 of 1,663 stretches faster than a subway car can go"],"evidence_class":"observed","next_action":"open the pull request for #260 once #258 merges, and read CI's browser test result for the new card","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0066","timestamp":"2026-11-20T17:21:12Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"1bc6e53290dc2d4a6fe247451ff4760006c24bdb082768ecd46462c6a378d1a6","request_id":"b1cfff31ae154433821d91f4cb1bc616","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0066"} -->

Completed:
- Built the score for how subway trains are drawn: counts in the observer job, a table, the totals in the accuracy endpoint and a card on the tracker health page

Evidence:
- nothing this change touches fails (2,274 unit tests pass; type check and lint clean); the card's browser test has not run, because the test browser would not install locally; on one live snapshot the score reads 223 of 509 trains standing at a station and 14 of 1,663 stretches faster than a subway car can go

Decisions:
- the score imports the map's own motion code so it cannot drift from what is drawn; lines with a service notice are counted apart

Changed:
- server/features/transit/motionScore.ts and its test, health.ts, scripts/transit-observe.ts, a migration, TrackerHealthPage.tsx, e2e/tracker-health.spec.ts, model.ts, dwell.ts, openapi.json

Blocked/uncertain:
- the pull request waits for #258 to merge, so its diff holds only this change

Next:
- open the pull request for #260 once #258 merges, and read CI's browser test result for the new card

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
