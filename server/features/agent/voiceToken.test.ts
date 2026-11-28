import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { callFor, mintVoiceToken, voiceToken, voiceTokenConfigured } from "./voiceToken";

const env = { LIVEKIT_API_KEY: "lk-key", LIVEKIT_API_SECRET: "lk-secret-value" };
const headers = (ip: string) => new Headers({ "x-forwarded-for": ip, "cf-connecting-ip": ip });
const claims = (token: string) => JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()) as Record<string, unknown>;

describe("live call token", () => {
  it("is off until the key and the secret are both set", async () => {
    expect(voiceTokenConfigured({})).toBe(false);
    expect(voiceTokenConfigured({ LIVEKIT_API_KEY: "k" })).toBe(false);
    expect(voiceTokenConfigured(env)).toBe(true);
    const off = voiceToken({ use: "map" }, headers("10.0.0.1"), {});
    expect(off.status).toBe(503);
    expect(await off.json()).toEqual({ error: "voice_call_unavailable" });
  });

  it("refuses a body without a known use", async () => {
    const r = voiceToken({ use: "phone" }, headers("10.0.0.2"), env);
    expect(r.status).toBe(400);
    expect(voiceToken(null, headers("10.0.0.2"), env).status).toBe(400);
    expect(JSON.stringify(await r.json())).not.toContain("lk-secret");
  });

  it("gives the map a room that asks for nyc-map-voice on the multilingual stack, in English", async () => {
    const r = voiceToken({ use: "map" }, headers("10.0.0.3"), env);
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const grant = (await r.json()) as { url: string; room: string; token: string };
    expect(grant.url).toBe("wss://copilot.design-bakery.com");
    expect(grant.room).toMatch(/^nma-map-[0-9a-f]{8}$/);
    expect(JSON.stringify(grant)).not.toContain("lk-secret");
    const c = claims(grant.token);
    expect(c.iss).toBe("lk-key");
    expect(c.video).toMatchObject({ room: grant.room, roomJoin: true, canPublish: true });
    expect(c.roomConfig).toEqual({ agents: [{ agentName: "nyc-map-voice" }] });
    expect(c.attributes).toEqual({ "copilot.stack": "multilingual", "copilot.language": "en" });
  });

  it("signs the token with the secret, so LiveKit accepts it", () => {
    const { token } = mintVoiceToken("map", env, Date.parse("2026-11-28T12:00:00Z"));
    const [head, body, sig] = token.split(".");
    expect(createHmac("sha256", "lk-secret-value").update(`${head}.${body}`).digest("base64url")).toBe(sig);
    const c = claims(token);
    expect((c.exp as number) - (c.nbf as number)).toBe(605);
  });

  it("asks for design-bakery's worker for the presenter until it has its own", () => {
    expect(callFor("present", {})).toEqual({ agentName: "design-bakery-voice", prefix: "nma-present" });
    expect(callFor("present", { LIVEKIT_PRESENTER_AGENT_NAME: "baker" }).agentName).toBe("baker");
    expect(claims(mintVoiceToken("present", env).token).attributes).toBeUndefined();
  });

  it("stops one address minting many rooms", () => {
    const h = headers("10.0.0.9");
    const statuses = Array.from({ length: 8 }, () => voiceToken({ use: "map" }, h, env).status);
    expect(statuses.slice(0, 6)).toEqual([200, 200, 200, 200, 200, 200]);
    expect(statuses[6]).toBe(429);
  });
});
