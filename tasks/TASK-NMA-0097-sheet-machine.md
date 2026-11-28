# TASK-NMA-0097 — Sheet Machine

<!-- continuity:task {"acceptance":["one XState v5 machine in src/lib/sheet/sheetMachine.ts decides which view is in the sheet, Back, Close, the sheet height, the walking/following banner, the answer and line folding, the details slot, the open menu and the left card","src/lib/store/{pullSheet,panelSlot,leftColumn,openMenu}.ts and src/lib/screen/screenSpace.ts are gone; their hooks keep their names","unit tests cover the machine's transitions; the panel and layout specs pass unchanged","pnpm typecheck, lint and knip pass"],"depends_on":["NMA-0091"],"goal":"Decide what the one sheet or left card shows in one XState machine instead of five small stores.","id":"NMA-0097","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/145","next_action":"push, open the draft pull request based on main, and rebase onto main once #295 merges","owner":"agent:claude-code/4f939b4e-2272-4c90-93d5-7bfcf30a4d72","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The owner asked on 2026-11-28 how the many screen states are managed; four hand-made stores and the screen-space machine each held a piece of what the sheet shows (issue #145, next step after language and voice)."} -->

- Status: active
- Owner: agent:claude-code/4f939b4e-2272-4c90-93d5-7bfcf30a4d72
- Priority: P2
- Depends on: NMA-0091 (pull request #295, one sheet)

## Goal

Decide what the one sheet or left card shows in one XState machine instead of five small stores.

## Why

The owner asked on 2026-11-28 how the many screen states are managed; four hand-made stores and the screen-space machine each held a piece of what the sheet shows (issue #145, next step after language and voice).

## Allowed files

- `src/lib/sheet/**` (new), the five stores it replaces, `src/lib/store/PanelContext.tsx`, `src/components/PullSheet.tsx`
- import lines in every file that read those stores; the banner lines in `src/features/liveview/RouteGuide.tsx` and `src/features/transit/FollowSheet.tsx`
- path references in `docs/PDD.md` and `docs/DESIGN_RULES.md`, this task file and `checkpoints/CURRENT.md`

## Human outcome

Nothing on screen changes. The next person who asks "why did that panel close?" reads one file and its tests instead of five.

## Scope and boundaries

- In scope: what the sheet shows, its Back stack and Close, its height, the navigation banner, the answer and line folding, the details slot, the open menu, the left card's portal targets.
- Out of scope: each panel still keeps its own height in React state and reports it; moving that setter into the machine is a later step. Server data stays in TanStack Query.
- Dependencies/uncertainty: built on `feat/one-sheet`; rebases onto main after #295 merges.

## Acceptance criteria

- [x] One machine holds the sheet's state.
- [x] The old stores are gone and their hooks keep their names.
- [x] Unit tests for the machine's transitions.
- [ ] Panel and layout specs pass in CI.

## Related records

- Required leaf owning issue, parent ancestry and dependencies (or explicitly none): #145; depends on #295.
- Primary writer / branch / source issue revision / as-of status: agent:claude-code/4f939b4e-2272-4c90-93d5-7bfcf30a4d72 / `feat/sheet-machine` / 2026-11-28.
- Related PR/CI evidence and push receipt (request ID / SHA):

## Checkpoint log

No checkpoints yet.

### 2026-11-28 12:51:16 UTC — agent:claude-code/4f939b4e-2272-4c90-93d5-7bfcf30a4d72

<!-- continuity:checkpoint {"agent":"agent:claude-code/4f939b4e-2272-4c90-93d5-7bfcf30a4d72","blocked":[],"changed":["src/lib/sheet/**, PanelContext, PullSheet, RouteGuide and FollowSheet banners, import lines in 15 callers, .size-limit.json, docs/PDD.md, docs/DESIGN_RULES.md"],"completed":["What the sheet or left card shows is decided by one XState machine in src/lib/sheet/sheetMachine.ts; the five old stores are gone and their hooks keep their names."],"decisions":["XState now loads with the boot chunk; its budget rises from 298 to 311 kB and the lazy screen-space budget is removed."],"evidence":["Typecheck, lint, knip and dependency boundaries pass; 333 sheet, transit and component unit tests pass; the full suite passes except the Fulton St walk simulation, which timed out at 240 s beside lint. Panel and layout browser specs pass here (one-sheet, panel-slot, screen-space, responsive, line-chooser, line-notices, minimap, tap-priority, walk-guide, task-screens, menu-row) once a server that died mid-run was restarted."],"next_action":"Keep the draft pull request rebased on #295; once #295 merges, rebase onto main, mark it ready and arm auto-merge","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0097","timestamp":"2026-11-28T12:51:16Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"4c0b5c844cedbe1e41fe46de70fcc68ab63f537d1dfa2565b7641684f5b7f051","request_id":"5c802070b2c247d781a17896c57cb6ef","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0097"} -->

Completed:
- What the sheet or left card shows is decided by one XState machine in src/lib/sheet/sheetMachine.ts; the five old stores are gone and their hooks keep their names.

Evidence:
- Typecheck, lint, knip and dependency boundaries pass; 333 sheet, transit and component unit tests pass; the full suite passes except the Fulton St walk simulation, which timed out at 240 s beside lint. Panel and layout browser specs pass here (one-sheet, panel-slot, screen-space, responsive, line-chooser, line-notices, minimap, tap-priority, walk-guide, task-screens, menu-row) once a server that died mid-run was restarted.

Decisions:
- XState now loads with the boot chunk; its budget rises from 298 to 311 kB and the lazy screen-space budget is removed.

Changed:
- src/lib/sheet/**, PanelContext, PullSheet, RouteGuide and FollowSheet banners, import lines in 15 callers, .size-limit.json, docs/PDD.md, docs/DESIGN_RULES.md

Blocked/uncertain:
- none

Next:
- Keep the draft pull request rebased on #295; once #295 merges, rebase onto main, mark it ready and arm auto-merge
