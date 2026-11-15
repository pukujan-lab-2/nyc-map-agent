# TASK-NMA-0064 — Outage Walk

<!-- continuity:task {"acceptance":["replace this with observable, task-specific acceptance checks"],"depends_on":[],"goal":"An elevator or escalator notice opens as short spoken steps, with the detour split by where the rider is","id":"NMA-0064","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/208","next_action":"define scope and observable acceptance checks, then begin bounded work","owner":"unassigned","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Owner, 2026-11-14: wish it did same for escalator and elevator"} -->

- Status: active
- Owner: unassigned
- Priority: P1
- Depends on: none

## Goal

An elevator or escalator notice opens as short spoken steps, with the detour split by where the rider is

## Why

Owner, 2026-11-14: wish it did same for escalator and elevator

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

### 2026-11-15 04:29:01 UTC — agent:claude-code/abf81021-c394-4e17-a76d-dd9aafb3f1e3

<!-- continuity:checkpoint {"agent":"agent:claude-code/abf81021-c394-4e17-a76d-dd9aafb3f1e3","blocked":[],"changed":["src/features/transit/outageWalk.ts, NoticeDiagram.tsx, LinePanel.tsx, lineNotices.ts, noticeLang.ts, e2e/line-notices.spec.ts, .size-limit.json"],"completed":["An elevator or escalator notice was a block of text with nothing read aloud; it now opens as spoken steps: each unit, why, until when, then the detour one instruction a step by where the rider is"],"decisions":["no new decisions"],"evidence":["On the MacBook Pro all unit tests pass (2106), the type check, lint and size budgets pass, and the line notice browser tests pass (29 cases, 5 new for the elevator walk and its translation)"],"next_action":"After the pull request for #208 deploys, open Elevator and 2 escalators out at Fulton St on the A line","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0064","timestamp":"2026-11-15T04:29:01Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"c68fb12ff8b31457cf43d12c7887ca2b65bff81d9eef04ee964e1bfc87ca5829","request_id":"219852c48a1b4f05a75f324e2e1c56dc","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0064"} -->

Completed:
- An elevator or escalator notice was a block of text with nothing read aloud; it now opens as spoken steps: each unit, why, until when, then the detour one instruction a step by where the rider is

Evidence:
- On the MacBook Pro all unit tests pass (2106), the type check, lint and size budgets pass, and the line notice browser tests pass (29 cases, 5 new for the elevator walk and its translation)

Decisions:
- no new decisions

Changed:
- src/features/transit/outageWalk.ts, NoticeDiagram.tsx, LinePanel.tsx, lineNotices.ts, noticeLang.ts, e2e/line-notices.spec.ts, .size-limit.json

Blocked/uncertain:
- none

Next:
- After the pull request for #208 deploys, open Elevator and 2 escalators out at Fulton St on the A line

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
