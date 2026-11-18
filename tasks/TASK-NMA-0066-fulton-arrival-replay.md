# TASK-NMA-0066 — Fulton Arrival Replay

<!-- continuity:task {"acceptance":["A Brooklyn-bound A or C arrival opens the Fulton scene for a modeled exit.","At a shared exit each route stays on its arrival platform. A missing route falls back without substituting a neighboring exit.","Score a forward 67 Av replay after predictions are saved, with GPS and pressure varied."],"depends_on":[],"goal":"Select Fulton exit scenes by the arrival platform and measure the 67 Av tracking baseline","id":"NMA-0066","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/232","next_action":"Test floor candidates and recovery from an accepted GPS jump in a separate recorded replay.","owner":"agent:codex/01a1ec5e-b70c-7342-bade-77e99cb521db","priority":"high","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"A preview can start on the wrong floor and we need repeatable software checks before using sensor estimates for live guidance."} -->

- Status: active
- Owner: agent:codex/01a1ec5e-b70c-7342-bade-77e99cb521db
- Priority: high
- Depends on: none

## Goal

Select Fulton exit scenes by the arrival platform and measure the 67 Av tracking baseline

## Why

A preview can start on the wrong floor and we need repeatable software checks before using sensor estimates for live guidance.

## Allowed files

- Trip preview, Fulton model selection, tests, and continuity records.

## Human outcome

A Fulton preview starts on the platform the rider arrived on. A separate replay reveals which sensor estimates are too uncertain to guide a rider.

## Scope and boundaries

- In scope: modeled Fulton exits and a benchmark from existing footage and sensor logs.
- Out of scope: new verified step-free routes, deployment of the tracking experiment, and collection in the station.

## Acceptance criteria

- [x] A Brooklyn-bound A or C arrival opens the Fulton scene for a modeled exit.
- [x] At a shared exit each route stays on its arrival platform. A missing route falls back without substituting a neighboring exit.
- [x] Score a forward 67 Av replay after predictions are saved, with GPS and pressure varied.

## Evidence and sources

The browser’s normal trip preview opened the Fulton model for an A train. Unit checks separate the A/C and 4/5 starts at the same street exit and refuse an unmodeled neighboring exit. The private 67 Av benchmark reported one pressure rise, all floors uncertain, and two of three injected GPS jumps rejected.

## Reproduction details (only when needed)

Run the Fulton trip-station browser test and the dollhouse and recorder unit tests. The sensor benchmark uses timestamp prefixes and evaluates against labels only after writing predictions. Its geographic reference is a reconstructed path.

## Related records

- [Automatic floor detection](https://github.com/pukujan-lab-2/nyc-map-agent/issues/232).
- [Fulton station preview](https://github.com/pukujan-lab-2/nyc-map-agent/issues/129).

## Checkpoint log

No checkpoints yet.

### 2026-11-18 05:38:40 UTC — agent:codex/01a1ec5e-b70c-7342-bade-77e99cb521db

<!-- continuity:checkpoint {"agent":"agent:codex/01a1ec5e-b70c-7342-bade-77e99cb521db","blocked":[],"changed":["none"],"completed":["Selected Fulton exit walks by arrival platform and ran the 67 Av tracking baseline using existing data."],"decisions":["Keep the pressure and GPS replay offline and keep accessibility directions limited to verified links."],"evidence":["Unit checks separate the shared Nassau exit by platform. The A-train browser simulation opens the Fulton model. The replay left all floors uncertain and rejected two of three injected GPS jumps."],"next_action":"Evaluate partial floor confirmation and recovery from a bad GPS correction on a separate recording.","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0066","timestamp":"2026-11-18T05:38:40Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"ef5cf48783bc83c5c2c75e8b98a000b2f74765bad5cdd5e0f2addbcbdd996230","request_id":"f35c7a7ad5d54683a6edd677ddb856f0","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0066"} -->

Completed:
- Selected Fulton exit walks by arrival platform and ran the 67 Av tracking baseline using existing data.

Evidence:
- Unit checks separate the shared Nassau exit by platform. The A-train browser simulation opens the Fulton model. The replay left all floors uncertain and rejected two of three injected GPS jumps.

Decisions:
- Keep the pressure and GPS replay offline and keep accessibility directions limited to verified links.

Changed:
- none

Blocked/uncertain:
- none

Next:
- Evaluate partial floor confirmation and recovery from a bad GPS correction on a separate recording.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
