# TASK-NMA-0068 — Split Lint

<!-- continuity:task {"acceptance":["each CI lint part peaks well under 3 GiB", "the parts cover exactly the files the full lint covers", "lint passes on main without a memory kill"],"depends_on":[],"goal":"Keep CI lint under the VPS runners' 3 GiB cap by linting in three parts.","id":"NMA-0068","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/33","next_action":"define scope and observable acceptance checks, then begin bounded work","owner":"agent:claude-code/bf69a9d6-00a8-40c8-a53f-fa55af80f5e6","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Lint was killed for memory three times on 2026-11-27 and one main deploy was skipped."} -->

- Status: active
- Owner: agent:claude-code/bf69a9d6-00a8-40c8-a53f-fa55af80f5e6
- Priority: P1
- Depends on: none

## Goal

Keep CI lint under the VPS runners' 3 GiB cap by linting in three parts.

## Why

Lint was killed for memory three times on 2026-11-27 and one main deploy was skipped.

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
