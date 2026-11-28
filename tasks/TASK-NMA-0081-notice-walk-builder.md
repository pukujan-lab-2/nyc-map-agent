# TASK-NMA-0081 — Notice Walk Builder

<!-- continuity:task {"acceptance": ["every notice in the saved 2026-11-27 feed produces a walk on every line it names", "every station, line, bus and entrance a step names is in that step's map data, over every notice, stop and trip", "expectLayout covers the notice walk panel and the skipped-station card at the four sizes"], "depends_on": [], "goal": "Tell each MTA notice as a walk for the rider's own stop: the rider picks their stop and whether they are getting off or on, and only that case plays, one action a step, built from NoticeFacts and fixed sentence patterns, with map data for everything each step names.", "id": "NMA-0081", "issue_url": "https://github.com/pukujan-lab-2/nyc-map-agent/issues/208", "next_action": "let the pull request merge after pull request 284; rebase onto main once 284 lands", "owner": "agent:claude-code/49eafa85-0865-4394-a41e-dc905b4c6d7f", "priority": "P1", "protocol_version": "0.1.0-draft", "schema": "project-continuity.task.v1", "status": "active", "why": "Step 3 of the notice-walks plan: the old walks listed every case at once, ended with the MTA's reason, hid guidance behind Full notice, and the map's Skipped card listed names without telling the rider what to do."} -->

- Status: active
- Owner: agent:claude-code/49eafa85-0865-4394-a41e-dc905b4c6d7f
- Priority: P1
- Depends on: none

## Goal

Tell each MTA notice as a walk for the rider's own stop: the rider picks their stop and whether they are getting off or on, and only that case plays, one action a step, built from NoticeFacts and fixed sentence patterns, with map data for everything each step names.

## Why

Step 3 of the notice-walks plan: the old walks listed every case at once, ended with the MTA's reason, hid guidance behind Full notice, and the map's Skipped card listed names without telling the rider what to do.

## Allowed files

