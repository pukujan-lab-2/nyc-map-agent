# TASK-NMA-0011 — Pool By Schedule

<!-- continuity:task {"acceptance":["segment lookups pool over the MTA schedule and a time-of-day band","subway and bus both use the pool","the pooled SQL runs on the real table and yields more usable segments"],"depends_on":[],"goal":"Learned train and bus times pool by MTA schedule and time of day.","id":"NMA-0011","issue_url":"https://github.com/Pukujan-lab/nyc-map-agent/issues/648","next_action":"after #650 deploys, spot-check /api/transit-segments/all on the live site; score pooled vs per-hour accuracy once #594 exists","owner":"claude-code","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Per-hour-of-week buckets rarely had 3 samples, so learned times seldom applied (#648)."} -->

- Status: active
- Owner: claude-code
- Priority: P2
- Depends on: none

## Goal

Learned train and bus times pool by MTA schedule and time of day.

## Why

Per-hour-of-week buckets rarely had 3 samples, so learned times seldom applied (#648).

## Allowed files

- `server/features/transit/segments.ts`, `busSegments.ts`, `segments.test.ts`, `checkpoints/`, this file.

## Human outcome

Learned times apply in many more places.

## Scope and boundaries

- In scope: the read side (API SQL).
- Out of scope: the recorder, holidays, accuracy scoring (#594).
- Dependencies/uncertainty: medians are averaged by count, an approximation.

## Acceptance criteria

- [ ] Pooled lookups for subway and bus.
- [ ] Tests pass.
- [ ] More usable segments on real data.

## Evidence and sources

Real table (60,664 rows, 92,316 samples): Wed 8am 0 to 1,352 usable segments; weekday 3am 0 to 846; Sat 10pm 17 to 298. MTA GTFS calendars: Weekday, Saturday, Sunday only. vitest server/features/transit: 44 passed.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Required leaf owning issue, parent ancestry and dependencies (or explicitly none): #648, related #594, no parent.
- Primary writer / branch / source issue revision / as-of status:
- Related PR/CI evidence and push receipt (request ID / SHA):

## Checkpoint log

No checkpoints yet.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
