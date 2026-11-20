# TASK-NMA-0069 — Train Connection Stops

<!-- continuity:task {"acceptance":["replace this with observable, task-specific acceptance checks"],"depends_on":[],"goal":"No subway stop is drawn longer than 40 s, and a transfer station gets the longer stop only while a connecting train is arriving.","id":"NMA-0069","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/273","next_action":"define scope and observable acceptance checks, then begin bounded work","owner":"claude-code","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Trains were drawn stopping up to 60 s at transfer stations whether or not anything was there to wait for (#273)."} -->

- Status: active
- Owner: claude-code
- Priority: P2
- Depends on: none

## Goal

No subway stop is drawn longer than 40 s, and a transfer station gets the longer stop only while a connecting train is arriving.

## Why

Trains were drawn stopping up to 60 s at transfer stations whether or not anything was there to wait for (#273).

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

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
