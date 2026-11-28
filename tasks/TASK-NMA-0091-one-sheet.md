# TASK-NMA-0091 — One Sheet

<!-- continuity:task {"acceptance":["at 390x844, 768x1024 and 1280x800 every card (station, line, follow, trip, lost helper, exits, More layers, line chooser, underground, answer) opens in the phone sheet or the left card, and two never show at once","walking guidance and following keep only a banner at the top; the rest is in the sheet","the top right is one map-style button over Center on my location; the compass shows only when the map is turned; + and - only from 640 px","expectLayout passes in e2e/responsive.spec.ts for the idle map, a station card, the line panel, following a train, walking guidance and More layers"],"depends_on":[],"goal":"Open every panel in one place: the one bottom sheet on phones and one left card with the chat bar at its foot from 640 px, with Apple Maps' stacked map-style and locate pair at the top right.","id":"NMA-0091","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/180","next_action":"open the pull request with auto-merge armed and let CI run the browser suite","owner":"agent:claude-code/ab72443d-36a4-416d-83f5-519c594e9127","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Panels opened in about six places on desktop and more on tablet; the owner chose Apple Maps' layout on 2026-11-27 (pull request 2 of 3, after the design rules in #292)."} -->

- Status: active
- Owner: agent:claude-code/ab72443d-36a4-416d-83f5-519c594e9127
- Priority: P1
- Depends on: none

## Goal

Open every panel in one place: the one bottom sheet on phones and one left card with the chat bar at its foot from 640 px, with Apple Maps' stacked map-style and locate pair at the top right.

## Why

Panels opened in about six places on desktop and more on tablet; the owner chose Apple Maps' layout on 2026-11-27 (pull request 2 of 3, after the design rules in #292).

## Allowed files

- `src/components/{PullSheet,MapPanel,LayersDrawer,MapViewSwitch,MapChrome}.tsx`, `src/components/task-screens.css`, `src/lib/store/{pullSheet,leftColumn}.ts`
- the layout parts of `src/features/agent/{AgentHome,AgentOverlay,TripPreview}.tsx`, `src/features/agent/lost/LostHelper.tsx`, `src/features/liveview/RouteGuide.tsx`, `src/features/underground/{ExitTask,Underground}.tsx`
- where the panel mounts in `src/features/transit/{LinePanel,FollowSheet,LineChooser,TransitCard}.tsx`
- `index.html` (first-paint chat bar), `docs/PDD.md` (Screen space), the e2e specs that drive these screens, this task file and `checkpoints/CURRENT.md`

## Human outcome

Whatever you open, a station, a line, a train, More layers, it shows in the same place: the bottom sheet on a phone, the left card on a laptop or tablet, with Back to the one before it.

## Scope and boundaries

- In scope: placement of every map panel, the navigation banners, the top-right buttons, zoom.
- Out of scope: the menu row, My day, the person button and `/city-data` (map cleanup), restrooms, the server.
- Dependencies/uncertainty: the map-cleanup pull request also edits `MapChrome.tsx` and `AgentHome.tsx`; whichever lands second rebases.

## Acceptance criteria

- [x] Every card opens in the phone sheet or the left card, one at a time, with Back.
- [x] Walking and following keep a top banner; the rest is in the sheet.
- [x] The top right is Apple's stacked pair; compass only when turned; zoom only from 640 px.
- [x] `expectLayout` cases for the idle map, a station, the line panel, following, walking and More layers.

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