- `src/features/transit/noticeWalk.ts`, `walkPatterns.ts`, `walkMap.ts`, `noticeWalk.test.ts`
- `src/features/transit/alertDiagram.ts` and its test (steps taken out; the line diagram stays)
- `src/features/transit/NoticeDiagram.tsx` (the panel only: trip picker, steps, (i); the drawing is step 4's)
- `src/features/transit/TransitCard.tsx`, one line of `TransitLayer.tsx` (the skipped-station card), one type in `alertFocus.ts`
- `e2e/line-notices.spec.ts`, `e2e/responsive.spec.ts`, `e2e/mocks.ts`, `scripts/notice-walk-report.ts`
- `checkpoints/CURRENT.md`, this task file

## Human outcome

A rider going to 74 St-Broadway on the weekend 7 skip picks "Getting off at 74 Street-Broadway" and hears: stay on to Junction Blvd, change to a Manhattan-bound 7 there, ride it back to 74 St. Nothing about why, and nothing for the other cases.

## Scope and boundaries

- In scope: walks from NoticeFacts, the sentence table, per-step map data, the trip picker, (i), the skipped-station card.
- Out of scope: drawing the map layers (step 4), the time buttons (step 5), elevator walks (step 6), translated patterns and voice choice (step 7), the model fallback (step 8).
- Dependencies/uncertainty: built on pull request 284 (NoticeFacts), not merged yet. Notices the parser cannot place fall back to the MTA's own lines without the reason.

## Acceptance criteria

- [x] All 214 notices in the saved feed produce a walk on each of the 254 notice-and-line pairs (test).
- [x] Over 1,760 walks (no stop picked, and each of 1,506 stop-and-trip choices) and 9,359 steps, no station, line, bus or entrance a step names is missing from its map data (test).
- [x] `expectLayout` runs on the notice walk and the skipped-station card at 320×568, 375×667, 390×844 and 1280×800 (`e2e/responsive.spec.ts`).

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

### 2026-11-28 03:17:13 UTC — agent:claude-code/49eafa85-0865-4394-a41e-dc905b4c6d7f

<!-- continuity:checkpoint {"agent":"agent:claude-code/49eafa85-0865-4394-a41e-dc905b4c6d7f","blocked":["Built on pull request 284, which is not merged yet"],"changed":["src/features/transit/noticeWalk.ts, walkPatterns.ts, walkMap.ts, NoticeDiagram.tsx, alertDiagram.ts, TransitCard.tsx, e2e specs and mocks, .size-limit.json"],"completed":["Notice walks from NoticeFacts: trip picker, one action a step, no Why step, MTA words behind (i), map data on every step, and the skipped-station card opening the walk"],"decisions":["Facts are read on the phone from the notice text, so the live payload does not grow; a notice the server sends with facts uses those"],"evidence":["Every one of the 214 saved notices produces a walk; across 1,760 walks and 9,359 steps nothing a step names is missing from its map data; line-notices and responsive browser specs pass at all four sizes (135 passed); full unit suite passes (2,306 tests)"],"evidence_class":"observed","next_action":"Rebase onto main once pull request 284 merges","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0081","timestamp":"2026-11-28T03:17:13Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"cb7a440eb20e9b306cde6f5e71313c7afffb2a124ccc81658dd9616f183ce76b","request_id":"020019d1fc094cd6bdc566baa24ae290","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0081"} -->

Completed:
- Notice walks from NoticeFacts: trip picker, one action a step, no Why step, MTA words behind (i), map data on every step, and the skipped-station card opening the walk

Evidence:
- Every one of the 214 saved notices produces a walk; across 1,760 walks and 9,359 steps nothing a step names is missing from its map data; line-notices and responsive browser specs pass at all four sizes (135 passed); full unit suite passes (2,306 tests)

Decisions:
- Facts are read on the phone from the notice text, so the live payload does not grow; a notice the server sends with facts uses those

Changed:
- src/features/transit/noticeWalk.ts, walkPatterns.ts, walkMap.ts, NoticeDiagram.tsx, alertDiagram.ts, TransitCard.tsx, e2e specs and mocks, .size-limit.json

Blocked/uncertain:
- Built on pull request 284, which is not merged yet

Next:
- Rebase onto main once pull request 284 merges

### 2026-11-28 04:02:56 UTC — agent:claude-code/49eafa85-0865-4394-a41e-dc905b4c6d7f

<!-- continuity:checkpoint {"agent":"agent:claude-code/49eafa85-0865-4394-a41e-dc905b4c6d7f","blocked":["Built on pull request 284, which is not merged yet"],"changed":["src/features/transit/walkPatterns.ts, noticeWalk.ts, noticeWalk.test.ts, NoticeDiagram.tsx, walkMap.ts, alertFocus.ts, e2e/mocks.ts, e2e/line-notices.spec.ts"],"completed":["Each walk step has a spoken text (short forms in full, ordinals, a pause between a name's parts); entrances in the step map can carry their place; every shuttle and temporary bus in a walk lists its stops"],"decisions":["e2e/mocks.ts speech stub copied byte for byte from the time-buttons branch so the branches merge cleanly"],"evidence":["No spoken step on the saved feed has St., Av. or a double period, and the same facts give the same words; the map audit finds no shuttle without stops; transit unit tests pass (217) and the 21 notice browser tests pass at all four sizes"],"evidence_class":"observed","next_action":"Rebase onto main once pull request 284 merges","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0081","timestamp":"2026-11-28T04:02:56Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"eb31f00d6147c57a03f7007dc07b6e1f507e212df1a36b35ba54b610733d5b7a","request_id":"bc0086823b94421f8910099703a6528f","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0081"} -->

Completed:
- Each walk step has a spoken text (short forms in full, ordinals, a pause between a name's parts); entrances in the step map can carry their place; every shuttle and temporary bus in a walk lists its stops

Evidence:
- No spoken step on the saved feed has St., Av. or a double period, and the same facts give the same words; the map audit finds no shuttle without stops; transit unit tests pass (217) and the 21 notice browser tests pass at all four sizes

Decisions:
- e2e/mocks.ts speech stub copied byte for byte from the time-buttons branch so the branches merge cleanly

Changed:
- src/features/transit/walkPatterns.ts, noticeWalk.ts, noticeWalk.test.ts, NoticeDiagram.tsx, walkMap.ts, alertFocus.ts, e2e/mocks.ts, e2e/line-notices.spec.ts

Blocked/uncertain:
- Built on pull request 284, which is not merged yet

Next:
- Rebase onto main once pull request 284 merges

### 2026-11-28 04:22:37 UTC — agent:claude-code/49eafa85-0865-4394-a41e-dc905b4c6d7f

<!-- continuity:checkpoint {"agent":"agent:claude-code/49eafa85-0865-4394-a41e-dc905b4c6d7f","blocked":["Built on pull request 284, which is not merged yet"],"changed":["src/features/transit/noticeWalk.ts (facts cached per notice), noticeWalk.test.ts"],"completed":["The notice walk tests build every walk once, and a notice's facts are read once, so the tests no longer time out on CI"],"decisions":["no new decisions"],"evidence":["noticeWalk.test.ts runs 13 tests in 0.7 s locally (was over 20 s, and over 5 s per test on CI for PR 288); transit unit tests pass (217)"],"evidence_class":"observed","next_action":"Rebase onto main once pull request 284 merges","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0081","timestamp":"2026-11-28T04:22:37Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"77c2c51cfb7a72cb954d22757af6854ae1c1b7907f2d8daade20d7f5fc8c3168","request_id":"9f2eb1795c5f4158a3d4fcd286f249b1","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0081"} -->

Completed:
- The notice walk tests build every walk once, and a notice's facts are read once, so the tests no longer time out on CI

Evidence:
- noticeWalk.test.ts runs 13 tests in 0.7 s locally (was over 20 s, and over 5 s per test on CI for PR 288); transit unit tests pass (217)

Decisions:
- no new decisions

Changed:
- src/features/transit/noticeWalk.ts (facts cached per notice), noticeWalk.test.ts

Blocked/uncertain:
- Built on pull request 284, which is not merged yet

Next:
- Rebase onto main once pull request 284 merges

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
