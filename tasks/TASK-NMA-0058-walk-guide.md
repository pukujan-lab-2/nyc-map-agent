# TASK-NMA-0058 — Walk Guide

<!-- continuity:task {"acceptance":["replace this with observable, task-specific acceptance checks"],"depends_on":[],"goal":"Guide a wheelchair rider sign by sign from the street elevator at Cortlandt St to the street at 14 St-Union Sq, with a camera scan that names the sign in front of them","id":"NMA-0058","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/88","next_action":"define scope and observable acceptance checks, then begin bounded work","owner":"agent:claude-code/1d22e75c-03c4-4c1f-811a-26cfc8b712a5","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Those stations have no model in the app, and the demo on 2026-11-14 tells this trip"} -->

- Status: active
- Owner: agent:claude-code/1d22e75c-03c4-4c1f-811a-26cfc8b712a5
- Priority: P1
- Depends on: none

## Goal

Guide a wheelchair rider sign by sign from the street elevator at Cortlandt St to the street at 14 St-Union Sq, with a camera scan that names the sign in front of them

## Why

Those stations have no model in the app, and the demo on 2026-11-14 tells this trip

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

### 2026-11-14 01:05:43 UTC — agent:claude-code/1d22e75c-03c4-4c1f-811a-26cfc8b712a5

