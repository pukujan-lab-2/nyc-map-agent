# PDD: the Design Baker presentation, second edition

*Written 2026-11-18 after the live demo failed. The owner's verdict: "too many bugs and dead ends… it couldn't go to many places, it didn't feel guided at all, too many routes." This document defines the product behavior the rebuild must deliver. The system design is `docs/specs/PRESENTER_SDD.md`; the proof it works is `docs/specs/PRESENTER_VALIDATION.md`. Read `docs/DESIGN_RULES.md` first; it still binds.*

## The problem with the first edition

The first edition grew two interleaved tours (a seven-stop walk and eight evidence scenes) joined by regex routing, a bookmark flag, a history stack, and an LLM that could pick chapters. Every combination was a special case. Questions landed nowhere, "Keep going" sometimes resumed the wrong state, the Route menu hid the tech story behind a collapsed section, and nothing guaranteed that every screen had a way forward. The demo proved that ad-hoc state cannot hold a guided experience.

## The product in one paragraph

One story, told in order, with a guide who never leaves the visitor stranded. The visitor presses **one button** to advance through eighteen chapters in three acts: the recorded walk, the technology behind it, and the invitation to join. At any moment they can ask a question by voice or text; Design Baker flies to the evidence, answers with sources, and one press returns them to the exact place they left — same chapter, same view, same second of a paused clip. Every screen shows where the visitor is (act, chapter, progress) and what to do next. There are no dead ends, by construction and by test.

## The spine: eighteen chapters, three acts

**Act I — one rider's walk** (the recorded Cortlandt St → Union Square trip):
1. Your trip — the problem: GPS lost underground
2. Broadway entrance — enter, turn right for the elevator
3. Uptown platform — the Uptown & Queens elevator, an R or W
4. Platform elevator — up one level at Union Square
5. Mezzanine — turn left under "Elevator to L"
6. Street elevator — left at the orange mural, up to the street
7. Street — outside, the Climate Clock

**Act II — the technology behind the walk**:
8. The first pitch — the original hackathon clip
9. One walk, two estimates — the 67 Av GPS replay (video first, estimates map one tap away)
10. A sign becomes a clue — the Union Square sign read
11. One elevator, several floors — the EL479 plaque
12. The phone feels a climb — the pressure trace and readings
13. Frames become a place — the Codex Fulton 3D map, the splat capture, COLMAP points, the pipeline
14. A route through Fulton — the simulated walk
15. Ideas proven elsewhere — Washington, Singapore, London, Seoul, Tokyo, FloorPair, Clew
16. The stack we build on — phone → server → Octo → models → guide
17. How the AI reads a sign — words only, 6 of 8 exact, zero wrong

**Act III — join**:
18. Build with us — mission, the data loop, QR code, public link, contribute and sample links

**One advance button** walks the spine in this order. The progress reads "n / 18" with the act named. The chapter menu is one flat list grouped by act — no collapsed sections, no second tour. The walk stops keep their station photos, guidance arrows and original-walk clips; the evidence chapters keep their views. Views within a chapter (video / map / points / readings) are options on the same screen, never separate routes.

## What the visitor can do, in every state

- **Advance** (Guide me / Continue / the act's next label) — always visible, always works, never loops silently.
- **Go back** — one chapter, or out of a detour to the exact interrupted state.
- **Ask** — type or dictate. Substantive questions navigate to the best chapter and answer there with sources when live; small talk (greetings, venue, weather) answers in place without moving the tour. An unanswerable question says so plainly and offers the nearest chapter — never a silent fallback that talks without showing.
- **Jump** — the chapter menu, the opening screen's chips, and suggested questions (three per chapter, tappable, phrased to route correctly).
- **Resume** — after any detour, one press restores chapter + view + clip time + playing state, exactly.
- **Hear** — sound on by default; Moon's bubble keeps the full reply until the next action; original clips keep their own audio while Moon stays silent.

## The guide's behavior

Design Baker flies to the real control, clicks it, and speaks beside what he shows. He speaks the answer **before** he finishes flying, so a reply is never silent-then-late. His camera moves in the 3D chapter are preset moves the machine triggers; a manual drag always wins. He never takes input away from a control, and his bubble never covers one.

## The homepage QR panel

The app's QR dialog keeps the code and adds **more-info buttons**: Meet Design Baker (opens `/present`), Record a walk (opens `/record`), and See what is coming. A visitor who scans or taps learns what the project is in one tap, not just where it lives.

## The submission route

A rider who records a walk at `/record` can send it in one tap and gets a receipt. The send path must work end to end on the public site: chunked upload, assembly, sensor JSON paired with the video by recording id, storage in Octo, and a clear retryable error when any step fails. The diagnosis and fix are tracked in the SDD's defect appendix; nothing ships that leaves Send broken.

## What stays unchanged

The map app's screens and rules, the recorder's capture behavior, the speech gateway routing (owned by `voice-agent-research`), the server's answer contract (Octo retrieval scoped to reviewed documents, one forced-tool Haiku call, guards and tracing), and the privacy rules: raw recordings private, nothing published without agreement, memory on the phone.

## Done when

The metamorphic validation spec passes in full: every chapter reachable from the start by advancing alone; no reachable state without a working advance and back; interrupt → resume restores the exact state for every chapter and view; every suggested question and chip lands on a renderable chapter; the submission route completes a synthetic walk end to end in staging; and the layout bar passes at all four sizes for every chapter.