# TASK-NMA-0069 — Train Connection Stops

<!-- continuity:task {"acceptance":["replace this with observable, task-specific acceptance checks"],"depends_on":[],"goal":"No subway stop is drawn longer than 40 s, and a transfer station gets the longer stop only while a connecting train is arriving.","id":"NMA-0069","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/273","next_action":"define scope and observable acceptance checks, then begin bounded work","owner":"claude-code","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Trains were drawn stopping up to 60 s at transfer stations whether or not anything was there to wait for (#273)."} -->

- Status: active
- Owner: claude-code
- Priority: P2
- Depends on: none

## Goal

No subway stop is drawn longer than 40 s, and a transfer station gets the longer stop only while a connecting train is arriving.

## Why

Trains were drawn stopping up to 60 s at transfer stations whether or not anything was there to wait for (#273).

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

### 2026-11-20 20:41:31 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":["none"],"changed":["src/features/transit/connections.ts and its test, dwell.ts, model.ts, TransitLayer.tsx, holds.json, dwell.test.ts, checkpoints/CURRENT.md, this task record"],"completed":["Capped every drawn subway stop at 40 s and gave transfer stations the longer stop only while a connecting train is arriving"],"decisions":["a connection is a train of another service due on the same platform from 15 s before to 30 s after; the 20 to 40 s range is the owner's observation"],"evidence":["nothing this change touches fails (all 2,292 unit tests pass; type check, lint and the dependency rules are clean); on a live snapshot of 1,862 stops the share over 40 s falls from 13.1% to none and 63 of 433 stops at transfer stations have a connection arriving; not watched on the live map"],"evidence_class":"observed","next_action":"open the pull request that closes #273","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0069","timestamp":"2026-11-20T20:41:31Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"d0882b5289b63d964b674662a313253c1cbfa0d96f2866c81777df79e42d2787","request_id":"78e8363c61894b109b6647862059b2d5","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0069"} -->

Completed:
- Capped every drawn subway stop at 40 s and gave transfer stations the longer stop only while a connecting train is arriving

Evidence:
- nothing this change touches fails (all 2,292 unit tests pass; type check, lint and the dependency rules are clean); on a live snapshot of 1,862 stops the share over 40 s falls from 13.1% to none and 63 of 433 stops at transfer stations have a connection arriving; not watched on the live map

Decisions:
- a connection is a train of another service due on the same platform from 15 s before to 30 s after; the 20 to 40 s range is the owner's observation

Changed:
- src/features/transit/connections.ts and its test, dwell.ts, model.ts, TransitLayer.tsx, holds.json, dwell.test.ts, checkpoints/CURRENT.md, this task record

Blocked/uncertain:
- none

Next:
- open the pull request that closes #273

### 2026-11-20 20:42:05 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":["none"],"changed":["nothing since the last checkpoint"],"completed":["Opened the pull request for the 40 s limit and the connection rule"],"decisions":["no new decisions"],"evidence":["the description passes the repository's shape check and all 2,292 unit tests pass; CI has not finished"],"evidence_class":"observed","next_action":"read CI on pull request #274; it merges after #267","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0069","timestamp":"2026-11-20T20:42:05Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"6aa7ae0561902cb9a3166958b9873faf6b82beed2eaab75760161171ed17cf03","request_id":"57af5f8bb70644c9b6e5c66c8cbd429f","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0069"} -->

Completed:
- Opened the pull request for the 40 s limit and the connection rule

Evidence:
- the description passes the repository's shape check and all 2,292 unit tests pass; CI has not finished

Decisions:
- no new decisions

Changed:
- nothing since the last checkpoint

Blocked/uncertain:
- none

Next:
- read CI on pull request #274; it merges after #267

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
