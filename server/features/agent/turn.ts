/**
 * Per-turn rules for the chat route (#641), decided in code from the latest message so an earlier
 * topic cannot steer a new request, and a reply filter so nothing internal is spoken to the rider.
 */
import { RESTROOM } from "./noModel";

type Message = { role: string; content: string };

/** The model's tool calls in a turn before it must write its answer: transit_plan, line_status, elevators, one more. */
export const MAX_TOOL_STEPS = 4;

/** A "yes" in the app's eight languages: the start of a short reply that accepts the last offer. */
const CONFIRM = /^(?:yes|yeah|yep|yup|ok|okay|sure|go|start|please|do it|let'?s go|s[ií]|vamos|dale|claro|oui|ouais|d'accord|allons-y|да|давай|хорошо|ладно|好|可以|是|行|走|开始|开始吧|네|예|응|좋아요|시작|হ্যাঁ|ঠিক|wi|dakò|d'akò)(?![\p{L}])/iu;

/** How long a message is in words; Chinese, Japanese and Korean run together, so two characters count as a word. */
function size(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).reduce((n, w) => n + (/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(w) ? Math.ceil(w.length / 2) : 1), 0);
}

/**
 * The latest message starts something new. It is a reply, not a new request, only when it is one or
 * two words ("yes", "sí vamos") or a short yes to the last answer. "get to times square" is four
 * words and a new request, though isShortReply (tools.ts) counts it as a reply.
 */
export function isNewRequest(messages: readonly Message[]): boolean {
  const last = messages.at(-1);
  if (last?.role !== "user" || !messages.slice(0, -1).some((m) => m.role === "assistant")) return last?.role === "user";
  const words = size(last.content);
  return !(words <= 2 || (words <= 5 && CONFIRM.test(last.content.trim())));
}

/**
 * Whether this turn may use the restroom tool: the latest message asks for one, or it is a short
 * reply to the last answer ("yes" to a restroom walk). Otherwise a restroom answered earlier in the
 * conversation must not be answered again for "get to Times Square".
 */
export function restroomAllowed(messages: readonly Message[]): boolean {
  const last = messages.at(-1)?.content ?? "";
  return RESTROOM.test(last) || !isNewRequest(messages);
}

/** Tool names, tool result fields and ids the rider must never hear. */
const INTERNAL = /\b(?:transit_plan|route_walk|nearest_restroom|station_exit|elevator_status|line_status|weather_forecast|find_event|read_page|suggest_layer|drive_plan|walkToNearest|walkFromExit|showRoute|openPanel|playFlythrough|enterStreetView|flyTo|geocode|setTime|hazards|tripId|needsAnswer|activeTools)\b|\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

/** The model thinking aloud before it acts: "Let me find the nearest restroom first — ...". */
const NARRATION = /^\s*(?:let me (?!know)|let's |i'll |i will |i'm going to |i am going to |first,? i )/i;

/** The sentence, or "" when it names something internal. */
const cleanSentence = (s: string): string => (INTERNAL.test(s) || /<\/?think>/i.test(s) ? "" : s);

/**
 * Passes a reply through a sentence at a time, dropping any sentence that names a tool, a field
 * or a trip id. Whole sentences wait until they end, so the rider still sees the answer build up.
 */
export class Scrub {
  private buf = "";
  dropped = 0;
  push(delta: string): string {
    this.buf += delta;
    // Reasoning the model printed before its answer: everything up to the closing tag goes.
    const think = this.buf.lastIndexOf("</think>");
    if (think >= 0) this.buf = this.buf.slice(think + "</think>".length);
    let out = "";
    // A sentence ends at . ! ? followed by space, at 。！？, or at a line break.
    for (let m = /^[\s\S]*?(?:[.!?]+(?=\s)|[。！？]+|\n)\s*/.exec(this.buf); m; m = /^[\s\S]*?(?:[.!?]+(?=\s)|[。！？]+|\n)\s*/.exec(this.buf)) {
      out += this.keep(m[0]);
      this.buf = this.buf.slice(m[0].length);
    }
    return out;
  }
  rest(): string {
    const r = this.keep(this.buf);
    this.buf = "";
    return r;
  }
  private first = true;
  private keep(s: string): string {
    if (!s.trim()) return s;
    // Thinking aloud in the opening sentence is dropped; the answer follows it.
    const narrated = this.first && NARRATION.test(s);
    this.first = false;
    const kept = narrated ? "" : cleanSentence(s);
    if (!kept && s.trim()) this.dropped += 1;
    return kept;
  }
}
