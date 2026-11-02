# TASK-NMA-0017 — Spoken Answers

<!-- continuity:task {"acceptance":["answers show and speak station shorthand in full","Kokoro reads English, Spanish, French and Chinese answers through POST /api/tts","other languages and a down speech server fall back to the browser voice"],"depends_on":[],"goal":"Spell out station and street shorthand in answers and speech, and read answers with Kokoro instead of the browser voice","id":"NMA-0017","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/37","next_action":"define scope and observable acceptance checks, then begin bounded work","owner":"claude-code","priority":"medium","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Riders read and hear Sq, Hts, Av and a flat browser voice; the owner asked for full words and a better voice"} -->

- Status: active
- Owner: claude-code
- Priority: medium
- Depends on: none

## Goal

Spell out station and street shorthand in answers and speech, and read answers with Kokoro instead of the browser voice

## Why

Riders read and hear Sq, Hts, Av and a flat browser voice; the owner asked for full words and a better voice

## Allowed files

- `src/lib/streetName.ts`, `src/lib/voice/{kokoro,useSpeech}.ts`, `src/features/agent/{AgentHome,AgentOverlay}.tsx`
- `server/features/agent/{tts,prompt}.ts`, `server/app.ts`, `server/openapi.ts`, tests and `e2e/responsive.spec.ts`

## Human outcome

Answers read and sound like a person: full words on screen, a natural voice aloud.

## Scope and boundaries

- In scope: station and street names in answers and speech; Kokoro through the copilot speech server STT already uses.
- Out of scope: Russian, Bengali, Haitian Creole and Korean voices; the warning lines in Underground and wrong-way, which still use the browser voice.
- Dependencies/uncertainty: the Pro's speech server must be up behind the VPS tunnel; the first call took 6 s while the model loaded.

## Acceptance criteria

- [x] Full station words in the answer card (e2e at four sizes).
- [x] /api/tts streams the speech server's audio, with tests for 200, 400, 415, 502 and 503.
- [x] Browser voice takes every other language and any failure.

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
