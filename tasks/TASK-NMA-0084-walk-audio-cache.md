# TASK-NMA-0084 — Walk Audio Cache

<!-- continuity:task {"acceptance":["a changed notice makes new clips and orphans the old ones","a sentence two notices share is stored once","cleanup deletes only clips no notice uses that went 7 days unplayed","a clip that is not ready falls back to live speech, then the phone's voice","every test is silent and checks audio as bytes"],"depends_on":[],"goal":"Make each notice walk's spoken steps ahead on the server when the notice arrives, serve them as clips the phone plays and keeps offline, and delete clips no notice uses after 7 days unplayed.","id":"NMA-0084","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/218","next_action":"let the pull request merge; then create the clip folder on the server and watch the clips line in /api/agent/health","owner":"agent:claude-code/0aaf55d0-e94c-4910-89cf-425a0d4c251f","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Every tap on a notice waited for live speech (about a second, five on a cold start) and the same sentence was made again for every rider; the owner asked on 2026-11-27 for the audio to be made once, saved, served and cleaned up."} -->

- Status: active
- Owner: agent:claude-code/0aaf55d0-e94c-4910-89cf-425a0d4c251f
- Priority: P1
- Depends on: none

## Goal

Make each notice walk's spoken steps ahead on the server when the notice arrives, serve them as clips the phone plays and keeps offline, and delete clips no notice uses after 7 days unplayed.

## Why

Every tap on a notice waited for live speech (about a second, five on a cold start) and the same sentence was made again for every rider; the owner asked on 2026-11-27 for the audio to be made once, saved, served and cleaned up.

## Allowed files

- `server/features/agent/clipStore.ts`, `noticeClips.ts` and their test; `tts.ts` and its test; `routes.ts` (health)
- `server/app.ts`, `server/openapi.ts`, `openapi.json`, `db/migrations/20261127120000_speech_clips.sql`
- `src/lib/voice/clipKey.ts`, `clips.ts`, `kokoro.ts`, `say.ts`, `kokoro.test.ts`; `src/features/transit/NoticeDiagram.tsx`
- `public/sw.js`, `src/features/underground/underground.test.ts`
- `deploy/docker-compose.vps.yml`, `deploy/README.md`, `checkpoints/CURRENT.md`, this task file

## Human outcome

A rider who taps a notice hears its first step in about a third of a second instead of one to five, and a walk they heard once plays again underground with no signal.

## Scope and boundaries

- In scope: making English walk steps ahead, the clip store and its cleanup, the clip and voice routes, playback with fallbacks, offline clips, the store's size in the health output.
- Out of scope: Spanish, French and Chinese clips (they need plan step 7's sentence tables), translations (#218's other half), speech routing (lives in `voice-agent-research`).
- Dependencies/uncertainty: branched from the walk builder (plan step 3, `feat/notice-walk-builder`), whose pull request was not open yet when this started.

## Acceptance criteria

- [x] A changed notice makes new clips and orphans the old ones (`noticeClips.test.ts`).
- [x] A sentence two notices share is stored once (`noticeClips.test.ts`).
- [x] Cleanup deletes only orphaned clips unplayed for 7 days (`noticeClips.test.ts`).
- [x] A clip that is not ready falls back to live speech, then the phone's voice (`kokoro.test.ts`).
- [x] Every test is silent: the speech server is a function returning bytes, and checks read the bytes back.

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

### 2026-11-28 03:57:27 UTC — agent:claude-code/0aaf55d0-e94c-4910-89cf-425a0d4c251f

