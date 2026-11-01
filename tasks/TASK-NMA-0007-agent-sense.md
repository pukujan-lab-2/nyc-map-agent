# TASK-NMA-0007 — Agent Sense

<!-- continuity:task {"acceptance":["replace this with observable, task-specific acceptance checks"],"depends_on":[],"goal":"A new request is answered on its own, fast, with nothing internal spoken, and traces show what each tool was asked.","id":"NMA-0007","issue_url":"https://github.com/Pukujan-lab/nyc-map-agent/issues/641","next_action":"define scope and observable acceptance checks, then begin bounded work","owner":"claude-code","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Traces of 2026-11-01 showed the agent repeating a restroom answer for a new destination, inventing a route, speaking tool names and trip ids, and taking 15 to 19 seconds."} -->

- Status: active
- Owner: claude-code
- Priority: P1
- Depends on: none

## Goal

A new request is answered on its own, fast, with nothing internal spoken, and traces show what each tool was asked.

## Why

Traces of 2026-11-01 showed the agent repeating a restroom answer for a new destination, inventing a route, speaking tool names and trip ids, and taking 15 to 19 seconds.

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

### 2026-11-01 17:35:00 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["server/features/agent/turn.ts, routes.ts, tools.ts, prompt.ts, hours.ts, runLog.ts, server/lib/tracing.ts"],"completed":["Per-turn tool rules, a reply filter, two-call trips and richer trace spans are in pull request 645."],"decisions":["no new decisions"],"evidence":["1579 tests pass; live LFM3 eval 10 of 11."],"next_action":"After pull request 645 merges and deploys, read the next day of NYC traces for turn.kind and tool arguments and post before and after dialogues on issue 641.","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0007","timestamp":"2026-11-01T17:35:00Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"cc7b1491f365ee2447eb38657d0353dc1a5b8d32647037288b5e95988e7839e8","request_id":"0c65415b48eb4402a643b6e0a6a7e8ac","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0007"} -->

Completed:
- Per-turn tool rules, a reply filter, two-call trips and richer trace spans are in pull request 645.

Evidence:
- 1579 tests pass; live LFM3 eval 10 of 11.

Decisions:
- no new decisions

Changed:
- server/features/agent/turn.ts, routes.ts, tools.ts, prompt.ts, hours.ts, runLog.ts, server/lib/tracing.ts

Blocked/uncertain:
- none

Next:
- After pull request 645 merges and deploys, read the next day of NYC traces for turn.kind and tool arguments and post before and after dialogues on issue 641.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
