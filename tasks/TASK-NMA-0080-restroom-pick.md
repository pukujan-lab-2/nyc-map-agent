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

### 2026-11-28 12:42:55 UTC — agent:claude-code/94ef3e28-8d0f-4048-93f6-0adc43bf4845

<!-- continuity:checkpoint {"agent":"agent:claude-code/94ef3e28-8d0f-4048-93f6-0adc43bf4845","blocked":[],"changed":["src/lib/store/restroomPick.ts, src/features/agent/AgentOverlay.tsx, .size-limit.json"],"completed":["Rebased onto main after the fast browser test set landed; resolved the checkpoint and size-limit conflicts; a Restroom tap before the pick's lazy code loads now waits for it instead of asking the agent"],"decisions":["no new decisions"],"evidence":["the restroom pick passes alone at desktop after the rebase; restroomPick unit tests pass; size budgets fit"],"evidence_class":"observed","next_action":"finish the local rerun of the failing browser specs one at a time; re-arm auto-merge on pull request 294 when they pass","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0080","timestamp":"2026-11-28T12:42:55Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"af7817d27e789b29a46de9faf27cfd2c343428369d12b68df4f990b006a79528","request_id":"ab09e4dd4232402eb9afc7a69cdc41c9","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0080"} -->

Completed:
- Rebased onto main after the fast browser test set landed; resolved the checkpoint and size-limit conflicts; a Restroom tap before the pick's lazy code loads now waits for it instead of asking the agent

Evidence:
- the restroom pick passes alone at desktop after the rebase; restroomPick unit tests pass; size budgets fit

Decisions:
- no new decisions

Changed:
- src/lib/store/restroomPick.ts, src/features/agent/AgentOverlay.tsx, .size-limit.json

Blocked/uncertain:
- none

Next:
- finish the local rerun of the failing browser specs one at a time; re-arm auto-merge on pull request 294 when they pass

### 2026-11-28 13:01:59 UTC — agent:claude-code/94ef3e28-8d0f-4048-93f6-0adc43bf4845

<!-- continuity:checkpoint {"agent":"agent:claude-code/94ef3e28-8d0f-4048-93f6-0adc43bf4845","blocked":[],"changed":["openapi.json, src/lib/api/schema.d.ts, checkpoints/CURRENT.md"],"completed":["Rebased onto main after pull request 285 added the transit-notices routes, so openapi.json no longer drops them and the API change is additive"],"decisions":["no new decisions"],"evidence":["every path and operation in main's openapi.json is in the branch's; openapi:check passes; 752 server and restroom unit tests pass"],"evidence_class":"observed","next_action":"let CI's api and e2e jobs pass on pull request 294 and auto-merge land it","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0080","timestamp":"2026-11-28T13:01:59Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"dc0df9b836a875992bfcdbb29b840bd9792fcfb3709927d550640de106e9d882","request_id":"965cc45d0db84609852aa82acfc38133","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0080"} -->

Completed:
- Rebased onto main after pull request 285 added the transit-notices routes, so openapi.json no longer drops them and the API change is additive

Evidence:
- every path and operation in main's openapi.json is in the branch's; openapi:check passes; 752 server and restroom unit tests pass

Decisions:
- no new decisions

Changed:
- openapi.json, src/lib/api/schema.d.ts, checkpoints/CURRENT.md

Blocked/uncertain:
- none

Next:
- let CI's api and e2e jobs pass on pull request 294 and auto-merge land it

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
