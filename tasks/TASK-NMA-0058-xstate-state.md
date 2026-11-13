# TASK-NMA-0058 — Xstate State

<!-- continuity:task {"acceptance":["replace this with observable, task-specific acceptance checks"],"depends_on":[],"goal":"Move the app's client state to XState, one concern per pull request, starting with language and voice","id":"NMA-0058","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/145","next_action":"define scope and observable acceptance checks, then begin bounded work","owner":"unassigned","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"On 2026-11-12 the language lived in three places and the mic, voice and buttons disagreed"} -->

- Status: active
- Owner: unassigned
- Priority: P1
- Depends on: none

## Goal

Move the app's client state to XState, one concern per pull request, starting with language and voice

## Why

On 2026-11-12 the language lived in three places and the mic, voice and buttons disagreed

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

### 2026-11-13 04:38:52 UTC — agent:claude-code/619d489e-002c-4303-95a6-7536b98ca798

<!-- continuity:checkpoint {"agent":"agent:claude-code/619d489e-002c-4303-95a6-7536b98ca798","blocked":[],"changed":["none"],"completed":["The language now has one owner: an XState machine that the buttons, the mic, the voice, Kokoro and the agent request read (#148)"],"decisions":["no new decisions"],"evidence":["Type check and lint clean on the Pro; all unit tests pass (1864), the e2e specs run separately in CI"],"next_action":"After #148 deploys, ask in Chinese then speak Chinese on nyc.design-bakery.com and check it is heard as Chinese; then start stage 2 (the ask cycle out of AgentOverlay.tsx)","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0058","timestamp":"2026-11-13T04:38:52Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"63aeed0309b2ede6e2192c3822131fd4fa9d36e88677fdcb4a8159c89afa6316","request_id":"a0b4e85ba3c74ab9ab9323057ff108d1","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0058"} -->

Completed:
- The language now has one owner: an XState machine that the buttons, the mic, the voice, Kokoro and the agent request read (#148)

Evidence:
- Type check and lint clean on the Pro; all unit tests pass (1864), the e2e specs run separately in CI

Decisions:
- no new decisions

Changed:
- none

Blocked/uncertain:
- none

Next:
- After #148 deploys, ask in Chinese then speak Chinese on nyc.design-bakery.com and check it is heard as Chinese; then start stage 2 (the ask cycle out of AgentOverlay.tsx)

### 2026-11-13 04:41:24 UTC — agent:claude-code/619d489e-002c-4303-95a6-7536b98ca798

<!-- continuity:checkpoint {"agent":"agent:claude-code/619d489e-002c-4303-95a6-7536b98ca798","blocked":[],"changed":["none"],"completed":["Merged fix/126-voice-follows-language into the language machine branch; #146's rules and tests kept"],"decisions":["no new decisions"],"evidence":["Type check and lint clean on the Pro; all 1263 tests under src pass, #146's appLang, kokoro and tts tests among them"],"next_action":"After #146 merges, merge main into this branch, re-arm auto-merge on #148, then check the live site in Chinese and English","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0058","timestamp":"2026-11-13T04:41:24Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"30f7c44bf6866ee16527acf3ffcd5e7e87062635921e975e7c44cd70fe67bd3e","request_id":"8aabe85001e84082ad062d04f4781937","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0058"} -->

Completed:
- Merged fix/126-voice-follows-language into the language machine branch; #146's rules and tests kept

Evidence:
- Type check and lint clean on the Pro; all 1263 tests under src pass, #146's appLang, kokoro and tts tests among them

Decisions:
- no new decisions

Changed:
- none

Blocked/uncertain:
- none

Next:
- After #146 merges, merge main into this branch, re-arm auto-merge on #148, then check the live site in Chinese and English

### 2026-11-13 07:47:01 UTC — agent:claude-code/619d489e-002c-4303-95a6-7536b98ca798

<!-- continuity:checkpoint {"agent":"agent:claude-code/619d489e-002c-4303-95a6-7536b98ca798","blocked":[],"changed":["none"],"completed":["Merged main (offline Fulton St walk, #137) into the language machine branch; the trip's spoken steps keep their offline flag and read the machine's tag"],"decisions":["no new decisions"],"evidence":["Type check and lint clean on the Pro; all 1266 tests under src pass"],"next_action":"Once #148 merges and deploys, ask in Chinese then in English on nyc.design-bakery.com and check the mic and voice follow each question","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0058","timestamp":"2026-11-13T07:47:01Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"28e822c2fe6e174e9583e857423db9bef430bf3ba44a38709372e93aef2d9156","request_id":"2df2817ce3f645c396a609dffdb1ec68","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0058"} -->

Completed:
- Merged main (offline Fulton St walk, #137) into the language machine branch; the trip's spoken steps keep their offline flag and read the machine's tag

Evidence:
- Type check and lint clean on the Pro; all 1266 tests under src pass

Decisions:
- no new decisions

Changed:
- none

Blocked/uncertain:
- none

Next:
- Once #148 merges and deploys, ask in Chinese then in English on nyc.design-bakery.com and check the mic and voice follow each question

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
