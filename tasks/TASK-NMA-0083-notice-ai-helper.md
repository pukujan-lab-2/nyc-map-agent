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

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
