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

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
