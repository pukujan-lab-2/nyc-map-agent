/**
 * Where a question goes. One pure function over the spine and the prepared
 * bank; no regex luck, no ordered surprises. Every suggestion, chip and bank
 * entry is asserted to resolve by the validation tests (M6), so adding one
 * that lands nowhere fails the build. Defects D3–D9, D25–D29, D33 of the
 * 2026-11-18 audit are eliminated here by construction.
 */
import { SPINE, NAME_TARGETS, isWalkStop, legalView } from "./spine";

export interface BankEntry { question: string; scene: number; answer: string }

export type Resolution =
  | { kind: "advance" }
  | { kind: "back" }
  | { kind: "resume" }
  | { kind: "restart" }
  | { kind: "smalltalk" }
  /** The stop's own prepared direction, or the chapter's prepared answer; no movement, no network. */
  | { kind: "explain" }
  | { kind: "navigate"; chapter: number; view?: string; answer?: string }
  | { kind: "view"; view: string }
  | { kind: "unknown"; offer: number[] };

export const normalize = (words: string): string =>
  words.trim().toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");

const CONTROL: ReadonlyArray<readonly [RegExp, Resolution["kind"]]> = [
  [/^(go on|keep going|carry on|continue|continue the tour|next|next stop|start the tour|guide me|start the walk)$/, "advance"],
  [/^(take me back|go back|back|previous|rewind)$/, "back"],
  [/^(resume|resume tour|resume the route|resume the tour|back to the route|keep going from here)$/, "resume"],
  [/^(start over|restart|return to start)$/, "restart"],
];

const GREETING = /^(?:hi|hello|hey|good (?:morning|afternoon|evening)|how(?:s| is) it going|how are you|how (?:are you|u) doing|how(?:s| is) your day|how do you do|nice to meet you)(?:\s+(?:design baker|baker|moon))?[.!?\s]*$/;
const WEATHER = /\b(?:weather|temperature|forecast|raining|rainy|sunny|how (?:hot|cold|warm))\b/;
const VENUE = /\b(?:where (?:are we|am i)(?: presenting)?(?: today)?|what (?:event|venue|conference) (?:is this|are we at|am i at)|which (?:event|venue|conference)|where is (?:the |this )?(?:event|demo|conference))\b/;
const VENUE_STATEMENT = /^(?:we(?:re| are)(?: presenting)?|i(?:m| am)(?: presenting)?|the (?:event|demo|conference) is|our (?:event|demo|conference) is)\s+(?:at|in|called)\s+.{2,100}$/;
const CONTINUATION = /^(why|why though|how|what happened|what is that|what does that mean|explain that|tell me more|go deeper|what do you mean|really|and then|what about that|can you explain|what else|what about it)$/;
const STOP_DIRECTION = /^(what do i do|where do i go|what now|which way|what happened)( here)?$/;

/** Topic intents, one compiled table. Each entry is covered by a router test. */
const TOPICS: ReadonlyArray<readonly [RegExp, number]> = [
  [/\b(jump\w*|drift\w*|gps|withheld|67\s*(av|ave|avenue)|estimates?)\b/, 8],
  [/\b(vision|camera reads?|sign reader|elevator sign|union square|ocr|elevator to l|sign match|saved frame)\b/, 9],
  [/\b(el479|plaque|elevator number|elevator id|queensboro sign)\b/, 10],
  [/\b(barometer|pressure|vertical|altitude|go upstairs|climb|elevator ride|readings)\b/, 11],
  [/\b(colmap|splat|meshroom|3d capture|point cloud|3d thing|gaussian|become 3d|how was this made|the pipeline)\b/, 12],
  [/\b(fulton|arkit|nassau|route graph|augmented reality|live guidance|\bar\b|green line)\b/, 13],
  [/\b(toei|tokyo|floorpair|clew|research|anyone else|other people|other countries|other cities|waymap|navilens|wmata|pimlico|singapore|london|seoul|washington)\b/, 14],
  [/\b(license|privacy|contribut\w*|github|download|data today|collecting|data flow|octo|upload|give feedback|open data|the plan|mission|help people)\b/, 17],
  [/\b(tech stack|the stack|under the hood|built with|technologies|gis)\b/, 15],
  [/\b(ai|artificial intelligence|vision model|vision analysis|the model|neural|apple vision)\b/, 16],
  [/\b(archive|first pitch|original video|hackathon)\b/, 7],
  [/\b(starting point|introduction|beginning|your trip)\b/, 0],
];

