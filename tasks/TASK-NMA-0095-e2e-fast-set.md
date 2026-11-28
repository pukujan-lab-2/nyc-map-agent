# TASK-NMA-0095 — E2E Fast Set

<!-- continuity:task {"acceptance":["a pull request that touches shared code runs e2e/core.txt plus the specs it edits, at the smallest phone and desktop","a change inside one listed feature folder runs that feature's specs and the smoke spec at two sizes","a docs-only change runs no browser specs","a pull request labelled full-e2e runs every spec at all four sizes","local runs still check all four sizes"],"depends_on":[],"goal":"Cut CI's browser tests from the full 296-test, 39-minute run to a fast set at two sizes, with the full set only on request.","id":"NMA-0095","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/31","next_action":"let the pull request merge and confirm a pull request's e2e job finishes in about 10 minutes","owner":"agent:claude-code/a0ddded4-f8b2-47ac-8c96-8f125bb721f9","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Every pull request waited about 40 minutes for browser tests, two were cancelled at the 45-minute limit on 2026-11-28, and the owner chose to run the full set locally before pushing instead of in CI."} -->

- Status: active
- Owner: agent:claude-code/a0ddded4-f8b2-47ac-8c96-8f125bb721f9
- Priority: P1
- Depends on: none

## Goal

Cut CI's browser tests from the full 296-test, 39-minute run to a fast set at two sizes, with the full set only on request.

## Why

Every pull request waited about 40 minutes for browser tests, and two were cancelled at the 45-minute limit on 2026-11-28. The owner chose to run the full set locally before pushing instead of in CI (owner, 2026-11-28).

## Allowed files

- `scripts/ci/e2e-select.sh`, `e2e/core.txt`, `e2e/layout.ts`
- `e2e/record.spec.ts`, `e2e/record-send.spec.ts`, `e2e/record-contribute.spec.ts` (one size by name instead of by position)
- `.github/workflows/ci.yml` (the picker step's comment only)
- `AGENTS.md` (one line in the layout bar section)
- `checkpoints/CURRENT.md`, this task file

## Human outcome

A pull request's browser tests finish in about 10 minutes instead of about 40, so finished work reaches the site sooner.

## Acceptance criteria

- [x] Shared-code change: smoke, the edited specs, responsive, task-screens and panel-slot, at two sizes (checked by running the picker on this branch).
- [x] Feature-folder change: that feature's specs and smoke, at two sizes (checked on a walkguide-only commit).
- [x] Docs-only change: none (checked).
- [x] Labelled full-e2e: all (checked with a sample event file).
- [x] Local runs still use all four sizes (E2E_SIZES unset).

### 2026-11-28 10:53:49 UTC — agent:claude-code/a0ddded4-f8b2-47ac-8c96-8f125bb721f9

<!-- continuity:checkpoint {"agent":"agent:claude-code/a0ddded4-f8b2-47ac-8c96-8f125bb721f9","blocked":[],"changed":["none"],"completed":["CI runs a fast set of browser specs at two sizes; full set only with the full-e2e label"],"decisions":["Owner 2026-11-28: no full browser-test run in CI, not nightly and not before deploy; specs are run locally before pushing"],"evidence":["Picker checked on four kinds of change; typecheck and lint pass"],"evidence_class":"observed","next_action":"Let the pull request merge and confirm a pull request's e2e job finishes in about 10 minutes","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0095","timestamp":"2026-11-28T10:53:49Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"9b70215c1ff7cc297891f255a1cddfc3fa111fe6ff1d78a69ebd9ad3380da9dc","request_id":"c905c98b564c42ebb610bffa1e4b6a23","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0095"} -->

Completed:
- CI runs a fast set of browser specs at two sizes; full set only with the full-e2e label

Evidence:
- Picker checked on four kinds of change; typecheck and lint pass

Decisions:
- Owner 2026-11-28: no full browser-test run in CI, not nightly and not before deploy; specs are run locally before pushing

Changed:
- none

Blocked/uncertain:
- none

Next:
- Let the pull request merge and confirm a pull request's e2e job finishes in about 10 minutes
