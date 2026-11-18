# TASK-NMA-0064 — Underground Presenter

<!-- continuity:task {"acceptance":["A visitor can reach the guided walk at /present on the public site.","A live Washington Metro answer cites the reviewed project source.","A visitor can ask for evidence, then return to the same checkpoint.","The four supported screen sizes pass the layout check."],"depends_on":[],"goal":"Let visitors follow the recorded station walk and ask Design Baker to show the evidence on the public NYC Map Agent site.","id":"NMA-0064","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/88","next_action":"Publish the presenter through the NYC web container and repeat the voice and route checks over the public tunnel.","owner":"agent:codex/01a1ec5e-b70c-7342-bade-77e99cb521db","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The working tour and live questions currently require the presenter's laptop."} -->

- Status: active
- Owner: agent:codex/01a1ec5e-b70c-7342-bade-77e99cb521db
- Priority: P1
- Depends on: none

## Goal

Let visitors follow the recorded station walk and ask Design Baker to show the evidence on the public NYC Map Agent site.

## Why

The working tour and live questions currently require the presenter's laptop.

## Scope

The presenter owns the React page and its reviewed media, the question routes, and the browser checks. The website's existing speech services, web container and Cloudflare Tunnel serve visitors.

## Acceptance criteria

- A visitor can reach the guided walk at /present on the public site.
- A live Washington Metro answer cites the reviewed project source.
- A visitor can ask for evidence, then return to the same checkpoint.
- The four supported screen sizes pass the layout check.

## Evidence

Open /present, start the guide, request pressure readings, and return to the walk. Ask what Washington Metro deployed and open the source under Moon’s reply. Use the live URL for the release check.

## Related records

[Camera guidance work](https://github.com/pukujan-lab-2/nyc-map-agent/issues/88).

## Checkpoint log

- 2026-11-18, dsh-lead: continued the port after the ChatGPT session ran out of usage. Verified the uncommitted React page, server routes and media (tsc and the six route tests pass; the 29 failing unit-test files came from a stale nested worktree, removed). Owner approved the ship scope plus: Phoenix traces per presenter turn, Moon-driven splat camera moves, a QR code and public link on the end screens, a Settings entry in the main app, and mission/plan/data/contribute answers. Spec written first at `docs/specs/PRESENTER.md`; four parallel agents implemented the additions while the lead added the Settings link (8 languages) and its layout case. Vision review through the owner's inferhub key flagged letterboxed media, a small speech bubble and dead space on the city screens; fixes assigned. Next: integrate, run the full gates and e2e, open the pull request, and set the VPS env keys for live answers.
