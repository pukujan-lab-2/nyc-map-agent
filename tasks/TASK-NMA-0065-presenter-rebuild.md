# TASK-NMA-0065 — Presenter rebuild on a state machine

<!-- continuity:task {"acceptance":["All fourteen metamorphic relations pass in CI (docs/specs/PRESENTER_VALIDATION.md).","The journey suite advances through all eighteen chapters at four sizes with no dead end.","Every defect in docs/presenter/DEFECT_AUDIT.md is closed by a named relation.","The public site replays the whole story, asks and returns exactly, and Send completes a walk."],"depends_on":["NMA-0064"],"goal":"Rebuild the /present tour on an XState machine so the guided experience has no dead ends, exact resume, and one visible spine.","id":"NMA-0065","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/88","next_action":"Renderer refactor onto tourMachine, then journey e2e, gates, PR, deploy, public verify.","owner":"agent:dsh-lead","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The 2026-11-18 demo failed: 34 navigation defects, a broken spine, and a submission route that refused every Send."} -->

- Status: active
- Owner: agent:dsh-lead
- Priority: P1
- Depends on: NMA-0064

## Goal

One story, eighteen chapters, three acts, with a guide who never leaves the visitor stranded. The tour lives in an XState machine; the renderer only draws and animates. Metamorphic validation proves the properties the first edition lacked.

## Specs (written before code, owner instruction 2026-11-18)

- Product: `docs/presenter/PDD.md`
- System design: `docs/specs/PRESENTER_SDD.md`
- Validation: `docs/specs/PRESENTER_VALIDATION.md`
- Defect evidence: `docs/presenter/DEFECT_AUDIT.md` (34 defects, empirical)

## Progress

- 2026-11-18: specs written; spine.ts, router.ts, tourMachine.ts implemented; 14/14 metamorphic tests pass including exhaustive no-dead-ends traversal; bank retargeted onto the spine; server burst 20/min, chapter range 18, honest 429, stop authority (17/17 route tests). Send wire fix + QR more-info buttons shipped separately as #244. Renderer refactor in flight.

## Checkpoint log

- 2026-11-18, dsh-lead: opened after the failed demo. Investigation confirmed the spine loops at the tech story's first scene and every Send was refused (string vs object JSON). Core machine proven by exhaustive traversal before any renderer work.