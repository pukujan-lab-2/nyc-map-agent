# TASK-NMA-0096 — LiveKit Pilot Plan

<!-- continuity:task {"acceptance":["docs/PLAN-livekit-hands-free.md says what exists, the pilot's shape, what decides keeping it, and the steps","issue 299 tracks the pilot"],"depends_on":[],"goal":"Plan a pilot of a live LiveKit voice call for hands-free mode, behind a flag, reusing the voice stack voice-agent-research and design-bakery already run.","id":"NMA-0096","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/299","next_action":"let the pull request merge; then measure today's hands-free turn (plan step 1)","owner":"agent:claude-code/a0ddded4-f8b2-47ac-8c96-8f125bb721f9","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Hands-free mode takes one turn at a time; the owner asked on 2026-11-28 for a LiveKit pilot plan."} -->

- Status: active
- Owner: agent:claude-code/a0ddded4-f8b2-47ac-8c96-8f125bb721f9
- Priority: P2
- Depends on: none

## Goal

Plan a pilot of a live LiveKit voice call for hands-free mode, behind a flag, reusing the voice stack voice-agent-research and design-bakery already run.

## Why

Hands-free mode takes one turn at a time. The owner asked on 2026-11-28 for a LiveKit pilot plan.

## Allowed files

- `docs/PLAN-livekit-hands-free.md`
- `checkpoints/CURRENT.md`, this task file

## Acceptance criteria

- [x] The plan says what exists, the pilot's shape, what decides keeping it, and the steps.
- [x] Issue 299 tracks the pilot.

### 2026-11-28 11:04:17 UTC — agent:claude-code/a0ddded4-f8b2-47ac-8c96-8f125bb721f9

<!-- continuity:checkpoint {"agent":"agent:claude-code/a0ddded4-f8b2-47ac-8c96-8f125bb721f9","blocked":[],"changed":["none"],"completed":["Wrote docs/PLAN-livekit-hands-free.md and filed issue 299"],"decisions":["Owner 2026-11-28: plan a LiveKit pilot for hands-free mode behind a flag; LangGraph not needed"],"evidence":["voice-agent-research decisions 0002 and 0013; design-bakery voice-agent README; draft pull request 243"],"evidence_class":"observed","next_action":"Merge the plan; then measure today's hands-free turn (plan step 1)","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0096","timestamp":"2026-11-28T11:04:17Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"0779d30447aa247c06ecbd5e2fb6c0f178330103b03b945fbdf2f1a4057f31af","request_id":"65d2e766da59474481f30e3ea690810f","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0096"} -->

Completed:
- Wrote docs/PLAN-livekit-hands-free.md and filed issue 299

Evidence:
- voice-agent-research decisions 0002 and 0013; design-bakery voice-agent README; draft pull request 243

Decisions:
- Owner 2026-11-28: plan a LiveKit pilot for hands-free mode behind a flag; LangGraph not needed

Changed:
- none

Blocked/uncertain:
- none

Next:
- Merge the plan; then measure today's hands-free turn (plan step 1)

### 2026-11-28 11:06:10 UTC — agent:claude-code/a0ddded4-f8b2-47ac-8c96-8f125bb721f9

<!-- continuity:checkpoint {"agent":"agent:claude-code/a0ddded4-f8b2-47ac-8c96-8f125bb721f9","blocked":[],"changed":["none"],"completed":["Owner chose: the hands-free voice worker lives in this repository (voice-agent/)"],"decisions":["Owner 2026-11-28: worker in this repository"],"evidence":["docs/PLAN-livekit-hands-free.md"],"evidence_class":"observed","next_action":"Merge the plan; then measure today's hands-free turn (plan step 1); owner still to pick the LiveKit server","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0096","timestamp":"2026-11-28T11:06:10Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"07254079f99051f2e1d188577fe060f89a375de1d5cc77f31a0439ac43f09c5c","request_id":"3ee27e1264874b91819612d07cadbc5c","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0096"} -->

Completed:
- Owner chose: the hands-free voice worker lives in this repository (voice-agent/)

Evidence:
- docs/PLAN-livekit-hands-free.md

Decisions:
- Owner 2026-11-28: worker in this repository

Changed:
- none

Blocked/uncertain:
- none

Next:
- Merge the plan; then measure today's hands-free turn (plan step 1); owner still to pick the LiveKit server
