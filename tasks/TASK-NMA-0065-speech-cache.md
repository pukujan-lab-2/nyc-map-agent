# TASK-NMA-0065 — Speech Cache

<!-- continuity:task {"acceptance":["replace this with observable, task-specific acceptance checks"],"depends_on":[],"goal":"A notice's speech and translation are made once and kept, with pruning, on the server and on the phone","id":"NMA-0065","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/218","next_action":"define scope and observable acceptance checks, then begin bounded work","owner":"unassigned","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Owner, 2026-11-14: caching would be cheaper; what about pruning"} -->

- Status: active
- Owner: unassigned
- Priority: P1
- Depends on: none

## Goal

A notice's speech and translation are made once and kept, with pruning, on the server and on the phone

## Why

Owner, 2026-11-14: caching would be cheaper; what about pruning

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

### 2026-11-15 07:07:31 UTC — agent:claude-code/abf81021-c394-4e17-a76d-dd9aafb3f1e3

<!-- continuity:checkpoint {"agent":"agent:claude-code/abf81021-c394-4e17-a76d-dd9aafb3f1e3","blocked":[],"changed":["server/features/agent/speechCache.ts, tts.ts, translate.ts, server/app.ts, db/migrations/20261115060000_speech_cache.sql, deploy/docker-compose.vps.yml, public/sw.js, src/lib/voice/say.ts, kokoro.ts, src/features/transit/noticeLang.ts, NoticeDiagram.tsx"],"completed":["A notice's speech was made again on every open and its translation after every restart; the server now keeps a notice step's sound as a file and its translation in a table, pruned hourly, and the phone keeps both too"],"decisions":["no new decisions"],"evidence":["On the MacBook Pro all unit tests pass (2124), the type check, lint and size budgets pass, the notice and offline browser tests pass (31 cases), and the migration up and down with every cache statement ran clean on a throwaway Postgres 16"],"next_action":"Open the pull request for #218 once #213 has merged, then after it deploys time a first and a repeat request and read the first prune line in the server's log","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0065","timestamp":"2026-11-15T07:07:31Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"c869a1e61096618f65cfdc7df580b7c69c4b944161123e94f4393958c343d038","request_id":"5f0b7a2cf4884afdb3df78bf5ece8407","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0065"} -->

Completed:
- A notice's speech was made again on every open and its translation after every restart; the server now keeps a notice step's sound as a file and its translation in a table, pruned hourly, and the phone keeps both too

Evidence:
- On the MacBook Pro all unit tests pass (2124), the type check, lint and size budgets pass, the notice and offline browser tests pass (31 cases), and the migration up and down with every cache statement ran clean on a throwaway Postgres 16

Decisions:
- no new decisions

Changed:
- server/features/agent/speechCache.ts, tts.ts, translate.ts, server/app.ts, db/migrations/20261115060000_speech_cache.sql, deploy/docker-compose.vps.yml, public/sw.js, src/lib/voice/say.ts, kokoro.ts, src/features/transit/noticeLang.ts, NoticeDiagram.tsx

Blocked/uncertain:
- none

Next:
- Open the pull request for #218 once #213 has merged, then after it deploys time a first and a repeat request and read the first prune line in the server's log

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
