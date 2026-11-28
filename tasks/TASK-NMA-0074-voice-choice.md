# TASK-NMA-0074 — Voice Choice

<!-- continuity:task {"acceptance":["pickVoice prefers Premium, Enhanced or Natural voices, then voices on the phone, in tests shaped like iOS, Android, Chrome desktop and Edge","a language the phone has no voice for is not read aloud; the line stays on screen and a one-line note says so once","Settings has Voice: App voice or My phone's voice, kept on the phone, and say() follows it"],"depends_on":[],"goal":"Speak each line in the best voice the phone has for the rider's language, let the rider pick the app's voice or the phone's, and never read a language in an English voice.","id":"NMA-0074","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/208","next_action":"define scope and observable acceptance checks, then begin bounded work","owner":"agent:claude-code/4cefb5fb-6625-4f75-af3d-30455892565b","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Phones list a robotic compact voice first, and Haitian Creole was read by an English voice on phones that have no Creole voice (notice-walks plan, step 7)."} -->

- Status: active
- Owner: agent:claude-code/4cefb5fb-6625-4f75-af3d-30455892565b
- Priority: P2
- Depends on: none

## Goal

Speak each line in the best voice the phone has for the rider's language, let the rider pick the app's voice or the phone's, and never read a language in an English voice.

## Why

Phones list a robotic compact voice first, and Haitian Creole was read by an English voice on phones that have no Creole voice (notice-walks plan, step 7).

## Allowed files

- `src/lib/voice/**`, `src/components/MenuRow.tsx`, `src/components/SettingsBody.tsx`, `src/lib/i18n/menuText.ts`, `e2e/responsive.spec.ts`, this task file, `checkpoints/`.

## Human outcome

Describe what becomes easier, safer, clearer, or possible when this task is complete.

## Scope and boundaries

- In scope:
- Out of scope:
- Dependencies/uncertainty:

## Acceptance criteria

- [x] pickVoice prefers Premium, Enhanced or Natural voices, then voices on the phone, in tests shaped like iOS, Android, Chrome desktop and Edge (`src/lib/voice/tts.test.ts`).
- [x] A language the phone has no voice for is not read aloud; the line stays on screen and a one-line note says so once (`tts.test.ts`, `say.test.ts`, `noVoice.test.ts`).
- [x] Settings has Voice: App voice or My phone's voice, kept on the phone, and `say()` follows it (`say.test.ts`, `voiceChoice.test.ts`, `e2e/responsive.spec.ts`).

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
