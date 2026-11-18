# The presenter's live call (draft)

*Follow-up to #239 and #241, written 2026-11-18. A draft port of design-bakery's LiveKit streaming conversation into `/present`, behind a flag and off by default. Nothing here changes the shipped turn-based presenter.*

## What was copied

- **Server token minting** — `server/features/presenter/voiceToken.ts`, from design-bakery's `backend/src/copilot/voiceToken.ts`: a short-lived JWT for one room, with the room configuration asking for the voice agent by name so LiveKit dispatches only that agent. `GET /api/presenter/voice-token` returns the grant, or 503 while unconfigured; `/api/presenter/status` gained a `liveVoice` boolean.
- **The call client** — `src/features/presenter/liveVoice.ts`, from design-bakery's `frontend/src/app/modules/copilot/voice.ts` (397 lines there, a self-contained subset here): dynamic `livekit-client` import, microphone track with echo cancellation and noise suppression, room connect and publish, the agent's `copilot.greet` / `copilot.turn` / `copilot.ignored` RPC methods, audio attachment, a 60-second agent timeout, and reconnect/disconnect handling. A heard question goes through the presenter's own `/api/presenter/ask` with the current scene, so answers keep their sources and the prepared fallback.
- **The controls** — `LiveCall.tsx` renders a "Live call" button in the presenter footer only with `?flags=+liveVoice` **and** a configured token endpoint; while a call is up, **Mute/Unmute** and **End call**. `livekit-client` stays out of the boot chunk (imported only when a call starts).

Not copied (design-bakery-specific): the copilot store and page moves, hold lines and nudges, thinking fillers, echo attribution (`withoutEcho`), addressee detection, sky origins, failure reporting to `/voice/failed`, and the one automatic redial.

## Env vars (VPS app env, all optional)

| Var | Meaning |
| --- | --- |
| `NYC_PRESENTER_LIVEKIT_KEY` / `NYC_PRESENTER_LIVEKIT_SECRET` | LiveKit server API key/secret (design-bakery's `VOICE_LIVEKIT_*` values). Both set = the endpoint is on. |
| `NYC_PRESENTER_LIVEKIT_AGENT_NAME` | The dispatched agent; defaults to `design-bakery-voice`, the agent running today. |
| `NYC_PRESENTER_LIVEKIT_PUBLIC_URL` | Defaults to `wss://copilot.design-bakery.com`. |

## What remains before this is demo-ready

1. **A Design Baker stack in the voice agent.** The dispatched agent is design-bakery's copilot: it speaks as AI Pujan with that site's scenarios. The voice-agent repo (separate repository, not touched here) needs a presenter stack/scenario so the agent knows the seven stops, the evidence scenes, and the project's verified facts, and answers as Design Baker. The client already sends the current scene with each question.
2. **Keys in the VPS env** and a container recreate; then check `/api/presenter/status` reports `liveVoice: true`.
3. **Navigation wiring.** A live answer's chapter should move the tour while the agent speaks (the turn-based path already does this via `deliver()`); the draft answers aloud without moving the page.
4. **Echo and addressee handling.** Without `withoutEcho`, the agent may hear its own voice through the speakers; design-bakery's hold/filler machinery is the reference if that shows up in rehearsal.
5. **Rehearsal plan.** On a phone and a desktop: start a call, greet, ask "How did Washington Metro do this?", **mute after asking** and confirm the answer finishes uninterrupted (the owner's demo flow), unmute, ask a follow-up, end the call, and confirm the tour resumes where it paused. Watch Phoenix for the ask spans; the call's audio path itself is not traced yet.
6. **Layout and tests.** The flag-on footer needs an `expectLayout` pass at the four sizes, and the token route needs contract tests (503 unconfigured, grant shape, no secret in the reply body beyond the one-room token).

## What stays unchanged

The default `/present` experience: turn-based dictation that auto-submits, prepared and live answers, interrupt and return. With the flag off or the env unset, the button never renders and the endpoint answers 503.