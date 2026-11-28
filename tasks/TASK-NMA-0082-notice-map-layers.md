# TASK-NMA-0082 — Notice Map Layers

<!-- continuity:task {"acceptance":["the layout bar passes at all four sizes with a notice open","a test checks that every station, bus, entrance and walk named in a step's map data is drawn","each signpost sits beside its own track"],"depends_on":["NMA-0079"],"goal":"Draw the open notice step on the map the way the approved preview does: two tracks with direction arrows and the skipping side crossed out, signposts beside their own track, the train and which way it goes, change markers, closed stretches, bus routes and stops, temporary shuttle stops at the MTA's corners, walking lines, the elevator that is out and the one to use, and labels that name the line when two stations share a name.","id":"NMA-0082","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/208","next_action":"let the pull request merge; once the walk builder (NMA-0081) puts a StepMap on each step, the layers draw it instead of the one made from today's walk focus","owner":"agent:claude-code/f59eafb3-fdfd-40b2-bfef-be4f646ba311","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Step 4 of the notice-walks plan: a rider hears what to do and where, and the map has to show every place a step names, on the right side of the right track."} -->

- Status: active
- Owner: agent:claude-code/f59eafb3-fdfd-40b2-bfef-be4f646ba311
- Priority: P1
- Depends on: NMA-0079 (notice facts, pull request 284)

## Goal

Draw the open notice step on the map the way the approved preview (`docs/design/notice-walks-preview.html`) does: two tracks with direction arrows and the skipping side crossed out, signposts beside their own track, the train and which way it goes, change markers, closed stretches, bus routes and stops, temporary shuttle stops at the MTA's corners, walking lines, the elevator that is out and the one to use, and labels that name the line when two stations share a name.

## Why

Step 4 of `docs/PLAN-notice-walks.md`. A rider hears what to do and where; the map has to show every place a step names, on the right side of the right track. The preview once had the signposts swapped.

## Allowed files

- `src/features/transit/noticeMap.ts`, `noticeMap.test.ts`, `NoticeMapLayers.tsx`, `walkMap.ts` (a copy of the walk builder's type, kept identical)
- `src/features/transit/TransitLayer.tsx` (mount the layers, frame the camera), `alertFocus.ts` (the walk focus carries the step's map), `LinePanel.tsx` (no ring markers for a service notice)
- `e2e/notice-map.spec.ts`, `e2e/line-notices.spec.ts`, `e2e/mocks.ts`, `.size-limit.json`
- `checkpoints/CURRENT.md`, this task file

## Human outcome

Open the uptown A notice and the map shows the A's two tracks over the stretch, the seven skipped stops crossed out on the uptown track only, "Uptown side" and "Downtown side" signs beside their tracks, and the A at 59 St tagged "to Uptown".

## Scope and boundaries

- In scope: the map layers, the pure feature builder, a stand-in step map made from today's walk focus until the walk builder supplies one.
- Out of scope: the walk text and `alertDiagram.ts` (NMA-0081), the time buttons, elevator outage matching, voice.
- Uncertainty: entrance ids in our data are station ids, not one per entrance, so a step that names one elevator needs its coordinates or its index in `entrances.features`; the walk builder was asked for coordinates.

## Acceptance criteria

- [x] The layout bar passes at 320×568, 375×667, 390×844 and 1280×800 with a notice open and the skipped stretch in view (`e2e/notice-map.spec.ts`).
- [x] Every station, bus, shuttle stop, entrance and walk in a step's map data is drawn (`noticeMap.test.ts`).
- [x] Each signpost sits beside its own track (test on the 7 at 52 St and 69 St).
