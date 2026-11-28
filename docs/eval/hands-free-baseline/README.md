# How long a hands-free turn takes today

*Measured 2026-11-28 for step 1 of `docs/PLAN-livekit-hands-free.md` (issue #299). This is the number a live call has to beat.*

A rider asks "Does the 7 stop at 74 Street Broadway?" with hands-free on. Against the deployed app, the first word of the answer came 9.3 seconds after they stopped talking (median of 9 turns, 6.1 to 12.4 s). About 6.3 s in, they hear "One moment, I'm working on it…", which the app says when an answer is slow. The plan's bar for keeping a live call is under 2 s for a simple question.

Three parts make up most of the wait:

1. The agent's first token takes 3.5 s (1.5 to 6.2 s). It is the largest part and the least steady one.
2. Speech-to-text takes 1.6 s for a 2 to 3 s question (1.4 to 2.2 s).
3. Speech does not start until the whole answer is in, and then the app voice's first sound takes another 1.1 s. A call that speaks the first sentence as soon as it arrives saves both waits.

With every server reply instant (the fixture run), a turn still takes 2.5 s: 1.2 s waiting for silence before the app decides the rider has finished, 0.3 to 1.5 s turning the recording into a 16 kHz WAV and sending it, and the rest in the page and the test's own fake replies. So a turn-based mode cannot get under 2 s even with instant servers; the end-of-turn wait and the upload belong to the live call's side of the comparison.

| Part (median) | Fixture replies | Deployed app |
|---|---:|---:|
| Rider stops → recording ends | 1.23 s | 1.19 s |
| Recording ends → `/api/stt` sent | 0.85 s | 0.43 s |
| `/api/stt` | 0.35 s | 1.62 s |
| Text back → `/api/agent` sent | 0.10 s | 0.12 s |
| `/api/agent` first token | 0.22 s | 3.47 s |
| First token → whole answer | 0.00 s | 0.33 s |
| Answer in → `/api/tts` first byte | 0.17 s | 1.10 s |
| First byte → sound starts | 0.00 s | 0.00 s |
| Rider stops → first word of the answer | 2.52 s | 9.29 s |
| Rider stops → first sound of any kind | 2.52 s | 6.30 s |

Parts are medians on their own, so they do not add up exactly to the total. Every run is in [`results-2026-11-28.json`](results-2026-11-28.json).

## Two things the runs turned up

Speech-to-text dropped the line letter in all three "Is the A train running normally right now?" turns. It heard "Is the train running normally right now?", and the agent asked which line. The clips are in the app's own synthetic voice, so a real rider may fare better, but single-letter lines are worth a place in the noise test (step 3).

The app learns the room's background level from the first tenth of a second the microphone hears. In early runs the fake rider started talking before that frame, the app took the voice for background, and the turn ended after 6 s with "I didn't catch that". A rider who starts talking the moment they tap may hit the same thing. The script now starts each question 0.6 s after recording begins.

## How it was measured

`scripts/voice-baseline.ts` opens the built app in Chromium at phone size, taps hands-free and plays a fixed clip into a fake microphone. From there the app's own code runs the turn: it listens for the pause, records, sends the clip to `/api/stt`, asks `/api/agent` and reads the answer through `/api/tts`. The page notes the time of each step. "Rider stops" is the end of the clip's last 20 ms stretch louder than the level the app counts as speech.

The runs take the path phones take (our server's speech-to-text). Each run was a fresh page, with three clips three times each, plus one uncounted warm-up turn against the deployed app. The deployed run passed `/api/stt`, `/api/agent` and `/api/tts` through a local streaming proxy to `https://nyc.design-bakery.com`, so the speech gateway's `nyc-map` route (Whisper large-v3-turbo on the Windows PC) and the real agent answered. The fixture run answered those three at once from canned replies; its small times are mostly Playwright's own routing on a busy laptop.

The three clips in `scripts/voice-baseline/clips/` were made with the app's own `/api/tts`. They say "When is the next 4 train downtown?", "Does the 7 stop at 74 Street Broadway?" and "Is the A train running normally right now?".

Nothing made sound. Chromium ran with `--mute-audio`, the fake microphone was never connected to the speakers, the phone voice was the silent stub from `e2e/mocks.ts`, and the app voice's sound sources were swapped for stubs that only note the time.

Run it again with:

```bash
pnpm build:e2e
pnpm tsx scripts/voice-baseline.ts --api both --runs 3 --out docs/eval/hands-free-baseline/results-YYYY-MM-DD.json
```

`--api live` or `--api fixture` runs one side only. If Playwright's own Chromium download is missing, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` as for the browser tests. The deployed app allows 12 speech-to-text requests a minute from one address, so the script waits 6 s between live turns.