const CITY_VIEWS: ReadonlyArray<readonly [RegExp, string]> = [
  [/washington|wmata/, "washington"],
  [/singapore/, "singapore"],
  [/london|pimlico/, "london"],
  [/seoul/, "seoul"],
];

/** The view a command word asks for on a given chapter, if that chapter has it. */
function commandedView(bare: string, chapter: number): string | undefined {
  const ch = SPINE[chapter];
  if (!ch) return undefined;
  const want = (v: string) => (legalView(chapter, v) ? v : undefined);
  if (/\b(original walk|recorded walk|this (part|stop|walk|clip)|play this)\b/.test(bare)) return want("walk");
  if (chapter === 11 && /\b(readings|values|numbers|sensor export)\b/.test(bare)) return want("data");
  if (chapter === 8 && /\b(map|estimates|tracks?)\b/.test(bare)) return want("map");
  if (chapter === 12) {
    if (/\b(point cloud|camera positions|points)\b/.test(bare)) return want("points");
    if (/\b(process|pipeline|steps|sequence|how was this made)\b/.test(bare)) return want("process");
    if (/\bsplat\b/.test(bare)) return want("splat");
    if (/\b(orbit|video)\b/.test(bare)) return want("video");
  }
  if (chapter === 9 && /\b(play|watch|guide|clip|video)\b/.test(bare)) return want("video");
  if (chapter === 14) {
    for (const [pattern, view] of CITY_VIEWS) if (pattern.test(bare)) return want(view);
  }
  if (/\b(play|watch|replay)\b/.test(bare)) return want("video") ?? want("walk");
  return undefined;
}

/**
 * Resolve one question. `chatMatch` is the small-talk predicate's verdict from
 * chat.js (greeting, weather, venue, or a pending answer); the router honours it
 * except for bare continuations, which explain the current chapter (D29).
 */
export function resolveQuestion(raw: string, current: number, bank: readonly BankEntry[], chatMatch = false): Resolution {
  const bare = normalize(raw);
  if (!bare) return { kind: "unknown", offer: [8, 9, 12, 17] };

  for (const [pattern, kind] of CONTROL) if (pattern.test(bare)) return { kind } as Resolution;

  // Composed navigation: "take me to X" / "go back to X" resolve names before topics (D26, D27).
  const composed = /^(?:take me to|go to|jump to|go back to|back to|show me|open)\s+(.+)$/.exec(bare);
  if (composed) {
    const target = NAME_TARGETS.find(([pattern]) => pattern.test(composed[1]))?.[1]
      ?? TOPICS.find(([pattern]) => pattern.test(composed[1]))?.[1];
    if (target !== undefined) return { kind: "navigate", chapter: target, view: commandedView(bare, target) };
  }

  if (CONTINUATION.test(bare)) return { kind: "explain" };
  if (chatMatch || GREETING.test(bare) || WEATHER.test(bare) || VENUE.test(bare) || VENUE_STATEMENT.test(bare)) return { kind: "smalltalk" };

  const known = bank.find((item) => normalize(item.question) === bare);
  if (known) return { kind: "navigate", chapter: known.scene - 1, answer: known.answer };

  if (isWalkStop(current) && STOP_DIRECTION.test(bare)) return { kind: "explain" };

  // A view command on the current chapter stays on it (M5).
  const here = commandedView(bare, current);
  if (here && /\b(show|play|watch|open|see|readings|map|points|splat|process)\b/.test(bare)) return { kind: "view", view: here };

  const named = NAME_TARGETS.find(([pattern]) => pattern.test(bare))?.[1];
  if (named !== undefined) return { kind: "navigate", chapter: named, view: commandedView(bare, named) };

  const topic = TOPICS.find(([pattern]) => pattern.test(bare))?.[1];
  if (topic !== undefined) return { kind: "navigate", chapter: topic, view: commandedView(bare, topic) };

  return { kind: "unknown", offer: [8, 9, 12, 17] };
}