# TASK-NMA-0092 — E2E Shards

<!-- continuity:task {"acceptance":["replace this with observable, task-specific acceptance checks"],"depends_on":[],"goal":"Split a full browser-test run across three runners so it finishes in about 22 minutes","id":"NMA-0092","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/33","next_action":"define scope and observable acceptance checks, then begin bounded work","owner":"agent:claude-code/bf69a9d6-00a8-40c8-a53f-fa55af80f5e6","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"A full run took about 52 minutes on one runner and the owner asked for lighter CI"} -->

- Status: active
- Owner: agent:claude-code/bf69a9d6-00a8-40c8-a53f-fa55af80f5e6
- Priority: P1
- Depends on: none

## Goal

Split a full browser-test run across three runners so it finishes in about 22 minutes

## Why

A full run took about 52 minutes on one runner and the owner asked for lighter CI

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

### 2026-11-28 10:32:33 UTC — agent:claude-code/bf69a9d6-00a8-40c8-a53f-fa55af80f5e6

<!-- continuity:checkpoint {"agent":"agent:claude-code/bf69a9d6-00a8-40c8-a53f-fa55af80f5e6","blocked":[],"changed":[".github/workflows/ci.yml, checkpoints/CURRENT.md"],"completed":["A full browser-test run in .github/workflows/ci.yml is split three ways across runners, with an e2e summary job that keeps the required check's name"],"decisions":["no new decisions"],"evidence":["Per-spec times from pull request 283's run put the three parts at about 16, 14 and 22 minutes, against 52 on one runner"],"evidence_class":"inferred","next_action":"Confirm pull request 297's own split run passes in about 25 minutes, then rebase 285, 287, 288 and 289 onto main","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0092","timestamp":"2026-11-28T10:32:33Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"5722d5a6bfdbc41df0a2badd96159db9f39a2aedd48c0911aabc8a82862814d9","request_id":"fa544ab44e6e47a59a139faccbdc255c","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0092"} -->

Completed:
- A full browser-test run in .github/workflows/ci.yml is split three ways across runners, with an e2e summary job that keeps the required check's name

Evidence:
- Per-spec times from pull request 283's run put the three parts at about 16, 14 and 22 minutes, against 52 on one runner

Decisions:
- no new decisions

Changed:
- .github/workflows/ci.yml, checkpoints/CURRENT.md

Blocked/uncertain:
- none

Next:
- Confirm pull request 297's own split run passes in about 25 minutes, then rebase 285, 287, 288 and 289 onto main

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
