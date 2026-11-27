# TASK-NMA-0067 — Notice Windows

<!-- continuity:task {"acceptance":["a notice with several windows carries them all for three weeks ahead","the time-window request returns outages in that window, planned ones included","tests pin the 7 train's weekend pause from the real feed"],"depends_on":[],"goal":"Keep every MTA notice window and the upcoming elevator outages, step 1 of docs/PLAN-notice-walks.md.","id":"NMA-0067","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/208","next_action":"define scope and observable acceptance checks, then begin bounded work","owner":"agent:claude-code/bf69a9d6-00a8-40c8-a53f-fa55af80f5e6","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Notice walks and the time buttons need to know when each change applies; the server kept one window and dropped planned outages."} -->

- Status: active
- Owner: agent:claude-code/bf69a9d6-00a8-40c8-a53f-fa55af80f5e6
- Priority: P1
- Depends on: none

## Goal

Keep every MTA notice window and the upcoming elevator outages, step 1 of docs/PLAN-notice-walks.md.

## Why

Notice walks and the time buttons need to know when each change applies; the server kept one window and dropped planned outages.

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

### 2026-11-27 07:09:57 UTC — agent:claude-code/bf69a9d6-00a8-40c8-a53f-fa55af80f5e6

<!-- continuity:checkpoint {"agent":"agent:claude-code/bf69a9d6-00a8-40c8-a53f-fa55af80f5e6","blocked":[],"changed":["none"],"completed":["The server kept one window per MTA notice and dropped planned elevator outages; notices now carry every window for three weeks and the time-window request returns outages in it, planned ones included."],"decisions":["no new decisions"],"evidence":["2289 unit tests pass; on the live feeds this weekend's request returns 30 outages (8 planned) where it returned none, and 19 notices carry their windows."],"evidence_class":"observed","next_action":"Open the step 1 pull request; then step 2 of docs/PLAN-notice-walks.md, notice facts.","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0067","timestamp":"2026-11-27T07:09:57Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"3e71a2d03df5eeac3d7c4925016351a95ffcb9ccae159a051b1e2dff45fbc98b","request_id":"32c28a3a2ebf467f9cd61fd095ccb403","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0067"} -->

Completed:
- The server kept one window per MTA notice and dropped planned elevator outages; notices now carry every window for three weeks and the time-window request returns outages in it, planned ones included.

Evidence:
- 2289 unit tests pass; on the live feeds this weekend's request returns 30 outages (8 planned) where it returned none, and 19 notices carry their windows.

Decisions:
- no new decisions

Changed:
- none

Blocked/uncertain:
- none

Next:
- Open the step 1 pull request; then step 2 of docs/PLAN-notice-walks.md, notice facts.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
