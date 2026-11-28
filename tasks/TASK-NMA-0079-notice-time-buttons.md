# TASK-NMA-0079 — Notice Time Buttons

<!-- continuity:task {"acceptance":["the line panel opens on the button for the New York time now","each button lists only the notices and outages in effect in its hours","unit tests cover the period maths, the window filter and the New York clock changes","the layout bar passes for the line panel at 320, 375, 390 and 1280 wide"],"depends_on":[],"goal":"Replace the line panel's Now and This weekend chips with four time buttons (Day, Night, Weekend day, Weekend night) that each list only the notices in effect then","id":"NMA-0079","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/208","next_action":"open the step 5 pull request and arm auto-merge","owner":"agent:claude-code/615f0a6f-de1a-43d6-8a53-65d4b47bc4b5","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"A rider looking at the 7 on Thursday night could not see what runs on Saturday daytime apart from Saturday night; step 5 of docs/PLAN-notice-walks.md"} -->

- Status: active
- Owner: agent:claude-code/615f0a6f-de1a-43d6-8a53-65d4b47bc4b5
- Priority: P1
- Depends on: none

## Goal

Replace the line panel's Now and This weekend chips with four time buttons (Day, Night, Weekend day, Weekend night) that each list only the notices in effect then

## Why

A rider looking at the 7 on Thursday night could not see what runs on Saturday daytime apart from Saturday night; step 5 of docs/PLAN-notice-walks.md

## Allowed files

- `src/features/transit/LinePanel.tsx`, `src/features/transit/linePanel.test.tsx`
- `src/lib/transit/periods.ts` and its test, `src/lib/transit/lineDay.ts`, `src/lib/transit/weekend.ts`
- `e2e/line-notices.spec.ts`, `e2e/responsive.spec.ts`

## Human outcome

On Thursday night a rider can tap Weekend day and see only what changes on Saturday and Sunday daytime, without the overnight-only skips.

## Scope and boundaries

- In scope: the four time buttons, their dates line, and filtering notices by their windows.
- Out of scope: listing next weekend too (an open decision for the owner), `NoticeDiagram.tsx` and `alertDiagram.ts` (step 3).
- Dependencies/uncertainty: needs the notice windows and planned outages from #279 (merged).

## Acceptance criteria

- [x] The panel opens on the button for the New York time now.
- [x] Each button lists only what is in effect in its hours.
- [x] Unit tests cover the period maths, the window filter and the clock changes.
- [x] The layout bar passes for the line panel at all four sizes.

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

### 2026-11-28 01:37:05 UTC — agent:claude-code/615f0a6f-de1a-43d6-8a53-65d4b47bc4b5

<!-- continuity:checkpoint {"agent":"agent:claude-code/615f0a6f-de1a-43d6-8a53-65d4b47bc4b5","blocked":[],"changed":["src/features/transit/LinePanel.tsx, src/lib/transit/periods.ts, src/lib/transit/weekend.ts"],"completed":["The line panel had only Now and This weekend, so Saturday daytime work and Saturday-night skips showed together; it now has Day, Night, Weekend day and Weekend night, each listing only the notices and outages in effect in its hours."],"decisions":["An answer about this weekend opens on Weekend day, the period that shares the most hours with it."],"evidence":["All 2324 unit tests pass, 18 of them new for the period maths, the window filter and the New York clock changes; the line panel's layout cases pass at 320, 375, 390 and 1280 wide."],"evidence_class":"observed","next_action":"Open the step 5 pull request with auto-merge; whether Weekend also lists next weekend waits for the owner.","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0079","timestamp":"2026-11-28T01:37:05Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"f24e58732c688a4a38984993d30800b6d9b0f73aa6d1514a803559cccd8a57d5","request_id":"7ac1604c326748929219a06a11721029","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0079"} -->

Completed:
- The line panel had only Now and This weekend, so Saturday daytime work and Saturday-night skips showed together; it now has Day, Night, Weekend day and Weekend night, each listing only the notices and outages in effect in its hours.

Evidence:
- All 2324 unit tests pass, 18 of them new for the period maths, the window filter and the New York clock changes; the line panel's layout cases pass at 320, 375, 390 and 1280 wide.

Decisions:
- An answer about this weekend opens on Weekend day, the period that shares the most hours with it.

Changed:
- src/features/transit/LinePanel.tsx, src/lib/transit/periods.ts, src/lib/transit/weekend.ts

Blocked/uncertain:
- none

Next:
- Open the step 5 pull request with auto-merge; whether Weekend also lists next weekend waits for the owner.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
