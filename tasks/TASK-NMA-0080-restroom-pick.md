# TASK-NMA-0080 — Restroom Pick

<!-- continuity:task {"acceptance":["replace this with observable, task-specific acceptance checks"],"depends_on":[],"goal":"Tapping Restroom picks the closest open restroom, public or business, by walking time, with its hours, a free public option within five minutes, the full list, Walk me there, Preview in Street view, and an anonymous arrival question.","id":"NMA-0080","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/249","next_action":"define scope and observable acceptance checks, then begin bounded work","owner":"agent:claude-code/94ef3e28-8d0f-4048-93f6-0adc43bf4845","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Restroom asked the agent, which named a public restroom and could not say whether it was open; the owner decided on 2026-11-27 that the app shows where the nearest open restrooms are and when they are open, and lets the rider choose."} -->

- Status: active
- Owner: agent:claude-code/94ef3e28-8d0f-4048-93f6-0adc43bf4845
- Priority: P1
- Depends on: none

## Goal

Tapping Restroom picks the closest open restroom, public or business, by walking time, with its hours, a free public option within five minutes, the full list, Walk me there, Preview in Street view, and an anonymous arrival question.

## Why

Restroom asked the agent, which named a public restroom and could not say whether it was open; the owner decided on 2026-11-27 that the app shows where the nearest open restrooms are and when they are open, and lets the rider choose.

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

### 2026-11-28 07:54:11 UTC — agent:claude-code/94ef3e28-8d0f-4048-93f6-0adc43bf4845

<!-- continuity:checkpoint {"agent":"agent:claude-code/94ef3e28-8d0f-4048-93f6-0adc43bf4845","blocked":[],"changed":["server/lib/openingHours.ts, server/features/place-toilets, server/features/restrooms, src/features/restrooms, src/features/place-toilets, src/lib/geo/sharedLocation.ts"],"completed":["Restroom opens the closest open restroom with hours, a free option within five minutes, the full list, Walk me there, Preview in Street view and the arrival question; open now is read in New York time on the server"],"decisions":["no new decisions"],"evidence":["unit suite 2,389 passed after the rebase; 12 new browser layout cases pass at four sizes; 155 related browser tests pass"],"evidence_class":"observed","next_action":"let pull request 294 merge, then walk to a caf\u00e9 restroom with a phone and answer the question","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0080","timestamp":"2026-11-28T07:54:11Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"a97e5808eba1d0307e2246c6653cacf5ea945c83d30ab4ff6509924a86d4eeac","request_id":"6c753f1a5df14d6dbf9603c78e3aa52a","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0080"} -->

Completed:
- Restroom opens the closest open restroom with hours, a free option within five minutes, the full list, Walk me there, Preview in Street view and the arrival question; open now is read in New York time on the server

Evidence:
- unit suite 2,389 passed after the rebase; 12 new browser layout cases pass at four sizes; 155 related browser tests pass

Decisions:
- no new decisions

Changed:
- server/lib/openingHours.ts, server/features/place-toilets, server/features/restrooms, src/features/restrooms, src/features/place-toilets, src/lib/geo/sharedLocation.ts

Blocked/uncertain:
- none

Next:
- let pull request 294 merge, then walk to a café restroom with a phone and answer the question

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
