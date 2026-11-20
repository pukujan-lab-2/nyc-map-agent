# NaviLens code reader (removable)

This folder reads the coloured pattern of a NaviLens code from a camera frame, so the Walk Guide can put a rider's dot on a checkpoint without a tap. It is kept apart from the rest of the app so it can be taken out in one step.

## Why it is kept apart

NaviLens codes are NaviLens's own format. The owner said on 2026-11-20 that the NaviLens team gave permission to read them. That permission is not written down in this repository, and it could be withdrawn. If it is, delete this folder.

## What it does and does not do

- It finds a code in a picture and reads its 25 cells as letters: C, M, Y or K (cyan, magenta, yellow, black).
- It looks that pattern up in our own table, `codes.ts`, which says which Walk Guide checkpoint the code stands at.
- It does not work out what a code means to NaviLens, and it contacts none of NaviLens's services.
- It contains no NaviLens software and no NaviLens code images. The tests draw their own made-up codes.

The layout it expects (a white frame, a black border one cell wide, five by five cells, and the three ink colours) was read off the code image on navilens.com on 2026-11-20.

## How good it is

A first, close-range reader. In the tests it reads made-up codes straight on, small and off centre, tilted up to 25 degrees, squashed to 60% width as if seen from the side, and in dim, speckled pictures. It has never been pointed at a real code in a station. Run over our own films of the walk (413 frames from eight clips, 2026-11-20) it found no codes, and one false alarm, a dark sign with a yellow stripe, which it now rejects because a code must hold at least two inks. One known weakness: "white" is judged against the brightest thing in the picture, so a dark box with coloured squares on a plain pale wall can pass for a code. The table lookup is exact, so such a misread matches no checkpoint. NaviLens's own app reads from much further away and while moving; this does not.

## What is in the table

Nothing yet. `codes.ts` is empty until someone photographs the codes along a filmed walk and adds each pattern with its checkpoint.

## Where it is used

Nowhere yet. No screen imports it, and `isolation.test.ts` fails if a file outside this folder does without being listed there. Because nothing imports it, the rule against unused modules has one exception for this folder; that exception goes when the Walk Guide starts using the reader.

## How to remove it

1. Delete `src/lib/navilens/`.
2. Remove the line for `^src/lib/navilens/` from the `no-orphans` rule in `.dependency-cruiser.cjs`.
3. If `isolation.test.ts` listed any files as allowed to import from here, remove that import from each one. Today the list is empty.

Nothing in this folder imports from the rest of the app, and the same test checks that.