<!-- continuity:checkpoint {"agent":"agent:claude-code/1d22e75c-03c4-4c1f-811a-26cfc8b712a5","blocked":[],"changed":["server/features/agent/seeSign.ts, src/features/walkguide/SignScan.tsx, openapi.json"],"completed":["The walk guide's Lost view can ask the server which sign a camera frame shows (pull request 175, on top of the walk guide in 174)"],"decisions":["no new decisions"],"evidence":["On the Pro: 20 unit tests, type check, lint on changed files, API spec check and the four layout cases pass; the camera itself is untried on a phone"],"next_action":"When 174 merges, point 175 at main and arm auto-merge; after it deploys, try the scan on a phone with ?flags=+walkGuide","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0058","timestamp":"2026-11-14T01:05:43Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"c5765362a7dd915537d82e4ead2361307f98b8c2eb668f34905af5bc74eebcec","request_id":"733e532af8334b0da4ca60d79620adb6","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0058"} -->

Completed:
- The walk guide's Lost view can ask the server which sign a camera frame shows (pull request 175, on top of the walk guide in 174)

Evidence:
- On the Pro: 20 unit tests, type check, lint on changed files, API spec check and the four layout cases pass; the camera itself is untried on a phone

Decisions:
- no new decisions

Changed:
- server/features/agent/seeSign.ts, src/features/walkguide/SignScan.tsx, openapi.json

Blocked/uncertain:
- none

Next:
- When 174 merges, point 175 at main and arm auto-merge; after it deploys, try the scan on a phone with ?flags=+walkGuide

### 2026-11-14 01:05:57 UTC — agent:claude-code/1d22e75c-03c4-4c1f-811a-26cfc8b712a5

<!-- continuity:checkpoint {"agent":"agent:claude-code/1d22e75c-03c4-4c1f-811a-26cfc8b712a5","blocked":[],"changed":["server/features/agent/seeSign.ts, src/features/walkguide/SignScan.tsx, openapi.json"],"completed":["The walk guide's Lost view can ask the server which sign a camera frame shows (pull request 175, on top of the walk guide in 174)"],"decisions":["no new decisions"],"evidence":["On the Pro: 20 unit tests, type check, lint on changed files, API spec check and the four layout cases pass; the camera itself is untried on a phone"],"next_action":"When 174 merges, point 175 at main and arm auto-merge; after it deploys, try the scan on a phone with ?flags=+walkGuide","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0058","timestamp":"2026-11-14T01:05:57Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"c5765362a7dd915537d82e4ead2361307f98b8c2eb668f34905af5bc74eebcec","request_id":"d1eae45b8e70468999268715676fdf92","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0058"} -->

Completed:
- The walk guide's Lost view can ask the server which sign a camera frame shows (pull request 175, on top of the walk guide in 174)

Evidence:
- On the Pro: 20 unit tests, type check, lint on changed files, API spec check and the four layout cases pass; the camera itself is untried on a phone

Decisions:
- no new decisions

Changed:
- server/features/agent/seeSign.ts, src/features/walkguide/SignScan.tsx, openapi.json

Blocked/uncertain:
- none

Next:
- When 174 merges, point 175 at main and arm auto-merge; after it deploys, try the scan on a phone with ?flags=+walkGuide

### 2026-11-14 02:25:38 UTC — agent:claude-code/1d22e75c-03c4-4c1f-811a-26cfc8b712a5

<!-- continuity:checkpoint {"agent":"agent:claude-code/1d22e75c-03c4-4c1f-811a-26cfc8b712a5","blocked":[],"changed":["merge of main into feat/88-sign-scan, four conflicts kept on this branch's side because main's copies were the walk guide's"],"completed":["The walk guide merged as pull request 174; the camera scan branch took main in and pull request 175 is mergeable again with auto-merge armed"],"decisions":["no new decisions"],"evidence":["174 merged with every check green; 175 shows MERGEABLE after the merge commit, its checks are re-running"],"next_action":"After 175 merges and deploys, open the live site with ?flags=+walkGuide on a phone, tap Lost and try the camera on a sign; then refit the Union Sq places to the 2026-11-13 evening recording, which has positions on the mezzanine","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0058","timestamp":"2026-11-14T02:25:38Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"c24966addf42a9e73ae8c923473b06b93665f54b7bdd48f84f61842e6187dd95","request_id":"0f98c4cbc6524313a61c70b947706970","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0058"} -->

Completed:
- The walk guide merged as pull request 174; the camera scan branch took main in and pull request 175 is mergeable again with auto-merge armed

Evidence:
- 174 merged with every check green; 175 shows MERGEABLE after the merge commit, its checks are re-running

Decisions:
- no new decisions

Changed:
- merge of main into feat/88-sign-scan, four conflicts kept on this branch's side because main's copies were the walk guide's

Blocked/uncertain:
- none

Next:
- After 175 merges and deploys, open the live site with ?flags=+walkGuide on a phone, tap Lost and try the camera on a sign; then refit the Union Sq places to the 2026-11-13 evening recording, which has positions on the mezzanine

### 2026-11-14 02:56:28 UTC — agent:claude-code/1d22e75c-03c4-4c1f-811a-26cfc8b712a5

<!-- continuity:checkpoint {"agent":"agent:claude-code/1d22e75c-03c4-4c1f-811a-26cfc8b712a5","blocked":[],"changed":["src/features/walkguide/WalkGuide.tsx, progress.ts, walks.ts, e2e/walk-guide.spec.ts, .size-limit.json"],"completed":["The walk guide can play the trip by itself and shows which way the walk faces; 14 St-Union Sq places now come from the evening recording (pull request 176)"],"decisions":["no new decisions"],"evidence":["On the Pro: 16 walk guide tests and the full unit run pass, type check and lint clean on changed files, four layout cases pass; not yet seen on the live site"],"next_action":"After 176 deploys, run Simulate the trip on the live site at laptop width; find why the check job failed on pull request 175 and get the camera scan merged; then test the scan with held-out frames from the evening recording","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0058","timestamp":"2026-11-14T02:56:28Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"474b7b736678c9b091a4fca5019e6d442ad56c8cf36fc9f870b043c81bc6bcec","request_id":"c0c7153b6dd3440a84ace3afa729830d","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0058"} -->

Completed:
- The walk guide can play the trip by itself and shows which way the walk faces; 14 St-Union Sq places now come from the evening recording (pull request 176)

Evidence:
- On the Pro: 16 walk guide tests and the full unit run pass, type check and lint clean on changed files, four layout cases pass; not yet seen on the live site

Decisions:
- no new decisions

Changed:
- src/features/walkguide/WalkGuide.tsx, progress.ts, walks.ts, e2e/walk-guide.spec.ts, .size-limit.json

Blocked/uncertain:
- none

Next:
- After 176 deploys, run Simulate the trip on the live site at laptop width; find why the check job failed on pull request 175 and get the camera scan merged; then test the scan with held-out frames from the evening recording

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
