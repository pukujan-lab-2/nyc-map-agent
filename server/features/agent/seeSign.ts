/**
 * POST /api/agent/see-sign {image, signs}: which of a short list of station
 * signs and landmarks a rider's photo shows. The walk guide sends one camera
 * frame and the signs of the walk it is on; the answer is one of their ids, or
 * null when the photo shows none of them. The on-phone text reader could not
 * read our own sign frames (#88), so this asks a hosted model that can see.
 *
 * The photo leaves the phone for this, which nothing else in the app does: it
 * goes to the vision model through the key relay, is not stored here, and is
 * not logged. Only OpenRouter's entry in the smart providers is a model that
 * takes pictures, so it is the only one asked.
 */
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, type LanguageModel } from "ai";
import { clientIp } from "../../lib/clientIp";
import { createLimiter } from "./fair-use";
import { routeFor, smartProviders } from "./providers";

const MAX_SIGNS = 30;
const MAX_WORDS = 160;
/** About 600 kB of JPEG once decoded: a 960 px frame is a quarter of that. */
const MAX_IMAGE = 800_000;
const limiter = createLimiter({ windowMax: 120, windowMs: 3_600_000, burstMax: 8, burstMs: 60_000 });

const json = (body: unknown, status: number) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

interface SignChoice { id: string; sign: string }

/** The question put to the model. Pure, for tests. */
export function seePrompt(signs: readonly SignChoice[]): string {
  return [
    "A rider in a New York subway station took this photo to find out where they are.",
    "Which ONE of these does it show? Read any sign in the photo first; the words on it decide.",
    ...signs.map((s, i) => `${i + 1}: ${s.sign}`),
    "Answer with the number only. Answer 0 if the photo shows none of them or you cannot tell.",
  ].join("\n");
}

/** The model's reply as an index into the list, or null for none. The first whole number counts: the answer is asked for alone, and a sign's own numbers ("14 Street") come after it when the model adds words. Pure, for tests. */
export function parseChoice(reply: string, n: number): number | null {
  const m = /\d+/.exec(reply);
  if (!m) return null;
  const k = Number(m[0]);
  return k >= 1 && k <= n ? k - 1 : null;
}

/** The JPEG's base64, from a data URL or bare; null when it is not one or is too big. */
export function jpegBase64(image: unknown): string | null {
  if (typeof image !== "string") return null;
  const b64 = image.replace(/^data:image\/jpeg;base64,/, "");
  return b64.length > 100 && b64.length <= MAX_IMAGE && /^[A-Za-z0-9+/]+=*$/.test(b64) && b64.startsWith("/9j/") ? b64 : null;
}

/** The one smart provider that takes pictures, or null when its key is not set. */
function visionModel(): LanguageModel | null {
  const p = smartProviders().find((x) => x.id === "openrouter");
  if (!p) return null;
  const route = routeFor(p, "/chat/completions");
  const relay: typeof fetch = (_url, init) => fetch(route.url, { ...init, headers: { ...(init?.headers as Record<string, string> | undefined), ...route.headers } });
  return createOpenAICompatible({ name: "see-sign", baseURL: p.target, apiKey: "relay", fetch: relay })(p.model);
}

export async function seeSign(req: Request, model?: () => LanguageModel | null): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { image?: unknown; signs?: unknown } | null;
  const image = jpegBase64(body?.image);
  const signs = Array.isArray(body?.signs) ? (body.signs as unknown[]) : [];
  const ok = signs.length > 0 && signs.length <= MAX_SIGNS && signs.every((s): s is SignChoice => {
    const x = s as Partial<SignChoice> | null;
    return !!x && typeof x.id === "string" && /^[\w-]{1,60}$/.test(x.id) && typeof x.sign === "string" && x.sign.length > 0 && x.sign.length <= MAX_WORDS;
  });
  if (!image || !ok) return json({ error: "image must be a JPEG of up to about 600 kB; signs 1-30 of {id, sign}" }, 400);
  if (!limiter.take(clientIp(req.headers)).ok) return json({ error: "too many" }, 429);
  const m = (model ?? visionModel)();
  if (!m) return json({ error: "no model here can look at a photo" }, 503);
  try {
    const { text } = await generateText({
      model: m,
      messages: [{ role: "user", content: [{ type: "text", text: seePrompt(signs) }, { type: "file", data: image, mediaType: "image/jpeg" }] }],
      // The free model thinks aloud before it answers; too small a budget ends in no answer (measured: 1200 was short twice in nine).
      maxOutputTokens: 2500,
      abortSignal: req.signal,
    });
    const i = parseChoice(text, signs.length);
    return json({ id: i === null ? null : signs[i].id }, 200);
  } catch (e) {
    console.warn(`see-sign: ${(e as Error).message}`);
    return json({ error: "the model could not look at the photo" }, 502);
  }
}
