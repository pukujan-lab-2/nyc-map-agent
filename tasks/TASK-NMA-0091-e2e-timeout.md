# TASK-NMA-0091 — E2E Timeout

<!-- continuity:task {"acceptance":["replace this with observable, task-specific acceptance checks"],"depends_on":[],"goal":"Give the browser-test job enough time for the full set of 297 tests","id":"NMA-0091","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/33","next_action":"define scope and observable acceptance checks, then begin bounded work","owner":"agent:claude-code/bf69a9d6-00a8-40c8-a53f-fa55af80f5e6","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The full set needs about 52 minutes on two workers and the 45-minute limit cut it off near test 250, so five notice-walk pull requests could not merge"} -->

- Status: active
- Owner: agent:claude-code/bf69a9d6-00a8-40c8-a53f-fa55af80f5e6
- Priority: P1
- Depends on: none

## Goal

Give the browser-test job enough time for the full set of 297 tests

## Why

The full set needs about 52 minutes on two workers and the 45-minute limit cut it off near test 250, so five notice-walk pull requests could not merge

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

### 2026-11-28 08:40:00 UTC — agent:claude-code/bf69a9d6-00a8-40c8-a53f-fa55af80f5e6

<!-- continuity:checkpoint {"agent":"agent:claude-code/bf69a9d6-00a8-40c8-a53f-fa55af80f5e6","blocked":[],"changed":[".github/workflows/ci.yml, checkpoints/CURRENT.md"],"completed":["The e2e job's limit in .github/workflows/ci.yml went from 45 to 75 minutes, because the full set of 297 browser tests needs about 52 and was cut off near test 250"],"decisions":["no new decisions"],"evidence":["On pull request 283 the Playwright step ran 44 minutes and reached test 250 of 297 with no failures left after retries"],"evidence_class":"observed","next_action":"When pull request 296 merges, rebase pull requests 283, 285, 287, 288 and 289 onto main two at a time so their browser tests run under the new limit","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0091","timestamp":"2026-11-28T08:40:00Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"132ffc1b3a38014f05d65206bbddb80f9f8972ae8c37b27159bd422d8b049242","request_id":"77d5adb16e1847c0a33be03fa2a235c0","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0091"} -->

Completed:
- The e2e job's limit in .github/workflows/ci.yml went from 45 to 75 minutes, because the full set of 297 browser tests needs about 52 and was cut off near test 250

Evidence:
- On pull request 283 the Playwright step ran 44 minutes and reached test 250 of 297 with no failures left after retries

Decisions:
- no new decisions

Changed:
- .github/workflows/ci.yml, checkpoints/CURRENT.md

Blocked/uncertain:
- none

Next:
- When pull request 296 merges, rebase pull requests 283, 285, 287, 288 and 289 onto main two at a time so their browser tests run under the new limit

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
