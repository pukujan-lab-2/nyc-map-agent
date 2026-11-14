import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { jpegBase64, parseChoice, seePrompt, seeSign } from "./seeSign";

const JPEG = `/9j/${"A".repeat(400)}`;
const SIGNS = [{ id: "us-to-l", sign: "Elevator to L (overhead)" }, { id: "us-yellow", sign: "Exit · 14 St & 4 Av (yellow columns)" }];
const req = (body: unknown) => new Request("http://x/api/agent/see-sign", { method: "POST", body: JSON.stringify(body) });
const model = (reply: string) => () => new MockLanguageModelV4({
  doGenerate: () => Promise.resolve({ content: [{ type: "text", text: reply }], finishReason: { unified: "stop", raw: "stop" }, usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } }, warnings: [] } as never),
});

describe("which sign a photo shows (#88)", () => {
  it("numbers the signs and asks for one number, 0 for none", () => {
    const p = seePrompt(SIGNS);
    expect(p).toContain("1: Elevator to L (overhead)");
    expect(p).toContain("2: Exit · 14 St & 4 Av (yellow columns)");
    expect(p).toMatch(/Answer 0 if/);
  });

  it("takes the first number in the reply, and only one on the list", () => {
    expect(parseChoice("2", 2)).toBe(1);
    expect(parseChoice("Option 1, the 14 Street sign.", 2)).toBe(0);
    expect(parseChoice("0", 2)).toBeNull();
    expect(parseChoice("7", 2)).toBeNull();
    expect(parseChoice("I cannot tell.", 2)).toBeNull();
  });

  it("takes a JPEG as a data URL or bare, and nothing else", () => {
    expect(jpegBase64(`data:image/jpeg;base64,${JPEG}`)).toBe(JPEG);
    expect(jpegBase64(JPEG)).toBe(JPEG);
    expect(jpegBase64(`iVBOR${"A".repeat(400)}`)).toBeNull();
    expect(jpegBase64(`/9j/${"A".repeat(900_000)}`)).toBeNull();
    expect(jpegBase64(42)).toBeNull();
  });

  it("answers the id of the sign the model picks", async () => {
    const res = await seeSign(req({ image: JPEG, signs: SIGNS }), model("2"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "us-yellow" });
  });

  it("answers null when the photo shows none of them", async () => {
    expect(await (await seeSign(req({ image: JPEG, signs: SIGNS }), model("0"))).json()).toEqual({ id: null });
  });

  it("refuses a missing photo, no signs, and an id that is not a plain name", async () => {
    for (const body of [{ signs: SIGNS }, { image: JPEG, signs: [] }, { image: JPEG, signs: [{ id: "a b", sign: "x" }] }, { image: "hello", signs: SIGNS }]) {
      expect((await seeSign(req(body), model("1"))).status).toBe(400);
    }
  });

  it("says so when no model here can look at a photo", async () => {
    expect((await seeSign(req({ image: JPEG, signs: SIGNS }), () => null)).status).toBe(503);
  });
});
