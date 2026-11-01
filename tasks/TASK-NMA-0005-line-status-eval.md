# TASK-NMA-0005 — Line Status Eval

<!-- continuity:task {"acceptance":["tsx scripts/eval-line-status.ts prints train and held-out clean rates per check over replayed cases","checks.test.ts passes offline, including the wrong A train reply from #627","docs/eval/line-status holds the loop and a handoff DeepSeek can run alone","no real rider questions are collected"],"depends_on":[],"goal":"Line status answers are scored on many replayed cases so each change to the chat is kept or dropped on numbers.","id":"NMA-0005","issue_url":"https://github.com/Pukujan-lab/nyc-map-agent/issues/629","next_action":"merge this pull request, then DeepSeek runs the loop in docs/eval/line-status/PROGRAM.md; the owner updates PRIVACY.md before any real questions are collected","owner":"claude-code","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"One wrong A train answer was fixed by hand and nothing measures how often the chat misreads line status (#629)."} -->

- Status: active
- Owner: claude-code
- Priority: P2
- Depends on: none

## Goal

Line status answers are scored on many replayed cases so each change to the chat is kept or dropped on numbers.

## Why

One wrong A train answer was fixed by hand and nothing measures how often the chat misreads line status (#629).

## Allowed files

- `scripts/eval/line-status/`, `scripts/eval-line-status*.ts`, `scripts/record-alert-snapshot.ts`, `docs/eval/line-status/`, `.gitignore`, `checkpoints/`, this file.

## Human outcome

Every change to how the chat retells MTA trouble is judged on numbers from many replays, and a cheaper model can run that loop for hours.

## Scope and boundaries

- In scope: line status questions; the harness, recorder, generator and docs.
- Out of scope: trip questions (next suite), training LFM3, collecting real rider questions.
- Dependencies/uncertainty: LFM3 on the MacBook Pro must be awake; DeepSeek's key is not set up yet.

## Acceptance criteria

- [ ] The runner reports clean rates for train and held-out cases.
- [ ] Offline tests pass.
- [ ] The handoff and loop are in docs/eval/line-status.

## Evidence and sources

A 12-trial smoke run on LFM3 (prompt as merged in #628) came back 3 of 12 clean: 9 replies ended with an unwanted "Want to start?", and several invented a C shuttle bus. `npx vitest run scripts/eval` passes (10 tests), `tsc`, `eslint` and `depcruise` are clean. The full baseline is in docs/eval/line-status/LEDGER.md.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Required leaf owning issue, parent ancestry and dependencies (or explicitly none): #629; related #627, #628; no parent.
- Primary writer / branch / source issue revision / as-of status:
- Related PR/CI evidence and push receipt (request ID / SHA):

## Checkpoint log

No checkpoints yet.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
