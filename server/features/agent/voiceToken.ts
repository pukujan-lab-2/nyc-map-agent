/**
 * POST /api/voice/token {use}: a LiveKit access token for one live voice call (issue 299, docs/PLAN-livekit-hands-free.md).
 * One endpoint for the map's hands-free call (`use: "map"`) and the presenter's (`use: "present"`, pull request 243), generalised
 * from that pull request's voiceToken.ts, which design-bakery's backend/src/copilot/voiceToken.ts was ported into.
 *
 * The token is for one new room and asks LiveKit to dispatch one named worker into it: `nyc-map-voice` (voice-agent/ here) for
 * the map, design-bakery's worker for the presenter until it has its own. A worker joins only rooms whose token names it, so the
 * two sites' calls stay apart on the shared LiveKit server. The map's token also tells the worker which speech stack and language
 * to use, as the caller's participant attributes (`copilot.stack`, `copilot.language`); the gateway's `nyc-map` route is the
 * multilingual stack, and the pilot is English only.
 *
 * Off until LIVEKIT_API_KEY and LIVEKIT_API_SECRET are set: then it answers 503 and the app keeps its turn-based voice. The secret
 * signs the token and never leaves the server; a reply holds only the room's URL, its name and the one-room token.
 */
import { createHmac, randomUUID } from "node:crypto";
import { clientIp } from "../../lib/clientIp";
import { createLimiter } from "./fair-use";

type Env = Record<string, string | undefined>;
type VoiceUse = "map" | "present";
type VoiceGrant = { url: string; token: string; room: string };

/** The shared LiveKit server the pilot uses (design-bakery's, owner 2026-11-28). */
const DEFAULT_URL = "wss://copilot.design-bakery.com";
/** How long the token can be used to join; LiveKit refreshes a joined caller's own. */
const JOIN_S = 10 * 60;
/** A call is a few tokens an hour at most; this stops a script from minting rooms. */
const limiter = createLimiter({ windowMax: 30, windowMs: 3_600_000, burstMax: 6, burstMs: 60_000 });

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export function voiceTokenConfigured(env: Env = process.env): boolean {
  return Boolean(env.LIVEKIT_API_KEY?.trim() && env.LIVEKIT_API_SECRET?.trim());
}

/** Which worker a call of this kind asks for, and what it is told about the caller. Pure, for tests. */
export function callFor(use: VoiceUse, env: Env = process.env): { agentName: string; prefix: string; attributes?: Record<string, string> } {
  if (use === "present") return { agentName: env.LIVEKIT_PRESENTER_AGENT_NAME?.trim() || "design-bakery-voice", prefix: "nma-present" };
  return {
    agentName: env.LIVEKIT_AGENT_NAME?.trim() || "nyc-map-voice",
    prefix: "nma-map",
    attributes: { "copilot.stack": env.LIVEKIT_SPEECH_STACK?.trim() || "multilingual", "copilot.language": "en" },
  };
}

/** A signed token for a caller in a new room (HS256, as LiveKit expects). */
export function mintVoiceToken(use: VoiceUse, env: Env = process.env, now = Date.now()): VoiceGrant {
  const key = env.LIVEKIT_API_KEY?.trim() ?? "";
  const secret = env.LIVEKIT_API_SECRET?.trim() ?? "";
  const url = env.LIVEKIT_PUBLIC_URL?.trim() || DEFAULT_URL;
  const { agentName, prefix, attributes } = callFor(use, env);
  const room = `${prefix}-${randomUUID().slice(0, 8)}`;
  const t = Math.floor(now / 1000);
  const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const body = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({
    iss: key,
    sub: `rider-${randomUUID().slice(0, 8)}`,
    nbf: t - 5,
    exp: t + JOIN_S,
    video: { room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true, canUpdateOwnMetadata: true },
    roomConfig: { agents: [{ agentName }] },
    ...(attributes ? { attributes } : {}),
  })}`;
  return { url, room, token: `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}` };
}

/** The route's handler; `body` is the JSON the request carried (Hono has read it already). */
export function voiceToken(body: unknown, headers: Headers, env: Env = process.env): Response {
  if (!voiceTokenConfigured(env)) return json({ error: "voice_call_unavailable" }, 503);
  const use = (body as { use?: unknown } | null)?.use;
  if (use !== "map" && use !== "present") return json({ error: "invalid_query", issues: ['use: "map" or "present"'] }, 400);
  if (!limiter.take(`voice:${clientIp(headers)}`).ok) return json({ error: "rate_limited" }, 429);
  return json(mintVoiceToken(use, env));
}
