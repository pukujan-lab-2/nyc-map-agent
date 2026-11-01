# TASK-NMA-0006 — Remove Groq

<!-- continuity:task {"acceptance":["no Groq name, URL or key remains in shipped code, tests, env templates or docs","/api/stt answers 503 unless STT_BASE_URL is set","stt.test.ts passes"],"depends_on":[],"goal":"Voice recordings go only to a speech server the owner names, never to Groq by default.","id":"NMA-0006","issue_url":"https://github.com/Pukujan-lab/nyc-map-agent/issues/634","next_action":"merge the pull request; the owner runs a Whisper server and sets STT_BASE_URL; add the audio path to docs/PRIVACY.md","owner":"claude-code","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The speech-to-text endpoint defaulted to Groq, which the owner did not choose (#634)."} -->

- Status: active
- Owner: claude-code
- Priority: P2
- Depends on: none

## Goal

Voice recordings go only to a speech server the owner names, never to Groq by default.

## Why

The speech-to-text endpoint defaulted to Groq, which the owner did not choose (#634).

## Allowed files

- `server/features/agent/stt.ts`, `stt.test.ts`, `.env.example`, `deploy/.env.example`, `docs/PLAN-copilot-port.md`, `checkpoints/`, this file.

## Human outcome

Voice recordings only go to a server the owner chose.

## Scope and boundaries

- In scope: the Groq default and wording.
- Out of scope: running a replacement Whisper server, the front end, docs/PRIVACY.md.
- Dependencies/uncertainty: none.

## Acceptance criteria

- [ ] A search for groq in shipped files finds nothing.
- [ ] /api/stt answers 503 without STT_BASE_URL.

## Evidence and sources

Added by #401 (2026-10-24). `npx vitest run server/features/agent/stt.test.ts src/lib/voice` passes (29 tests); `tsc` and `eslint` are clean; the grep for groq is empty.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Required leaf owning issue, parent ancestry and dependencies (or explicitly none): #634, no parent, no dependencies.
- Primary writer / branch / source issue revision / as-of status:
- Related PR/CI evidence and push receipt (request ID / SHA):

## Checkpoint log

No checkpoints yet.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
