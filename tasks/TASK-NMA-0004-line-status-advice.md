# TASK-NMA-0004 — Line Status Advice

<!-- continuity:task {"acceptance":["line_status names the lines that still stop at a skipped station under a key that cannot be read as a place to switch","the prompt keeps a delay's own direction and place, never sends anyone to change trains at a skipped stop, says whether trouble touches a named station, and does not end a status answer with Want to start?","prompt.test.ts and trouble.test.ts pass"],"depends_on":[],"goal":"The chat tells riders what is wrong on a line and where, and never sends them to change trains at a skipped stop.","id":"NMA-0004","issue_url":"https://github.com/Pukujan-lab/nyc-map-agent/issues/627","next_action":"open the pull request, then ask the live chat the A train question a few times after it deploys","owner":"claude-code","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"On 2026-11-01 the live chat named skipped A train stops as places to switch trains, from correct tool data."} -->

- Status: active
- Owner: claude-code
- Priority: P2
- Depends on: none

## Goal

The chat tells riders what is wrong on a line and where, and never sends them to change trains at a skipped stop.

## Why

On 2026-11-01 the live chat named skipped A train stops as places to switch trains, from correct tool data.

## Allowed files

- `server/features/agent/prompt.ts`, `prompt.test.ts`, `tools.ts`, `trouble.test.ts`, `checkpoints/`, this file.

## Human outcome

A rider who asks about a line hears what is wrong and where, and is only sent to stations that work for them.

## Scope and boundaries

- In scope: the line status tool's result shape and the prompt rules for restating it.
- Out of scope: the chat model, and what the MTA feed says.
- Dependencies/uncertainty: one question was tried on one model, so the check after deploy is several asks.

## Acceptance criteria

- [ ] The tool's key reads as "other lines that still stop at skipped stations".
- [ ] The four prompt rules are in `prompt.ts` and checked by `prompt.test.ts`.
- [ ] The same question on the live site no longer names a skipped stop as a switch point.

## Evidence and sources

Run against the live MTA feed on 2026-11-01, `line_status` for `["A"]` returned correct text: downtown delays throughout Manhattan, Inwood-bound skips at High St to Spring St, Queens-bound skips with switch points at Nostrand Av and Utica Av. The chat's restatement was wrong, so the fault is the model's reading. `npx vitest run server/features/agent` passes (297 tests), `tsc --noEmit` and `eslint` are clean.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Required leaf owning issue, parent ancestry and dependencies (or explicitly none): #627, no parent, no dependencies.
- Primary writer / branch / source issue revision / as-of status:
- Related PR/CI evidence and push receipt (request ID / SHA):

## Checkpoint log

No checkpoints yet.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
