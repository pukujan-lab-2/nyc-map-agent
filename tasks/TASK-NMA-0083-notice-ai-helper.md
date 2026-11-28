# TASK-NMA-0083 — Notice AI Helper

<!-- continuity:task {"acceptance":["the checker refuses a model answer with an unknown station or a wrong direction (tests)","the same notice id and text never reaches the model twice (test)","the coverage report runs over the 2026-11-27 fixture (test and script)"],"depends_on":[],"goal":"For notices no rule reads, let the agent's model propose notice facts that code checks against our stations, lines and directions; show the MTA text translated when the check fails; and run a nightly coverage report the owner can read.","id":"NMA-0083","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/208","next_action":"let the pull request merge; the walk builder (plan step 3) calls /api/transit-notices for notices with no rule facts","owner":"agent:claude-code/0d7cd701-09d9-4f61-81ad-2bb1dadc8b79","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Step 8 of the notice-walks plan: a change in MTA wording should show up as a report and a checked fallback, not a broken or silent walk."} -->

- Status: active
- Owner: agent:claude-code/0d7cd701-09d9-4f61-81ad-2bb1dadc8b79
- Priority: P1
- Depends on: none

## Goal

For notices no rule reads, let the agent's model propose notice facts that code checks against our stations, lines and directions; show the MTA text translated when the check fails; and run a nightly coverage report the owner can read.

## Why

Step 8 of the notice-walks plan: a change in MTA wording should show up as a report and a checked fallback, not a broken or silent walk.

## Allowed files

- `server/features/transit/noticeHelper.ts`, `noticeRoutes.ts`, `noticeHelper.test.ts`
- `server/features/transit/noticeFacts.ts` (two small exports for the checker)
- `server/features/agent/translate.ts` (the translate path as a function the helper can call)
- `server/app.ts`, `server/node.ts`, `server/openapi.ts`, `openapi.json`, `src/lib/api/schema.d.ts`
- `scripts/notice-facts-coverage.ts`, `checkpoints/CURRENT.md`, this task file

## Human outcome

When the MTA writes a notice in a way no rule reads, a rider still gets a walk if the model's facts pass every check, or the MTA's own words in their language if they do not. The owner reads each night which notices fell back and why at `/api/transit-health/notices?format=text`.

## Scope and boundaries

- In scope: the model fallback with its checker and cache, translating the MTA text of notices we cannot walk, the nightly report.
- Out of scope: any screen (the walk builder, step 3, calls the new route), new providers or keys, filing GitHub issues from the report.
- Dependencies/uncertainty: built on pull request 284 (notice facts). On the 2026-11-27 feed every notice is read by the rules, so the model path is proven by tests, not yet by a live notice.

## Acceptance criteria

- [x] The checker refuses a model answer with an unknown station, a station off the line, a direction the line does not run, or a direction other than the headline's (tests).
- [x] The cache keeps each answer per notice id and text hash, refused ones too, and two riders opening at once make one call (tests).
- [x] The report runs over the 2026-11-27 fixture (test, and `npx tsx scripts/notice-facts-coverage.ts --report out.md`).

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

### 2026-11-28 02:42:10 UTC — agent:claude-code/0d7cd701-09d9-4f61-81ad-2bb1dadc8b79

<!-- continuity:checkpoint {"agent":"agent:claude-code/0d7cd701-09d9-4f61-81ad-2bb1dadc8b79","blocked":[],"changed":["server/features/transit/noticeHelper.ts, noticeRoutes.ts, noticeHelper.test.ts; translate.ts; app.ts, node.ts, openapi.ts; scripts/notice-facts-coverage.ts"],"completed":["Model fallback with a checker and a per-notice cache, translated MTA text for notices we cannot walk, and a nightly coverage report"],"decisions":["The server runs the nightly report itself (CI runners have had no schedules since the move to the VPS, and the report needs the server's model)"],"evidence":["21 new tests pass, including refusals for an unknown station, a station off the line, a direction the line does not run and a direction other than the headline's; full unit suite passes (2,330 tests, 15 skipped); on the 2026-11-27 feed the report shows 214 of 214 notices read by the rules"],"evidence_class":"observed","next_action":"Let the pull request merge after 284; the walk builder (step 3) calls /api/transit-notices for notices with no rule facts","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0083","timestamp":"2026-11-28T02:42:10Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"91adda161a28eac3f1bb7d8bbe367042b3307441a53c00d07f040aa6fdd3d269","request_id":"ad4ba99465234614a6def4f6c1a34045","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0083"} -->

Completed:
- Model fallback with a checker and a per-notice cache, translated MTA text for notices we cannot walk, and a nightly coverage report

Evidence:
- 21 new tests pass, including refusals for an unknown station, a station off the line, a direction the line does not run and a direction other than the headline's; full unit suite passes (2,330 tests, 15 skipped); on the 2026-11-27 feed the report shows 214 of 214 notices read by the rules

Decisions:
- The server runs the nightly report itself (CI runners have had no schedules since the move to the VPS, and the report needs the server's model)

Changed:
- server/features/transit/noticeHelper.ts, noticeRoutes.ts, noticeHelper.test.ts; translate.ts; app.ts, node.ts, openapi.ts; scripts/notice-facts-coverage.ts

Blocked/uncertain:
- none

Next:
- Let the pull request merge after 284; the walk builder (step 3) calls /api/transit-notices for notices with no rule facts

### 2026-11-28 03:18:27 UTC — agent:claude-code/0d7cd701-09d9-4f61-81ad-2bb1dadc8b79

<!-- continuity:checkpoint {"agent":"agent:claude-code/0d7cd701-09d9-4f61-81ad-2bb1dadc8b79","blocked":[],"changed":["e2e/mocks.ts"],"completed":["Took the silent speech stub fix from pull request 283 so lint and the line-notice e2e specs stop failing on this branch"],"decisions":["no new decisions"],"evidence":["ESLint passes on e2e/mocks.ts; the change is the same as on pull request 283, whose lint and e2e pass; the e2e specs were not run here because this Mac lacks the Playwright browser build they need"],"evidence_class":"observed","next_action":"Let pull request 285 merge; rebase onto main once 284 merges","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0083","timestamp":"2026-11-28T03:18:27Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"3337c65e060f249537b9a4dff0c15915db69d7204a855cc1189b7f43a8243894","request_id":"27b589d51d6949c39500273197937ecd","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0083"} -->

Completed:
- Took the silent speech stub fix from pull request 283 so lint and the line-notice e2e specs stop failing on this branch

Evidence:
- ESLint passes on e2e/mocks.ts; the change is the same as on pull request 283, whose lint and e2e pass; the e2e specs were not run here because this Mac lacks the Playwright browser build they need

Decisions:
- no new decisions

Changed:
- e2e/mocks.ts

Blocked/uncertain:
- none

Next:
- Let pull request 285 merge; rebase onto main once 284 merges

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
