# TASK-NMA-0067 — Train Trouble Ahead

<!-- continuity:task {"acceptance":["replace this with observable, task-specific acceptance checks"],"depends_on":[],"goal":"During a hold or station trouble, the subway trains about to reach it wait where their vehicle report puts them.","id":"NMA-0067","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/266","next_action":"define scope and observable acceptance checks, then begin bounded work","owner":"claude-code","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The map treated only the held train and its line as in trouble, so the trains behind it were drawn running on (#266)."} -->

- Status: active
- Owner: claude-code
- Priority: P2
- Depends on: none

## Goal

During a hold or station trouble, the subway trains about to reach it wait where their vehicle report puts them.

## Why

The map treated only the held train and its line as in trouble, so the trains behind it were drawn running on (#266).

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

### 2026-11-20 18:33:07 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":["none"],"changed":["src/features/transit/troubledTrains.ts and its test, TransitLayer.tsx, checkpoints/CURRENT.md, this task record"],"completed":["Widened the map's idea of a subway train in trouble to the trains about to reach a held train or a station an unplanned notice names"],"decisions":["trouble reaches back three stops, a judgement and not a measurement; a released train's catch-up speed is left as it was"],"evidence":["nothing this change touches fails (all 2,284 unit tests pass; type check, lint and the dependency rules are clean); six new tests cover the rule; it has not been watched on the map during a real hold"],"evidence_class":"observed","next_action":"open the pull request that closes #266","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0067","timestamp":"2026-11-20T18:33:07Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"cda0785342f4e45b89997310322d680f894d6d966fae01b50b77f2a39da07f9a","request_id":"1ac23c97b197447fac31e366c163faf0","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0067"} -->

Completed:
- Widened the map's idea of a subway train in trouble to the trains about to reach a held train or a station an unplanned notice names

Evidence:
- nothing this change touches fails (all 2,284 unit tests pass; type check, lint and the dependency rules are clean); six new tests cover the rule; it has not been watched on the map during a real hold

Decisions:
- trouble reaches back three stops, a judgement and not a measurement; a released train's catch-up speed is left as it was

Changed:
- src/features/transit/troubledTrains.ts and its test, TransitLayer.tsx, checkpoints/CURRENT.md, this task record

Blocked/uncertain:
- none

Next:
- open the pull request that closes #266

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
