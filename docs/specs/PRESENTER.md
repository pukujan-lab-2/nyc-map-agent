# The underground presenter at /present

*Spec for task NMA-0064, written 2026-11-18 before the finishing work, in the repo's spec-plus-contract-tests pattern (see `RECORDER_CONTRIBUTIONS.md`). Product behavior, system design, and the test plan that must pass before this ships.*

## Problem

The guided station walk and its live questions only worked on the presenter's laptop as an HTML prototype. Visitors at a demo — and anyone afterwards — need to open one public page, follow the recorded walk, and ask Design Baker questions by voice or text, on a phone or a desktop.

## Product behavior (PDD delta)

- `/present` is a full-screen visual stage with minimal text (owner's design rules apply: the visual dominates, words are few). Design Baker, the moon pet, flies to the real controls, clicks them, and speaks in short bubbles beside what he is showing.
- A guided path of seven stops replays the recorded Cortlandt St → Union Square walk: Your trip, Broadway entrance, Uptown platform, Platform elevator, Mezzanine, Street elevator, Street. **Guide me** advances; **←** goes back; the Route menu lists every stop plus the evidence scenes.
- Eight evidence scenes open from questions or the Route menu: the first pitch clip, the 67 Av GPS replay, the Union Square sign match, the EL479 plaque, the pressure climb, the COLMAP/Gaussian-splat capture (interactive, with Moon-driven camera moves), the Fulton simulation, the field research, and the open-data invitation.
- A visitor can interrupt at any point — dictate (the app's existing server speech-to-text) or type. Design Baker answers, then **Keep going** / **Resume route** returns to the same stop, the same view, and the same second of a paused clip.
- Questions cover the project's mission and plan, the stack and where AI helps, how to get the data, how to contribute, and what other cities have done. Prepared answers work offline; live answers retrieve reviewed sources from Octo and cite them.
- Small talk works: greetings, the venue ("We're presenting at …" is remembered for the visit), and NYC weather through the app's weather route.
- The end screen (Build with us, and the walk's last stop) shows a QR code and the public link so an audience can open the presenter on their own phones.
- The main app reaches it from Settings → **Meet Design Baker**, on every screen size and in every app language.
- Sound is on by default. While an original clip plays with its own narration, Moon stays silent; prepared narration or the app's hosted voice speaks his answers.

## System design (SDD)

Client: `src/features/presenter/` — `PresentPage.tsx` (React shell, lazy chunk), `flow.js` (tour state, bookmarks, interrupt/return, visible click choreography), `scenes.js` (stage drawings), `pet.js` (motion, bubbles, cursor play), `chat.js` (small talk, venue, weather intent), `microphone.ts` (dictation through `@/lib/voice/serverStt`), `media.json` (reviewed media paths, prepared narration, prepared Q&A bank, sensor samples).

Server: `server/features/presenter/routes.ts`, mounted in `server/app.ts`:
- `GET /api/presenter/status` → `{haiku, octo, dictate}` from env presence; no secrets leave the server.
- `POST /api/presenter/ask` → Octo RAG (`/api/rag/query`, host pinned to `octodb.design-bakery.com`, workspace-scoped key, allowlisted reviewed documents from `sources.json`, latest versions, ≤3 matches) → one Haiku call forced through the `present_answer` tool `{chapter 1–10, answer ≤45 words, sourceIds}` → zod-validated reply with source titles/pages. The client maps chapter → scene and performs the visible navigation; the LLM never drives the mouse.
- `POST /api/presenter/chat` → Haiku small talk, ≤6 turns of history, two sentences.
- `POST /api/presenter/weather` → allowlisted NYC places through the existing weather handler; Open-Meteo/NWS only.
- Guards: 8 requests/min/IP, 4 concurrent, 6 kB body cap, 25 s Haiku / 18 s Octo timeouts, prepared fallback on any failure.
- Tracing: every turn becomes one Phoenix trace through `server/lib/tracing.ts` (Octo OTLP), child spans for retrieval and the model call, question/answer masked like the main agent's `runLog`, keys never in spans. `OCTO_TRACES=off` or missing keys stay a no-op.

Camera protocol: the splat viewer (`public/presenter-media/splat/`) accepts same-origin `postMessage` `{type:"presenter-camera", move:"overview"|"orbit"|"closeup"}`; moves tween, manual drag cancels them, reduced motion jumps. `flow.js` posts overview→orbit when Moon opens the splat, guarded by the interrupt token.

Env (VPS app env file only): `NYC_PRESENTER_OCTO_WORKSPACE_ID`, `NYC_PRESENTER_OCTO_KEY`, `NYC_PRESENTER_HAIKU_KEY` (Anthropic key or Octo working key, relayed via the vault proxy). Without them the prepared tour, clips, dictation and prepared answers still work.

RAG content: reviewed Q&A lives in `docs/presenter/qa/` (one JSON per topic, manifest with document ids); `scripts/presenter-seed.ts` upserts it into the presentation workspace and verifies searchability. The server allowlist (`sources.json`) names exactly the reviewed documents.

Hosting: no new service. The React page and API ship in the existing `nyc-map-web` container on the VPS, reached through Cloudflare tunnel A at `nyc.design-bakery.com`, deployed by Komodo from `main`.

## Test plan (TDD — these must pass before merge)

Contract/unit (`server/features/presenter/routes.test.ts`): status reflects env; ask validates and forces the tool shape; retrieval stays on the pinned host and allowlist; rate limit, concurrency cap, body cap; weather place allowlist; secrets never in replies or traces; spans emitted with the right names; tracing no-op when off.

Browser (`e2e/presenter.spec.ts`, `e2e/presenter-camera.spec.ts`, `e2e/responsive.spec.ts`):
- `expectLayout` at 320×568, 375×667, 390×844, 1280×800 for the opening screen, the Route menu, a walk stop, the evidence scenes, and both QR end screens.
- Moon's visible click sequence for "Play the original walk at the mezzanine" and "Show the pressure readings"; resume restores the clip's exact second.
- Splat camera commands arrive (overview then orbit) and stop after an interrupt.
- Prepared mission/contribute answers work with `haiku:false`; the QR image and public link are visible on both end screens.
- Settings → Meet Design Baker opens `/present` at every size, in the phone pull sheet and the desktop dropdown.

## What stays unchanged

The map app's screens, the recorder, the speech gateway routing (owned by `voice-agent-research`), and the main agent's Octo workspace. Raw recordings stay private; nothing a rider recorded is published without agreement.