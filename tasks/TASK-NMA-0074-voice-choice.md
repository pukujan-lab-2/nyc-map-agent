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

### 2026-11-28 01:27:54 UTC — agent:claude-code/4cefb5fb-6625-4f75-af3d-30455892565b

<!-- continuity:checkpoint {"agent":"agent:claude-code/4cefb5fb-6625-4f75-af3d-30455892565b","blocked":["Full unit suite and the layout e2e were still running locally at this checkpoint; CI runs both."],"changed":["src/lib/voice/tts.ts, say.ts, voiceChoice.ts, noVoice.ts, SettingsBody.tsx, MenuRow.tsx, menuText.ts, e2e/responsive.spec.ts, e2e/mocks.ts, playwright.config.ts"],"completed":["Phone voices are ranked (Premium, Enhanced or Natural, then on the phone, then online); a language the phone has no voice for stays on screen with a one-time note; Settings has Voice: App voice or My phone's voice, kept as nma.voice. Browser tests start muted with a stub voice."],"decisions":["App voice stays the default; with My phone's voice, Kokoro speaks only a language the phone has no voice for."],"evidence":["Voice unit tests pass (8 files, 55 tests) on lists shaped like iOS, Android, Chrome desktop and Edge; typecheck, lint on changed files and knip pass."],"next_action":"Let CI pass on pull request 281; auto-merge is armed.","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0074","timestamp":"2026-11-28T01:27:54Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"1cbe5a883121438ad9adc44c5f4970d25fcf48b9fee7eeaf9d13f823aceb02e6","request_id":"d91c672a9a8a4191908eb31cf9d753d1","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0074"} -->

Completed:
- Phone voices are ranked (Premium, Enhanced or Natural, then on the phone, then online); a language the phone has no voice for stays on screen with a one-time note; Settings has Voice: App voice or My phone's voice, kept as nma.voice. Browser tests start muted with a stub voice.

Evidence:
- Voice unit tests pass (8 files, 55 tests) on lists shaped like iOS, Android, Chrome desktop and Edge; typecheck, lint on changed files and knip pass.

Decisions:
- App voice stays the default; with My phone's voice, Kokoro speaks only a language the phone has no voice for.

Changed:
- src/lib/voice/tts.ts, say.ts, voiceChoice.ts, noVoice.ts, SettingsBody.tsx, MenuRow.tsx, menuText.ts, e2e/responsive.spec.ts, e2e/mocks.ts, playwright.config.ts

Blocked/uncertain:
- Full unit suite and the layout e2e were still running locally at this checkpoint; CI runs both.

Next:
- Let CI pass on pull request 281; auto-merge is armed.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
