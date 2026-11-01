# TASK-NMA-0001 — Make the VPS app public

<!-- continuity:task {"acceptance":["https://nyc.design-bakery.com/healthz answers 200","repository variable NYC_PUBLIC_URL is set and CI's contract job runs"],"depends_on":[],"goal":"Riders reach the VPS app at nyc.design-bakery.com, and CI's contract check runs against it.","id":"NMA-0001","issue_url":"https://github.com/Pukujan-lab/nyc-map-agent/issues/614","next_action":"owner adds nyc.design-bakery.com on Cloudflare tunnel A pointing at http://nyc-map-web:8080","owner":"claude-code","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Komodo deploys main to the VPS now, but the name answers 530 because tunnel A has no route to the app."} -->

- Status: active
- Owner: claude-code
- Priority: P1
- Depends on: none

## Goal

Riders reach the VPS app at nyc.design-bakery.com, and CI's contract check runs against it.

## Why

Komodo deploys main to the VPS now, but the name answers 530 because tunnel A has no route to the app.

## Allowed files

- `checkpoints/CURRENT.md`, `checkpoints/history/2026-11.md`, `deploy/README.md`, this task file. The route itself is a Cloudflare dashboard change, and the variable is a repository setting.

## Human outcome

Riders open nyc.design-bakery.com and get the app that main just deployed.

## Scope and boundaries

- In scope: the tunnel A hostname, the `NYC_PUBLIC_URL` variable, the checkpoint.
- Out of scope: the deploy path, which works (#613, Pukujan-lab/server-management#69).
- Dependencies/uncertainty: the hostname is the owner's dashboard step.

## Acceptance criteria

- [ ] `curl -s -o /dev/null -w '%{http_code}' https://nyc.design-bakery.com/healthz` prints 200.
- [ ] `NYC_PUBLIC_URL` is `https://nyc.design-bakery.com`, and CI's contract job runs on the next merge.

## Evidence and sources

On 2026-11-01 Komodo deployed `nyc-map-agent:0cb74693be46`. It is healthy, and a container on `study-os_edge` reached `http://nyc-map-web:8080/healthz` with a 200. The public name answers 530.

## Reproduction details (only when needed)

Not needed.

## Related records

- Owning issue: #614; related #611 and Pukujan-lab/server-management#69.
- Writer: claude-code on `docs/614-checkpoint-live-deploy`, as of 2026-11-01.
- Pull request: #615.

## Checkpoint log

No checkpoints yet.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
