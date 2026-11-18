# TASK-NMA-0064 — Union Square Camera Demo

<!-- continuity:task {"acceptance":["replace this with observable, task-specific acceptance checks"],"depends_on":[],"goal":"Show how a known Union Square sign can recover a rider\u2019s floor","id":"NMA-0064","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/232","next_action":"define scope and observable acceptance checks, then begin bounded work","owner":"agent:codex/01a1ec5e-b70c-7342-bade-77e99cb521db","priority":"high","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The recap needs a repeatable camera demo while sensor-based level detection is still being tested."} -->

- Status: active
- Owner: agent:codex/01a1ec5e-b70c-7342-bade-77e99cb521db
- Priority: high
- Depends on: none

## Goal

Show how a known Union Square sign can recover a rider’s floor

## Why

The recap needs a repeatable camera demo while sensor-based level detection is still being tested.

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

### 2026-11-18 03:40:57 UTC — agent:codex/01a1ec5e-b70c-7342-bade-77e99cb521db

<!-- continuity:checkpoint {"agent":"agent:codex/01a1ec5e-b70c-7342-bade-77e99cb521db","blocked":[],"changed":["none"],"completed":["Built and recorded the Union Square camera demo. Matching the saved Elevator to L photo with the live service moved the map pin to the mezzanine."],"decisions":["Keep the demo opt-in and label its simulated location and illustrative arrow in the app."],"evidence":["The browser checks passed at all four required sizes. The recorded scan returned the expected sign and showed the updated checkpoint and direction."],"next_action":"Rehearse the camera on a phone and play the saved recording if the venue connection is unreliable.","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0064","timestamp":"2026-11-18T03:40:57Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"9acc722b90abad588da655263f13a8bd5c7272b41d52caf1faeb4dcd29fb4a43","request_id":"a0bec5a0cdcd4d8e82bc8cfc4efc19ea","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0064"} -->

Completed:
- Built and recorded the Union Square camera demo. Matching the saved Elevator to L photo with the live service moved the map pin to the mezzanine.

Evidence:
- The browser checks passed at all four required sizes. The recorded scan returned the expected sign and showed the updated checkpoint and direction.

Decisions:
- Keep the demo opt-in and label its simulated location and illustrative arrow in the app.

Changed:
- none

Blocked/uncertain:
- none

Next:
- Rehearse the camera on a phone and play the saved recording if the venue connection is unreliable.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
