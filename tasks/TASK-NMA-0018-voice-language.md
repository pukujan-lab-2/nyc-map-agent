# TASK-NMA-0018 — Voice Language

<!-- continuity:task {"acceptance":["hands-free asks which language in a spoken question and each language's own name","the app no longer cancels its own answer from its voice leaking into the mic","the choice holds for the rest of the conversation"],"depends_on":[],"goal":"Ask which language hands-free voice should use, and stop the app interrupting its own answers","id":"NMA-0018","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/42","next_action":"define scope and observable acceptance checks, then begin bounded work","owner":"claude-code","priority":"medium","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Hands-free cut answers off mid-sentence and one misheard word fixed the language for a whole conversation"} -->

- Status: active
- Owner: claude-code
- Priority: medium
- Depends on: none

## Goal

Ask which language hands-free voice should use, and stop the app interrupting its own answers

## Why

Hands-free cut answers off mid-sentence and one misheard word fixed the language for a whole conversation

## Allowed files

- `src/lib/voice/` (bargeIn, useSpeech), `src/features/agent/AgentOverlay.tsx`, their tests and `.size-limit.json`

## Human outcome

You tap hands-free, the app asks which language, you say it, and the conversation happens in that language without interruptions.

## Scope and boundaries

- In scope:
- Out of scope:
- Dependencies/uncertainty:

## Acceptance criteria

- [x] Voice question and language names (unit tests on the branch).
- [x] Rebased on the merged spoken answers; voice e2e specs pass locally.

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
