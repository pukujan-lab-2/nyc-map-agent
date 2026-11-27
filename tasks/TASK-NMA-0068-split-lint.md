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

### 2026-11-27 20:07:26 UTC — agent:claude-code/bf69a9d6-00a8-40c8-a53f-fa55af80f5e6

<!-- continuity:checkpoint {"agent":"agent:claude-code/bf69a9d6-00a8-40c8-a53f-fa55af80f5e6","blocked":[],"changed":["none"],"completed":["CI lint runs in three parts, each near 1.8 GB, covering the same 973 files as the full lint."],"decisions":["no new decisions"],"evidence":["Measured on a Mac: full lint 3.07 GB; features 1.79, rest of app 1.81, everything outside src 1.83; file lists compared, none missing or doubled."],"evidence_class":"observed","next_action":"Open the pull request for issue 33 and confirm lint passes on main after it merges.","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0068","timestamp":"2026-11-27T20:07:26Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"12c81316573cffef501df10b04907a918d7a6709794bf1204bc58e548f8f9084","request_id":"45bb56124f4547faa1986323c7f22f46","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0068"} -->

Completed:
- CI lint runs in three parts, each near 1.8 GB, covering the same 973 files as the full lint.

Evidence:
- Measured on a Mac: full lint 3.07 GB; features 1.79, rest of app 1.81, everything outside src 1.83; file lists compared, none missing or doubled.

Decisions:
- no new decisions

Changed:
- none

Blocked/uncertain:
- none

Next:
- Open the pull request for issue 33 and confirm lint passes on main after it merges.

### 2026-11-27 20:08:16 UTC — agent:claude-code/bf69a9d6-00a8-40c8-a53f-fa55af80f5e6

<!-- continuity:checkpoint {"agent":"agent:claude-code/bf69a9d6-00a8-40c8-a53f-fa55af80f5e6","blocked":[],"changed":["none"],"completed":["The lint split is in pull request 280 with auto-merge and Auto-fix on; CURRENT.md lists it in flight."],"decisions":["no new decisions"],"evidence":["Pull request 280 opened; its description passes continuity pr-check."],"evidence_class":"observed","next_action":"Let pull request 280 merge, then confirm lint passes on main without a memory kill.","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0068","timestamp":"2026-11-27T20:08:16Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"8ce5bb776f035d93153ec43bffe6ae270cb52a6bacf083acf46dc005eaf16779","request_id":"7671bbf4a81c496dac0f03e8614bac02","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0068"} -->

Completed:
- The lint split is in pull request 280 with auto-merge and Auto-fix on; CURRENT.md lists it in flight.

Evidence:
- Pull request 280 opened; its description passes continuity pr-check.

Decisions:
- no new decisions

Changed:
- none

Blocked/uncertain:
- none

Next:
- Let pull request 280 merge, then confirm lint passes on main without a memory kill.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
