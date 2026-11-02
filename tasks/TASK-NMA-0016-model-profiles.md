# TASK-NMA-0016 — Model Profiles

<!-- continuity:task {"acceptance":["Settings has a Model choice (Auto, Smart, Dev) on phones and the desktop menu, stored on the phone and sent with each question","the smart chain falls over between providers on any failure and puts failing ones last","GET /api/agent/health shows each provider's last probe without keys"],"depends_on":[],"goal":"Let the owner switch the agent between large hosted models and the small dev model from Settings, with a health watcher picking the working provider","id":"NMA-0016","issue_url":"https://github.com/pukujan-lab-2/nyc-map-agent/issues/35","next_action":"define scope and observable acceptance checks, then begin bounded work","owner":"claude-code","priority":"high","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"LFM3 started failing on trips while DeepSeek had worked, and development of the small model should not cost riders a working agent"} -->

- Status: active
- Owner: claude-code
- Priority: high
- Depends on: none

## Goal

Let the owner switch the agent between large hosted models and the small dev model from Settings, with a health watcher picking the working provider

## Why

LFM3 started failing on trips while DeepSeek had worked, and development of the small model should not cost riders a working agent

## Allowed files

- `server/features/agent/{providers,health,model-fallback,routes}.ts`, `server/app.ts`, `server/openapi.ts`
- `src/features/agent/{profilePref,stream,schema}.ts`, `src/components/{MenuRow,SettingsBody,MapChrome}.tsx`, `src/components/ui/switch.tsx`, `src/components/task-screens.css`, `src/lib/i18n/menuText.ts`
- tests beside them and `e2e/responsive.spec.ts`

## Human outcome

The owner can flip the agent to the large models when the small one misbehaves, from the phone, and see which provider is answering.

## Scope and boundaries

- In scope: provider chain over the Octo vault relay, health watcher, Settings switch.
- Out of scope: putting the smart keys on the VPS (a production env change, done separately), the trip suite rerun on both profiles.
- Dependencies/uncertainty: free OpenRouter models change often.

## Acceptance criteria

- [x] Model choice in Settings on phone and desktop, sent as `profile`.
- [x] Failing provider moves to the next, with that provider's URL and key (unit test).
- [x] Layout bar passes with Settings open at all four sizes.

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
