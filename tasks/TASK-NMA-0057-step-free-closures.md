# TASK-NMA-0057 — Step Free Closures

<!-- continuity:task {"acceptance":["A trip avoids an entrance a live MTA station notice closes or makes exit only, and says why","With Elevators only on, trips use elevator entrances and name a station with no working elevator","Checked on the live site with one real closure and one elevators-only trip"],"depends_on":[],"goal":"Trips route around closed entrances and dead elevators; Elevators only setting","id":"NMA-0057","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/133","next_action":"define scope and observable acceptance checks, then begin bounded work","owner":"unassigned","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Owner, 2026-11-12: some station paths close for maintenance, and riders who can only use elevators must be served"} -->

- Status: active
- Owner: unassigned
- Priority: P1
- Depends on: none

## Goal

Trips route around closed entrances and dead elevators; Elevators only setting

## Why

Owner, 2026-11-12: some station paths close for maintenance, and riders who can only use elevators must be served

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

### 2026-11-13 02:16:07 UTC — agent:claude-code/3271bd9a-a577-4c73-9c75-a7aa823b92d3

<!-- continuity:checkpoint {"agent":"agent:claude-code/3271bd9a-a577-4c73-9c75-a7aa823b92d3","blocked":[],"changed":["server/features/agent/access.ts, src/lib/transit/stationAccess.ts, trip.ts, otp.ts, plan.ts, Settings switch, flythrough elevator ride"],"completed":["Trips read MTA station notices and per-elevator outages when choosing an entrance; Settings has an Elevators only switch; PR #136 open with auto-merge"],"decisions":["no new decisions"],"evidence":["Unit tests for the notice parser on the two live notices of 2026-11-12, entrance matching, step-free at a station, portal choice and step-free ranking passed locally; full suites run in CI"],"next_action":"Once #136 deploys, check on the live site a trip into 5 Av/53 St from the Madison Av side and an elevators-only trip to Fulton St, then post the receipt on #133","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0057","timestamp":"2026-11-13T02:16:07Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"27564b3c5c374991843e03551a7d805ebe35d7fce9fc7af8c718f70df02f2416","request_id":"c990928e751b4906aabbb6925d896532","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0057"} -->

Completed:
- Trips read MTA station notices and per-elevator outages when choosing an entrance; Settings has an Elevators only switch; PR #136 open with auto-merge

Evidence:
- Unit tests for the notice parser on the two live notices of 2026-11-12, entrance matching, step-free at a station, portal choice and step-free ranking passed locally; full suites run in CI

Decisions:
- no new decisions

Changed:
- server/features/agent/access.ts, src/lib/transit/stationAccess.ts, trip.ts, otp.ts, plan.ts, Settings switch, flythrough elevator ride

Blocked/uncertain:
- none

Next:
- Once #136 deploys, check on the live site a trip into 5 Av/53 St from the Madison Av side and an elevators-only trip to Fulton St, then post the receipt on #133

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