<!-- continuity:checkpoint {"agent":"agent:claude-code/0aaf55d0-e94c-4910-89cf-425a0d4c251f","blocked":[],"changed":["none"],"completed":["Notice walks' spoken steps are made on the server when a notice arrives, kept as clips, served with immutable cache headers, kept offline by the worker, and deleted 7 days after no notice uses them; pull request 288 is open with auto-merge armed."],"decisions":["Files in SPEECH_CACHE_DIR with one row each in core.speech_clips; English only until plan step 7 ships sentence tables."],"evidence":["Silent unit tests pass (noticeClips, tts, voice, offline worker); a local run on the live feed made 946 English sentences for 292 notices (209 MB); live speech on the deployed site took 0.9 to 1.6 s to its first byte against about 0.3 s for a file from the same server."],"next_action":"let pull request 288 merge after 287; then check clips in /api/agent/health on the server","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0084","timestamp":"2026-11-28T03:57:27Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"21c9a944f345d39666d7b5729bb3448cea015e5b39cba796581bf354bd79bd82","request_id":"067f652eed434a94816059008fe01aa6","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0084"} -->

Completed:
- Notice walks' spoken steps are made on the server when a notice arrives, kept as clips, served with immutable cache headers, kept offline by the worker, and deleted 7 days after no notice uses them; pull request 288 is open with auto-merge armed.

Evidence:
- Silent unit tests pass (noticeClips, tts, voice, offline worker); a local run on the live feed made 946 English sentences for 292 notices (209 MB); live speech on the deployed site took 0.9 to 1.6 s to its first byte against about 0.3 s for a file from the same server.

Decisions:
- Files in SPEECH_CACHE_DIR with one row each in core.speech_clips; English only until plan step 7 ships sentence tables.

Changed:
- none

Blocked/uncertain:
- none

Next:
- let pull request 288 merge after 287; then check clips in /api/agent/health on the server

### 2026-11-28 04:32:01 UTC — agent:claude-code/0aaf55d0-e94c-4910-89cf-425a0d4c251f

<!-- continuity:checkpoint {"agent":"agent:claude-code/0aaf55d0-e94c-4910-89cf-425a0d4c251f","blocked":["The walk builder's own test that timed out on CI lives in pull request 287; the walk-builder session has the fix."],"changed":["none"],"completed":["Pull request 288's three failing checks are addressed: the clip tests build the saved walks once, the title is a Conventional Commit, and the notice panel's budget rises by the measured 429 B after trimming."],"decisions":["no new decisions"],"evidence":["Clip and voice tests pass (53); the notice panel chunk measures 24,427 B brotli against 23,998 B on pull request 287 alone."],"next_action":"let pull request 288 merge after 287; then check clips in /api/agent/health on the server","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0084","timestamp":"2026-11-28T04:32:01Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"9a85f40ce3969f9d9d92e13327479d03751cdacfffa22ea91717548dc812c75c","request_id":"e93b52baf52044fb87b2ad913656fdf9","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0084"} -->

Completed:
- Pull request 288's three failing checks are addressed: the clip tests build the saved walks once, the title is a Conventional Commit, and the notice panel's budget rises by the measured 429 B after trimming.

Evidence:
- Clip and voice tests pass (53); the notice panel chunk measures 24,427 B brotli against 23,998 B on pull request 287 alone.

Decisions:
- no new decisions

Changed:
- none

Blocked/uncertain:
- The walk builder's own test that timed out on CI lives in pull request 287; the walk-builder session has the fix.

Next:
- let pull request 288 merge after 287; then check clips in /api/agent/health on the server

### 2026-11-28 04:36:59 UTC — agent:claude-code/0aaf55d0-e94c-4910-89cf-425a0d4c251f

<!-- continuity:checkpoint {"agent":"agent:claude-code/0aaf55d0-e94c-4910-89cf-425a0d4c251f","blocked":[],"changed":["none"],"completed":["Pull request 288 is rebased onto the walk builder's build-once test fix and fits its size budgets: the whole app is back under 1,305 kB, and the notice panel's budget is 24.7 kB, 480 B for this change on top of the walk builder's 24,216 B."],"decisions":["no new decisions"],"evidence":["109 clip, voice, walk and offline-worker tests pass; size-limit measured on this branch and on the walk builder's branch alone."],"next_action":"let pull request 288 merge after 287; then check clips in /api/agent/health on the server","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0084","timestamp":"2026-11-28T04:36:59Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"ec745b4c84ef8a0e74e66ff8fadc44d383448215c4f62beb6aefecfc6f789651","request_id":"a9e33dfc1e8a4713a47664e89261fe5d","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0084"} -->

Completed:
- Pull request 288 is rebased onto the walk builder's build-once test fix and fits its size budgets: the whole app is back under 1,305 kB, and the notice panel's budget is 24.7 kB, 480 B for this change on top of the walk builder's 24,216 B.

Evidence:
- 109 clip, voice, walk and offline-worker tests pass; size-limit measured on this branch and on the walk builder's branch alone.

Decisions:
- no new decisions

Changed:
- none

Blocked/uncertain:
- none

Next:
- let pull request 288 merge after 287; then check clips in /api/agent/health on the server

### 2026-11-28 07:25:52 UTC — agent:claude-code/0aaf55d0-e94c-4910-89cf-425a0d4c251f

<!-- continuity:checkpoint {"agent":"agent:claude-code/0aaf55d0-e94c-4910-89cf-425a0d4c251f","blocked":[],"changed":["none"],"completed":["Pull request 288 is rebased onto main after 284, 281 and 282 merged: the clip reaches Kokoro through the rider's Voice setting, and the size budgets are set from measurements on main."],"decisions":["no new decisions"],"evidence":["Typecheck, openapi, full lint and size pass; 2,359 unit tests pass, plus the 59 voice tests after the say() fix; the 4 other failures are timeouts in the 3D station sims, which this branch leaves as on main."],"next_action":"let pull request 288 merge after 287; then check clips in /api/agent/health on the server","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0084","timestamp":"2026-11-28T07:25:52Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"60d929ce952cf5a5970a134125f7407a5a80554331b7150199c29875683c4075","request_id":"2d29ed9f0ec14b10aa6ee311ae101a17","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0084"} -->

Completed:
- Pull request 288 is rebased onto main after 284, 281 and 282 merged: the clip reaches Kokoro through the rider's Voice setting, and the size budgets are set from measurements on main.

Evidence:
- Typecheck, openapi, full lint and size pass; 2,359 unit tests pass, plus the 59 voice tests after the say() fix; the 4 other failures are timeouts in the 3D station sims, which this branch leaves as on main.

Decisions:
- no new decisions

Changed:
- none

Blocked/uncertain:
- none

Next:
- let pull request 288 merge after 287; then check clips in /api/agent/health on the server

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
