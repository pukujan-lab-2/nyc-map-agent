# voice-agent: the hands-free live call worker

This is the LiveKit Agents worker behind the hands-free live call, a pilot that is off by default (`?flags=+liveCall`, issue 299, `docs/PLAN-livekit-hands-free.md`). It hears the rider and speaks the answer. The rider's page decides what to say: each line the worker hears goes to the page over LiveKit RPC (`copilot.turn`), the page asks `/api/agent` exactly as it does for a typed question, with the same tools and map actions, and sends back the line to speak.

It is a copy of design-bakery's worker (`Pukujan/design-bakery`, `voice-agent/` at 268b2dc), which is itself a copy of the lab's worker in `pukujan-lab-2/voice-agent-research`. The copy lets this app's calls be tuned on their own. What changed:

- It registers as `nyc-map-voice` (`AGENT_NAME`) and joins only rooms whose token names it (`server/features/agent/voiceToken.ts`). design-bakery's worker never joins these rooms, and this one never joins theirs, although both use the same LiveKit server.
- Speech requests carry `X-Speech-Project: nyc-map` (`SPEECH_PROJECT`). The gateway's route for that project is the `multilingual` stack (Whisper large-v3-turbo and Kokoro), set in voice-agent-research's `demo/live-site/speech/gateway/routes.toml`. Routing changes only there, and only when the owner asks. There is no cloud speech.
- The token tells the worker the stack and the language (`copilot.stack` is `multilingual`, `copilot.language` is `en`): the pilot is English only.
- design-bakery's scripted call (`scenarios.py`) and its addressee check (which lives in design-bakery's backend) are not copied. The noise test is step 3 of the plan.

Hush (noise and background-voice removal), the voice match, the stall watchdog and the Phoenix spans work as they do in design-bakery's worker. Its README has their measurements.

## Run it locally

You need a LiveKit dev server (`livekit-server --dev`) and the speech gateway or a speech server on `SPEECH_URL`.

```bash
python3.12 -m venv voice-agent/.venv && voice-agent/.venv/bin/pip install -r voice-agent/requirements.txt
```

```bash
LIVEKIT_URL=ws://127.0.0.1:7880 LIVEKIT_API_KEY=devkey LIVEKIT_API_SECRET=secret SPEECH_URL=http://127.0.0.1:18800 voice-agent/.venv/bin/python voice-agent/agent.py dev
```

Then start the app with the same key and secret (`LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_PUBLIC_URL=ws://127.0.0.1:7880`) and open it with `?flags=+liveCall`. On a Mac the worker runs without Hush, which needs a Linux library. The image below has it.

## Run it beside the app (not done yet)

Nothing here deploys the worker or sets any key. To try the pilot on the VPS the owner needs to:

1. Build the image: `docker build -t nyc-map-voice voice-agent`. The Dockerfile builds Hush from its source at a pinned commit and fetches both models by checksum.
2. Run it on the network that reaches design-bakery's LiveKit (`copilot-livekit:7880` on `copilot_default`), with `LIVEKIT_URL`, `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` from that server, and `SPEECH_URL=http://host.docker.internal:18800` for the gateway. `OCTO_KEY` and `OCTO_WORKSPACE` turn on its Phoenix spans; leave them out to keep it quiet.
3. Give the web app the same `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`, then recreate its container. `POST /api/voice/token` then answers with a room instead of 503.
4. Open the site with `?flags=+liveCall` and tap the hands-free button.

## Test it

```bash
voice-agent/.venv/bin/python -m unittest discover -s voice-agent/tests
```

Tests that need LiveKit skip themselves when it is not installed, and the voice match tests need numpy. All of them run in the image.
