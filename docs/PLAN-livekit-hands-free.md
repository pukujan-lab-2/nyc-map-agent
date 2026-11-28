# Plan: a live voice call for hands-free mode

*A pilot plan, written 2026-11-28 at the owner's request. Nothing in it is built. It is off by default when it is.*

## The problem

A rider on a crowded platform, bag in one hand, taps hands-free and asks "when's the next 4 downtown?". Today the app records one turn, waits for a pause, uploads the clip, turns it into text on our server (`/api/stt`), asks the agent, and then reads the answer aloud. The next question starts the same way from scratch. If the rider talks over the answer, a barge-in detector (`src/lib/voice/bargeIn.ts`) stops the voice, but the app is still taking turns, not holding a conversation.

We have not measured how long a turn takes end to end, so the first step below does that.

## What we already have

We do not need to build a voice stack. Two sibling projects already run one:

- `voice-agent-research` chose LiveKit Agents for voice and phone calls (its decision 0002), with open speech models we host. On its LFM3 audio stack, recognition took about 1.0 s a turn and the first audio came 0.2 to 0.8 s later (its decision 0013).
- Its speech gateway already has a route for this app: `[project.nyc-map]` uses the `multilingual` stack (`demo/live-site/speech/gateway/routes.toml`). A live call can use that route as it is.
- `design-bakery` runs a live call on that setup. Its worker (`voice-agent/`, registered as `design-bakery-voice`) only hears and speaks; the page decides what to say and answers the worker over LiveKit messages (`copilot.greet`, `copilot.turn`). It filters the room three ways before answering: background noise removal, a match on the caller's voice, and a check for lines said to someone else. In its scripted call of 12 lines, including a roommate, a TV and its own echo, it wrongly answered none and wrongly ignored none, and replies started about 2 s after the caller stopped.
- Our own draft, pull request 243, ports that call into `/present` behind a flag: a token endpoint, the browser client (131 kB compressed, loaded only when a call starts), and Mute and End call buttons.

## The pilot

The same split as design-bakery: a worker that hears and speaks, and our page that decides.

1. **A worker for this app.** Copy design-bakery's worker as `nyc-map-voice`, using the gateway's `nyc-map` route. It joins only rooms whose token names it. No routing change and no cloud speech.
2. **A token endpoint.** Generalise pull request 243's `voiceToken.ts` into one endpoint the map and the presenter share, behind a new `liveCall` flag that is off by default.
3. **The page decides.** With the flag on, hands-free opens a call instead of recording one turn. Each line the worker hears goes to our existing agent (`/api/agent`), with the same tools and the same map actions as a typed question. The page sends back the line to say, and starts speaking on the first sentence.
4. **Always a way back.** Mute and End call sit in the sheet. If the call drops, which it will in stations without signal, the app falls back to today's turn-based mode by itself and says so in one line.

Audio is handled as it is today: heard, answered and dropped, never stored.

## What decides whether we keep it

| Measure | How | Keep it if |
|---|---|---|
| Time from the rider stopping to the first word of the answer | A scripted call, against today's turn-based mode measured the same way | Clearly faster than today, and under 2 s for a simple question |
| Lines wrongly answered or ignored | design-bakery's scripted-call method, with platform and train noise | None wrongly answered; at most one in twelve ignored |
| Languages | The same script in the eight languages the app speaks | Each one is understood and answered in its language |
| Server cost | Memory and CPU per call on the VPS, and how many calls fit at once | It fits beside the app and CI without slowing them |
| Dropped calls | A walk into a station with no signal | The fallback takes over without the rider doing anything |

## Steps, each its own pull request

1. Measure today's hands-free turn, end to end, in a scripted test. This is the baseline.
2. The worker, the token endpoint and the `liveCall` flag, English only, for the owner with `?flags=+liveCall`.
3. The noise test: platform, train and crowd recordings through the scripted call.
4. The other seven languages through the `multilingual` stack.
5. A short write-up with the numbers, and the owner's call: keep it off, offer it to everyone, or drop it.

## What stays the same

Hands-free keeps working as it does now for everyone unless the flag is on. Typed questions, the agent's tools and its answers do not change. Speech routing changes only in `voice-agent-research`, and only when the owner asks; cloud speech stays off.

## Questions for the owner

- Should the worker live in this repository, as design-bakery's does, or in `voice-agent-research`?
- Should the pilot use design-bakery's LiveKit server, or one of its own on the VPS?
