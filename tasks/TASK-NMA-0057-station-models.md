# TASK-NMA-0057 — Station Models

<!-- continuity:task {"acceptance":["replace this with observable, task-specific acceptance checks"],"depends_on":[],"goal":"Show Brooklyn Bridge\u2013City Hall and Atlantic Av\u2013Barclays Ctr as dollhouse walks, like Fulton St","id":"NMA-0057","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/161","next_action":"define scope and observable acceptance checks, then begin bounded work","owner":"agent:claude-code/d7f4e707-ecca-44ef-bcd3-b62d8ce1f063","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Trips ending at those stations had no station model before the demo on 2026-11-14"} -->

- Status: active
- Owner: agent:claude-code/d7f4e707-ecca-44ef-bcd3-b62d8ce1f063
- Priority: P1
- Depends on: none

## Goal

Show Brooklyn Bridge–City Hall and Atlantic Av–Barclays Ctr as dollhouse walks, like Fulton St

## Why

Trips ending at those stations had no station model before the demo on 2026-11-14

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

### 2026-11-13 12:43:04 UTC — agent:claude-code/d7f4e707-ecca-44ef-bcd3-b62d8ce1f063

<!-- continuity:checkpoint {"agent":"agent:claude-code/d7f4e707-ecca-44ef-bcd3-b62d8ce1f063","blocked":[],"changed":["none"],"completed":["Trips to Brooklyn Bridge\u2013City Hall and Atlantic Av\u2013Barclays Ctr had no station model; both now have dollhouse walks fitted to the subway's track lines (PR #162)"],"decisions":["no new decisions"],"evidence":["Type check passes; the full unit suite passes (1,892 tests); the dollhouse e2e layout and credit cases pass at four screen sizes"],"next_action":"After #162 deploys, play a 4 train trip from Grand Central to Brooklyn Bridge and one to Atlantic Av on the live site; once #153 merges, run its shell and gap tests over all three models","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0057","timestamp":"2026-11-13T12:43:04Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"45c7991df03b3bfba102b15e0f514dce099ea76dcf36a7cada750ca1e8322657","request_id":"dc075923df0348379a37a3bc9fc48c25","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0057"} -->

Completed:
- Trips to Brooklyn Bridge–City Hall and Atlantic Av–Barclays Ctr had no station model; both now have dollhouse walks fitted to the subway's track lines (PR #162)

Evidence:
- Type check passes; the full unit suite passes (1,892 tests); the dollhouse e2e layout and credit cases pass at four screen sizes

Decisions:
- no new decisions

Changed:
- none

Blocked/uncertain:
- none

Next:
- After #162 deploys, play a 4 train trip from Grand Central to Brooklyn Bridge and one to Atlantic Av on the live site; once #153 merges, run its shell and gap tests over all three models

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
