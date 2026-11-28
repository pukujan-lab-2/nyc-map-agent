# TASK-NMA-0079 — Notice Facts

<!-- continuity:task {"acceptance":["at least 95% of the notices in the saved 2026-11-27 feed turn into facts with every station matched","every station a change names is on that change's line","advice in both MTA wordings is kept per direction and per stop"],"depends_on":[],"goal":"Turn each MTA service notice into facts a walk can be built from: line and direction, skipped or closed stops, advice per direction and per stop, buses and their corners, platform changes and the other kinds, with every station matched to our station ids.","id":"NMA-0079","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/208","next_action":"let the pull request merge; the walk builder (plan step 3) reads NoticeFacts next","owner":"agent:claude-code/13815112-3aa5-4f28-a77b-edf50852ab6b","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Step 2 of the notice-walks plan: the walk builder, map layers and AI fallback (steps 3, 4 and 8) need facts instead of MTA prose, and the walks lost per-station advice the MTA writes in a second wording."} -->

- Status: active
- Owner: agent:claude-code/13815112-3aa5-4f28-a77b-edf50852ab6b
- Priority: P1
- Depends on: none

## Goal

Turn each MTA service notice into facts a walk can be built from: line and direction, skipped or closed stops, advice per direction and per stop, buses and their corners, platform changes and the other kinds, with every station matched to our station ids.

## Why

Step 2 of the notice-walks plan: the walk builder, map layers and AI fallback (steps 3, 4 and 8) need facts instead of MTA prose, and the walks lost per-station advice the MTA writes in a second wording.

## Allowed files

- `server/features/transit/noticeFacts.ts` and `noticeFacts.test.ts`
- `server/features/transit/__fixtures__/subway-alerts-2026-11-27.json`
- `scripts/notice-facts-coverage.ts`
- `checkpoints/CURRENT.md`, this task file

## Human outcome

A walk can say "for Sutphin Blvd, take the F to Kew Gardens-Union Tpke and change to a Jamaica-bound F" because the advice is now a fact with station ids, not a sentence only the old wording parser understood.

## Scope and boundaries

- In scope: a pure parser from `SlimAlert` to `NoticeFacts`, a station alias list, a coverage script, tests from real notices.
- Out of scope: any screen, the walk builder, map layers, voice, elevator outages (plan steps 3 to 8).
- Dependencies/uncertainty: station names are matched to `public/transit/subway.json`; a name that matches several stations on none of the notice's lines stays unresolved.

## Acceptance criteria

- [x] 214 of 214 notices in the saved feed become facts (the plan's bar was 165 of 173).
- [x] Every station a change names is on that change's line (test).
- [x] Advice in both wordings is kept per direction and per stop (tests on the F at Sutphin Blvd and the N/Q in Manhattan).

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
