import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** A stand-in for LiveKit's room: it records the page's RPC handlers and events, so a test can play the worker. */
const fake = vi.hoisted(() => {
  type Handler = (d: { callerIdentity: string; payload: string }) => Promise<string>;
  type Listener = (...a: unknown[]) => void;
  class Room {
    rpc = new Map<string, Handler>();
    events = new Map<string, Listener>();
    remoteParticipants = new Map<string, { isAgent: boolean }>();
    disconnected = false;
    localParticipant = { publishTrack: () => Promise.resolve() };
    constructor() { rooms.push(this); }
    registerRpcMethod(name: string, h: Handler) { this.rpc.set(name, h); }
    on(ev: string, cb: Listener) { this.events.set(ev, cb); return this; }
    connect() { return Promise.resolve(); }
    disconnect() { this.disconnected = true; return Promise.resolve(); }
  }
  const rooms: Room[] = [];
  const track = { stop: vi.fn(), mute: vi.fn(() => Promise.resolve()), unmute: vi.fn(() => Promise.resolve()) };
  const mic = { fail: null as Error | null };
  return { rooms, track, mic, Room };
});

vi.mock("livekit-client", () => ({
  Room: fake.Room,
  RoomEvent: { TrackSubscribed: "trackSubscribed", ParticipantConnected: "participantConnected", ParticipantDisconnected: "participantDisconnected", Reconnecting: "reconnecting", Reconnected: "reconnected", Disconnected: "disconnected" },
  Track: { Kind: { Audio: "audio" }, Source: { Microphone: "microphone" } },
  createLocalAudioTrack: () => (fake.mic.fail ? Promise.reject(fake.mic.fail) : Promise.resolve(fake.track)),
}));

import { answerWithin, createLiveCall, endLine, fetchGrant, heardText, SORRY, type CallEnd } from "./liveCall";

const grant = { url: "wss://lk.example", token: "a.b.c", room: "nma-map-1234abcd" };
const flush = () => new Promise((r) => setTimeout(r, 0));
const lastRoom = () => fake.rooms[fake.rooms.length - 1];

beforeEach(() => {
  fake.rooms.length = 0;
  fake.mic.fail = null;
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(Response.json(grant))));
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("what the worker heard", () => {
  it("takes the words from a copilot.turn payload", () => {
    expect(heardText(JSON.stringify({ text: "  Is the 7 running?  ", turn: "x" }))).toBe("Is the 7 running?");
    expect(heardText("not json")).toBe("");
    expect(heardText(JSON.stringify({ text: 4 }))).toBe("");
    expect(heardText(undefined)).toBe("");
  });
});

describe("the line when a call ends", () => {
  it("says the app fell back to one question at a time, and nothing when the rider ended it", () => {
    expect(endLine("dropped")).toMatch(/dropped.*one question at a time/);
    expect(endLine("failed")).toMatch(/didn't connect.*one question at a time/);
    expect(endLine("blocked")).toMatch(/Microphone access is blocked/);
    expect(endLine("ended")).toBeNull();
  });
});

describe("the room token", () => {
  it("asks /api/voice/token for a map call and returns the grant", async () => {
    await expect(fetchGrant()).resolves.toEqual(grant);
    const [url, init] = (fetch as unknown as { mock: { calls: Array<[string, RequestInit]> } }).mock.calls[0];
    expect(url).toMatch(/\/api\/voice\/token$/);
    expect(JSON.parse(init.body as string)).toEqual({ use: "map" });
  });
  it("is null while live calls are not set up", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(Response.json({ error: "voice_call_unavailable" }, { status: 503 }))));
    await expect(fetchGrant()).resolves.toBeNull();
  });
});

describe("an answer the worker can wait for", () => {
  it("is the answer when it comes in time, and a short apology when it does not", async () => {
    await expect(answerWithin(() => Promise.resolve("Yes, it does."))).resolves.toBe("Yes, it does.");
    await expect(answerWithin(() => Promise.reject(new Error("down")))).resolves.toBe(SORRY);
    vi.useFakeTimers();
    const slow = answerWithin(() => new Promise<string>(() => {}), 1000);
    vi.advanceTimersByTime(1000);
    await expect(slow).resolves.toBe(SORRY);
  });
});

describe("a live call", () => {
  const open = () => {
    const ends: CallEnd[] = [];
    const answer = vi.fn((heard: string) => Promise.resolve(`You asked: ${heard}`));
    const call = createLiveCall({ answer, onEnd: (why) => ends.push(why) });
    return { call, ends, answer };
  };

  it("answers each heard line through the page and says the reply", async () => {
    const { call, answer } = open();
    call.start();
    await flush(); await flush();
    const room = lastRoom();
    expect(call.getState().status).toBe("connecting");
    room.remoteParticipants.set("worker", { isAgent: true });
    room.events.get("participantConnected")?.({ isAgent: true });
    expect(call.getState().status).toBe("live");
    const reply = await room.rpc.get("copilot.turn")?.({ callerIdentity: "worker", payload: JSON.stringify({ text: "Does the 7 stop at 74 Street?" }) });
    expect(answer).toHaveBeenCalledWith("Does the 7 stop at 74 Street?");
    expect(JSON.parse(reply as string)).toEqual({ say: "You asked: Does the 7 stop at 74 Street?" });
    await expect(room.rpc.get("copilot.turn")?.({ callerIdentity: "stranger", payload: "{}" })).rejects.toThrow();
  });

  it("mutes without ending, and End call leaves the room with no fallback line", async () => {
    const { call, ends } = open();
    call.start();
    await flush(); await flush();
    const room = lastRoom();
    room.events.get("participantConnected")?.({ isAgent: true });
    await call.mute(true);
    expect(fake.track.mute).toHaveBeenCalled();
    expect(call.getState()).toEqual({ status: "live", muted: true });
    call.end();
    expect(room.disconnected).toBe(true);
    expect(fake.track.stop).toHaveBeenCalled();
    expect(call.getState()).toEqual({ status: "idle", muted: false });
    expect(ends).toEqual(["ended"]);
  });

  it("says it dropped when the worker leaves a live call", async () => {
    const { call, ends } = open();
    call.start();
    await flush(); await flush();
    const room = lastRoom();
    room.events.get("participantConnected")?.({ isAgent: true });
    room.events.get("participantDisconnected")?.({ isAgent: true });
    expect(ends).toEqual(["dropped"]);
    expect(call.getState().status).toBe("idle");
  });

  it("falls back when live calls are not set up", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(Response.json({}, { status: 503 }))));
    const { call, ends } = open();
    call.start();
    await flush(); await flush();
    expect(ends).toEqual(["failed"]);
    expect(fake.rooms).toHaveLength(0);
  });

  it("falls back when the worker never joins", async () => {
    vi.useFakeTimers();
    const { call, ends } = open();
    call.start();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(ends).toEqual(["failed"]);
  });

  it("does not fall back to turns when the microphone is blocked", async () => {
    fake.mic.fail = Object.assign(new Error("denied"), { name: "NotAllowedError" });
    const { call, ends } = open();
    call.start();
    await flush(); await flush();
    expect(ends).toEqual(["blocked"]);
  });
});
