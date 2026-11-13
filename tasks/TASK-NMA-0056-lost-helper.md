# TASK-NMA-0056 — Lost Helper

<!-- continuity:task {"acceptance":["Find exit, a train card's Find exit and a walk's Where am I open one helper","its first message is the guess in the app's language","poor network or position shows one signal line","offline questions get a local answer and go when back online","layout bar passes at 320x568, 375x667, 390x844 and 1280x800"],"depends_on":[],"goal":"One where-am-I helper for riders lost in a station, in place of Find exit, Exit help and I'm lost","id":"NMA-0056","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/131","next_action":"after the pull request deploys, open Find exit on the live site after a trip to Fulton St and read the guess","owner":"unassigned","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The three buttons confuse people and ignore what the app last knew"} -->

- Status: active
- Owner: unassigned
- Priority: P1
- Depends on: none

## Goal

One where-am-I helper for riders lost in a station, in place of Find exit, Exit help and I'm lost

## Why

The three buttons confuse people and ignore what the app last knew

## Allowed files

- `src/features/underground/` (LostHelper, lostGuess, lostText), `src/lib/underground/lostHelper.ts`
- the three buttons: `src/features/agent/AgentOverlay.tsx`, `src/features/transit/TransitCard.tsx`, `src/features/liveview/RouteGuide.tsx`
- `src/features/agent/schema.ts`, `server/features/agent/prompt.ts`, `src/lib/geo/sharedLocation.ts`, `src/features/agent/stationWalks.ts`
- `e2e/responsive.spec.ts`, `e2e/task-screens.spec.ts`

## Human outcome

A rider lost in a station with no signal sees, in their language, where the app thinks they are (station, train, part of the train, exit) and can text about it.

## Scope and boundaries

- In scope: the helper, its guess and signal line, the text chat through the chat bar, and the three buttons.
- Out of scope: the sign camera (#88), voice-first conversation.
- Dependencies/uncertainty: `navigator.connection` exists only in Chromium; on an iPhone the signal line rests on the position fix.

## Acceptance criteria

- [x] One helper behind Find exit, a train card's Find exit and a walk's Where am I.
- [x] Its first message is the guess in the app's language.
- [x] Poor network or position shows one signal line.
- [x] Offline questions get a local answer and go once back online.
- [x] Layout bar passes at all four sizes (e2e/responsive.spec.ts).
- [ ] Checked on the live site.

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
