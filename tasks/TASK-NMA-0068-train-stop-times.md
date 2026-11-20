# TASK-NMA-0068 — Train Stop Times

<!-- continuity:task {"acceptance":["replace this with observable, task-specific acceptance checks"],"depends_on":[],"goal":"The observer measures how long subway trains stop at each station on the numbered lines and the 7.","id":"NMA-0068","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/270","next_action":"define scope and observable acceptance checks, then begin bounded work","owner":"claude-code","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The map's stop lengths are guesses and the stored dwell times are the feed's scheduled holds (#270)."} -->

- Status: active
- Owner: claude-code
- Priority: P2
- Depends on: none

## Goal

The observer measures how long subway trains stop at each station on the numbered lines and the 7.

## Why

The map's stop lengths are guesses and the stored dwell times are the feed's scheduled holds (#270).

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

### 2026-11-20 18:46:57 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":["none"],"changed":["server/features/transit/stopObserve.ts and its test, scripts/transit-observe.ts, a migration, checkpoints/CURRENT.md, this task record"],"completed":["Built the stop observer: it times each stop on the numbered lines and the 7 two ways and stores both, with an hourly rollup"],"decisions":["both timings are stored because neither has been checked against a stopwatch; lettered lines and the L are left out; rows are kept 30 days"],"evidence":["nothing this change touches fails (all 2,286 unit tests pass; type check, lint and the dependency rules are clean); replaying a 520 s live recording gives a median stop of 30 s from the feed and 54 s from the vehicle report, a near-constant 25 s apart on 563 stops; the migration and the database writes have not run against the database"],"evidence_class":"observed","next_action":"open the pull request that closes #270","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0068","timestamp":"2026-11-20T18:46:57Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"a94518e6d49b67df0997c9bb3d863b8c77cea2fcdad56b1b0430f46c114b4a9e","request_id":"3d324d22ad544fc0856fb0b212f69129","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0068"} -->

Completed:
- Built the stop observer: it times each stop on the numbered lines and the 7 two ways and stores both, with an hourly rollup

Evidence:
- nothing this change touches fails (all 2,286 unit tests pass; type check, lint and the dependency rules are clean); replaying a 520 s live recording gives a median stop of 30 s from the feed and 54 s from the vehicle report, a near-constant 25 s apart on 563 stops; the migration and the database writes have not run against the database

Decisions:
- both timings are stored because neither has been checked against a stopwatch; lettered lines and the L are left out; rows are kept 30 days

Changed:
- server/features/transit/stopObserve.ts and its test, scripts/transit-observe.ts, a migration, checkpoints/CURRENT.md, this task record

Blocked/uncertain:
- none

Next:
- open the pull request that closes #270

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
