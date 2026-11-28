# TASK-NMA-0101 — Live Call Pilot

<!-- continuity:task {"acceptance": ["voice-agent/ holds design-bakery's worker as nyc-map-voice, speaking through the gateway as X-Speech-Project nyc-map", "POST /api/voice/token serves the map and the presenter, answers 503 until configured and returns no secret", "the liveCall flag is off by default; with it on, hands-free opens a call whose heard lines go through /api/agent and whose replies the worker speaks", "Mute and End call sit in the sheet, and a failed or dropped call falls back to one question at a time with one line saying so", "livekit-client loads only when a call starts and has its own size-limit entry"], "depends_on": [], "goal": "With ?flags=+liveCall, hands-free opens a LiveKit call to this app's own voice worker, each heard line goes through /api/agent with the same tools and map actions, and a failed or dropped call falls back to one question at a time.", "id": "NMA-0101", "issue_url": "https://github.com/pukujan-lab-2/nyc-map-agent/issues/299", "next_action": "the owner sets the LiveKit key and secret and runs the worker (voice-agent/README.md); then step 3, the noise test", "owner": "agent:claude-code/b1d64ae3-e69f-43ae-866a-6494cb427df6", "priority": "P2", "protocol_version": "0.1.0-draft", "schema": "project-continuity.task.v1", "status": "active", "why": "Step 2 of the LiveKit pilot (issue 299): the owner wants a hands-free conversation instead of one recorded turn, measured against the 9.3 s baseline before anyone else gets it."} -->

- Status: active
- Owner: agent:claude-code/b1d64ae3-e69f-43ae-866a-6494cb427df6
- Priority: P2
- Depends on: none

## Goal

With ?flags=+liveCall, hands-free opens a LiveKit call to this app's own voice worker, each heard line goes through /api/agent with the same tools and map actions, and a failed or dropped call falls back to one question at a time.

## Why

Step 2 of the LiveKit pilot (issue 299): the owner wants a hands-free conversation instead of one recorded turn, measured against the 9.3 s baseline before anyone else gets it.

## Allowed files

- `voice-agent/` (the worker, copied from design-bakery)
- `server/features/agent/voiceToken.ts` and its test, `server/app.ts`, `server/openapi.ts`, `openapi.json`, `src/lib/api/schema.d.ts`
- `src/lib/voice/liveCall.ts` and its test, `src/features/agent/useLiveCall.ts`, `src/features/agent/LiveCallPanel.tsx` and its test
- `src/features/agent/AgentOverlay.tsx`, `src/features/agent/AgentHome.tsx` (small: the call replaces the orb, and the hands-free button opens it)
- `src/lib/flags/registry.ts`, `.size-limit.json`, `package.json`, `pnpm-lock.yaml`, `AI_RULES.md`, `docs/ARCHITECTURE.md`, `.env.example`, `deploy/.env.example`
- `e2e/live-call.spec.ts`, `checkpoints/CURRENT.md`, this task file

## Human outcome

The owner can hold a hands-free conversation with the map, with `?flags=+liveCall`, and compare it with the 9.3 s turn it replaces. Everyone else keeps today's hands-free.

## Acceptance criteria

- [x] `voice-agent/` is design-bakery's worker as `nyc-map-voice`, using the gateway's `nyc-map` route.
- [x] `POST /api/voice/token` serves the map and the presenter, answers 503 until configured and returns no secret (unit tests).
- [x] `liveCall` is off by default; with it on, hands-free opens a call and each heard line goes through `/api/agent` (unit tests with a fake room).
- [x] Mute and End call sit in the sheet; a failed or dropped call falls back to one question at a time with one line (`e2e/live-call.spec.ts`, `expectLayout` at four sizes).
- [x] `livekit-client` loads only when a call starts, with its own size-limit entry.
- [ ] A real call on the VPS, which needs the owner's keys and a running worker.

## Checkpoint log

No checkpoints yet.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
