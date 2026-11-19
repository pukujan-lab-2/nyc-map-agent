import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../app";
import { startBody } from "../../../src/features/recorder/record/upload";
import { recording } from "./fixture";
import { clearUploads } from "./upload";

/**
 * The wire between the phone and the server, tested as one piece. The demo of
 * 2026-11-18 failed because each side was tested against its own assumption:
 * the client sent the walk's JSON as a string, the schema requires an object,
 * and every Send was refused before the handler ran. This test builds the body
 * with the REAL client function and posts it through the REAL app, so the two
 * sides cannot drift apart again unnoticed.
 */
beforeEach(() => {
  clearUploads();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("the recording start body the client actually sends", () => {
  const input = () => ({
    recording: recording(),
    json: JSON.stringify(recording()),
    video: new Blob([new Uint8Array([1, 2, 3, 4])], { type: "video/mp4" }),
    name: "union-sq-walk",
  });

  it("is accepted by the real route, with the video's byte count", async () => {
    const body = startBody(input());
    expect(typeof body.json).toBe("object");
    expect(body.bytes).toBe(4);
    const res = await app.request("/api/recordings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ received: 0 });
  });

  it("is refused when the JSON goes up as a string, the way the broken client sent it", async () => {
    const broken = { device: "Pixel 8", name: "union-sq-walk", json: JSON.stringify(recording()) };
    const res = await app.request("/api/recordings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(broken) });
    expect(res.status).toBe(400);
  });

  it("carries a walk with no video as zero bytes", async () => {
    const body = startBody({ ...input(), video: null });
    expect(body.bytes).toBe(0);
    const res = await app.request("/api/recordings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    expect(res.status).toBe(200);
  });
});