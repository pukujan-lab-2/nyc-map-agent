/**
 * Where along a train, in the words a conductor would use (owner, 2026-11-13): seven parts from the
 * front to the back, and the way the train is going ("the 4/5 train going downtown to Brooklyn").
 * The station walk's first line, the trip's step-off line and the where-am-I helper all use these.
 */

/** The seven parts, front to back. The where-am-I helper keys its translations by them. */
export const TRAIN_PARTS = [
  "at the front",
  "near the front",
  "near the middle front",
  "in the middle",
  "near the middle back",
  "near the back",
  "at the back",
] as const;
export type TrainPartWords = (typeof TRAIN_PARTS)[number];

/** A share of the way along the train, 0 its back and 1 its front, as one of the seven parts. */
export function trainPart(f: number): TrainPartWords {
  const k = Math.min(Math.max(f, 0), 1);
  // Seven equal parts; the very front is part 0.
  return TRAIN_PARTS[Math.min(6, Math.floor((1 - k) * 7))];
}

/** Where a part of the train is for someone standing at its middle. */
export function fromMiddle(part: string): string {
  // Said by the train's ends, not "ahead" or "behind": stepping off, the rider may face either way.
  if (part === "in the middle") return "right by you";
  if (part === "near the middle front") return "a little toward the front of the train";
  if (part === "near the middle back") return "a little toward the back of the train";
  return `${part} of the train`;
}

/**
 * Which way a train is going, the way the platform signs say it: "going downtown to Brooklyn",
 * "going uptown to the Bronx". `direction` is "Uptown" or "Downtown"; `lines` the train's bullets.
 * Lines whose uptown trains stay in Manhattan (A, C, 1) are just "going uptown".
 */
export function goingWords(direction: string, lines: string[]): string {
  const d = direction.toLowerCase();
  if (d === "downtown") return "going downtown to Brooklyn";
  if (d === "uptown") return lines.some((l) => ["2", "4", "5", "B", "D"].includes(l)) ? "going uptown to the Bronx" : "going uptown";
  return `going ${d}`;
}
