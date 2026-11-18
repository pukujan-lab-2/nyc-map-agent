import { createHmac, randomUUID } from "node:crypto";

/**
 * A LiveKit access token for one live call, minted here so the call is answered by the
 * voice agent registered as NYC_PRESENTER_LIVEKIT_AGENT_NAME (design-bakery's voice-agent
 * today; a Design Baker stack is the follow-up). Ported from design-bakery's
 * backend/src/copilot/voiceToken.ts. Off unless the key and secret are set: the route
 * then answers 503 and the presenter keeps its turn-based dictation.
 */

export type VoiceGrant = { url: string; token: string; room: string };

type Env = Record<string, string | undefined>;

export function voiceTokenConfigured(env: Env = process.env): boolean {
  return Boolean(env.NYC_PRESENTER_LIVEKIT_KEY?.trim() && env.NYC_PRESENTER_LIVEKIT_SECRET?.trim());
}

/** The token for a caller in a new room. The room configuration asks for the agent by name, so LiveKit dispatches only it. */
export function mintVoiceToken(env: Env = process.env): VoiceGrant {
  const key = env.NYC_PRESENTER_LIVEKIT_KEY?.trim() ?? "";
  const secret = env.NYC_PRESENTER_LIVEKIT_SECRET?.trim() ?? "";
  const agentName = env.NYC_PRESENTER_LIVEKIT_AGENT_NAME?.trim() || "design-bakery-voice";
  const url = env.NYC_PRESENTER_LIVEKIT_PUBLIC_URL?.trim() || "wss://copilot.design-bakery.com";
  const room = `nma-present-${randomUUID().slice(0, 8)}`;
  const now = Math.floor(Date.now() / 1000);
  const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const body = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({
    iss: key,
    sub: `caller-${randomUUID().slice(0, 8)}`,
    nbf: now - 5,
    exp: now + 3600,
    video: { room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true, canUpdateOwnMetadata: true },
    roomConfig: { agents: [{ agentName }] },
  })}`;
  return { url, room, token: `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}` };
}