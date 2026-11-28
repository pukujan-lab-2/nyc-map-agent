# TASK-NMA-0100 — Hands Free Baseline

<!-- continuity:task {"acceptance": ["a script times a hands-free turn from fixed clips and splits it into recording end, speech-to-text, agent first token and speech start", "it runs against the deployed app and against instant fixture replies, and both sets of numbers are committed", "nothing makes sound while it runs"], "depends_on": [], "goal": "Time today's hands-free turn end to end with fixed clips, against the deployed app and with instant fixture replies, so a live call has a number to beat.", "id": "NMA-0100", "issue_url": "https://github.com/pukujan-lab-2/nyc-map-agent/issues/299", "next_action": "let the pull request merge; step 2 compares the live call against these numbers", "owner": "agent:claude-code/b1d64ae3-e69f-43ae-866a-6494cb427df6", "priority": "P2", "protocol_version": "0.1.0-draft", "schema": "project-continuity.task.v1", "status": "active", "why": "The LiveKit pilot (issue 299) keeps a live call only if it is clearly faster than today, and nobody had measured today's turn."} -->

- Status: active
- Owner: agent:claude-code/b1d64ae3-e69f-43ae-866a-6494cb427df6
- Priority: P2
- Depends on: none

## Goal

Time today's hands-free turn end to end with fixed clips, against the deployed app and with instant fixture replies, so a live call has a number to beat.

## Why

The LiveKit pilot (issue 299) keeps a live call only if it is clearly faster than today, and nobody had measured today's turn.

## Allowed files

- `scripts/voice-baseline.ts`, `scripts/voice-baseline/` (the timing maths, its test and the three clips)
- `docs/eval/hands-free-baseline/` (the write-up and the raw numbers)
- `checkpoints/CURRENT.md`, this task file

## Human outcome

The owner can see how long a rider waits today between finishing a question and hearing the answer, and which part of the wait is which, before deciding on a live call.

## Acceptance criteria

- [x] A script times a hands-free turn from fixed clips and splits it into its parts.
- [x] Numbers against the deployed app and against instant fixture replies are committed (`docs/eval/hands-free-baseline/`).
- [x] Nothing makes sound: Chromium is muted and both voices are stubbed.

## Checkpoint log

No checkpoints yet.

### 2026-11-28 12:03:42 UTC — agent:claude-code/b1d64ae3-e69f-43ae-866a-6494cb427df6

<!-- continuity:checkpoint {"agent":"agent:claude-code/b1d64ae3-e69f-43ae-866a-6494cb427df6","blocked":[],"changed":["scripts/voice-baseline.ts, scripts/voice-baseline/, docs/eval/hands-free-baseline/"],"completed":["A scripted hands-free turn is timed from fixed clips, against the deployed app and with instant fixture replies"],"decisions":["Clips are made with the app's own /api/tts so they can be committed; the live run streams through a local proxy so first-token times are real"],"evidence":["Deployed app: 9.3 s median from the rider stopping to the answer's first word over 9 turns; fixture replies: 2.5 s; unit tests for the timing maths pass"],"evidence_class":"observed","next_action":"Let the pull request merge; step 2 compares the live call against these numbers","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"NMA-0100","timestamp":"2026-11-28T12:03:42Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"9baa54569301bc51051fb3f65a9c85dbaf1503774b5f0160f15b510ec232b1da","request_id":"b46ab6cf5dd04faa8083f72e850f3796","schema":"project-continuity.checkpoint-operation.v1","task_id":"NMA-0100"} -->

Completed:
- A scripted hands-free turn is timed from fixed clips, against the deployed app and with instant fixture replies

Evidence:
- Deployed app: 9.3 s median from the rider stopping to the answer's first word over 9 turns; fixture replies: 2.5 s; unit tests for the timing maths pass

Decisions:
- Clips are made with the app's own /api/tts so they can be committed; the live run streams through a local proxy so first-token times are real

Changed:
- scripts/voice-baseline.ts, scripts/voice-baseline/, docs/eval/hands-free-baseline/

Blocked/uncertain:
- none

Next:
- Let the pull request merge; step 2 compares the live call against these numbers

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
