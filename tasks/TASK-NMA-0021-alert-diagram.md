# TASK-NMA-0021 — Alert Diagram

<!-- continuity:task {"acceptance": ["Skip-stop, part-suspension, shuttle-bus and run-local notices open as a line diagram built from subway.json (alertDiagram.test.ts)", "A notice with no usable stations shows its first sentence or two", "Tapping a notice reads the steps aloud and lights each step's stations; Stop and a voice toggle work", "No Other ways button anywhere; e2e line-notices case passes expectLayout at all four sizes"], "depends_on": [], "goal": "Show an open service notice as a small diagram of its stretch of line and read it aloud step by step", "id": "NMA-0021", "issue_url": "https://github.com/pukujan-lab-2/nyc-map-agent/issues/55", "next_action": "after the pull request deploys, open a notice on a phone and listen to the walk", "owner": "claude-code", "priority": "medium", "protocol_version": "0.1.0-draft", "schema": "project-continuity.task.v1", "status": "active", "why": "The owner finds the notice paragraphs hard to read and never uses the Other ways button"} -->

- Status: active
- Owner: claude-code
- Priority: medium
- Depends on: none

## Goal

Show an open service notice as a small diagram of its stretch of line and read it aloud step by step

## Why

The owner finds the notice paragraphs hard to read and never uses the Other ways button

## Allowed files

- src/features/transit/{alertDiagram.ts,alertDiagram.test.ts,alertDiagram.fixtures.json,NoticeDiagram.tsx,LinePanel.tsx,TransitCard.tsx}
- src/lib/voice/{say.ts,useSpeech.ts}
- e2e/line-notices.spec.ts, .size-limit.json, checkpoints/CURRENT.md

## Human outcome

A rider sees which stations a notice touches at a glance and can hear it read out, instead of reading the MTA's paragraph.

## Scope and boundaries

- In scope: subway notices in the line panel.
- Out of scope: bus and rail notices, routing around the change (the chat agent does that).
- Dependencies/uncertainty:

## Acceptance criteria

- [ ] state observable, task-specific outcomes.

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
