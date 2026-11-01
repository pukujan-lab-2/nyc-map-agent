import { MockLanguageModelV4, convertArrayToReadableStream } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import { streamEvent, type StreamEvent } from "../../../src/features/agent/schema";
import { createDailyBudget, createLimiter } from "./fair-use";
import { tidyHours } from "./hours";
import { POST } from "./routes";
import { isNewRequest, MAX_TOOL_STEPS, restroomAllowed, Scrub } from "./turn";

const m = (...c: string[]) => c.map((content, i) => ({ role: i % 2 ? "assistant" : "user", content }));
const after = (last: string) => m("Where's the nearest restroom?", "Union Square Park, 2 min on foot. Want to start?", last);

describe("each turn is read from its own latest message (#641)", () => {
  it("a destination is a new request, even when it is four words; a yes is not", () => {
    expect(isNewRequest(after("get to times square"))).toBe(true);
    expect(isNewRequest(after("Let me go to Brooklyn Bridge."))).toBe(true);
    expect(isNewRequest(after("我明天要去皇后区"))).toBe(true);
    expect(isNewRequest(after("yes"))).toBe(false);
    expect(isNewRequest(after("yes please"))).toBe(false);
    expect(isNewRequest(after("sí, vamos"))).toBe(false);
    expect(isNewRequest(after("好的"))).toBe(false);
    expect(isNewRequest(after("네"))).toBe(false);
    expect(isNewRequest(m("hello"))).toBe(true);
  });

  it("the restroom tool is for a restroom ask or a yes to one, never for a new destination", () => {
    expect(restroomAllowed(after("get to times square"))).toBe(false);
    expect(restroomAllowed(after("yes please"))).toBe(true);
    for (const ask of ["nearest bathroom?", "¿dónde hay un baño?", "Où sont les toilettes ?", "ближайший туалет", "最近的厕所", "가까운 화장실"]) expect(restroomAllowed(after(ask))).toBe(true);
  });
});

describe("Scrub: nothing internal is spoken to the rider", () => {
  const run = (...deltas: string[]) => { const s = new Scrub(); return deltas.map((d) => s.push(d)).join("") + s.rest(); };
  it("drops a sentence that names a tool, a field or a trip id, and keeps the rest", () => {
    expect(run("Take the 4 train. Tap the walkToNearest button for trip 234443bb-1a2b-4c3d-8e9f-0123456789ab. Want to start?")).toBe("Take the 4 train. Want to start?");
    expect(run("I called transit_plan for you. It takes 12 minutes.")).toBe("It takes 12 minutes.");
  });
  it("works across streamed pieces and Chinese punctuation", () => {
    expect(run("Take the", " 4 train. Use show", "Route now. Then walk", " 2 min.")).toBe("Take the 4 train. Then walk 2 min.");
    expect(run("坐4号线。", "调用 transit_plan。", "然后步行2分钟。")).toBe("坐4号线。然后步行2分钟。");
  });
  it("drops the model thinking aloud in its opening sentence, not a later one", () => {
    expect(run("Let me find the nearest restroom first — but you asked about a landmark. Take the E train.")).toBe("Take the E train.");
    expect(run("Take the E train. Let me know if you want the return trip.")).toBe("Take the E train. Let me know if you want the return trip.");
    expect(run("Reasoning here.</think>Take the E train.")).toBe("Take the E train.");
  });
  it("counts what it dropped", () => {
    const s = new Scrub(); s.push("Use openPanel. Fine. "); s.rest();
    expect(s.dropped).toBe(1);
  });
});

describe("hours said aloud", () => {
  it("keeps the times and drops the city list's notes", () => {
    expect(tidyHours("8am-4pm, Open later seasonally")).toBe("8am-4pm");
    expect(tidyHours("7am - dusk")).toBe("7am - dusk");
    expect(tidyHours("Open later seasonally")).toBe("");
  });
});

/* ---------- Through the chat route ---------- */
const usage = { inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 20, text: 20, reasoning: 0 } };
const finish = (reason: "tool-calls" | "stop") => ({ type: "finish", finishReason: { unified: reason, raw: reason }, usage }) as const;
const toolCall = (name: string, input: unknown, id = "c1") => [{ type: "tool-call", toolCallId: id, toolName: name, input: JSON.stringify(input) }, finish("tool-calls")];
const say = (text: string) => [{ type: "text-start", id: "t" }, { type: "text-delta", id: "t", delta: text }, { type: "text-end", id: "t" }, finish("stop")];

function scripted(steps: Array<unknown[]>) {
  let i = 0;
  return new MockLanguageModelV4({ doStream: () => Promise.resolve({ stream: convertArrayToReadableStream((steps[Math.min(i++, steps.length - 1)]) as never[]) }) });
}

async function chat(messages: Array<{ role: string; content: string }>, model: MockLanguageModelV4) {
  const fairUse = { limiter: createLimiter({ windowMax: 100, windowMs: 60_000, burstMax: 100, burstMs: 60_000 }), budget: createDailyBudget({ softCap: 0, hardCap: 0, capModel: null }), now: Date.now };
  const deps = { otp: { plan: () => Promise.resolve([]) }, planner: { plan: () => Promise.resolve(null) }, changes: [], entrances: { stations: () => Promise.resolve([]) }, restrooms: () => Promise.resolve([]) };
  const res = await POST(new Request("http://x/api/agent", { method: "POST", body: JSON.stringify({ messages, location: { lon: -73.99, lat: 40.735 } }) }), { model, deps: deps as never, fairUse });
  const events = (await res.text()).trim().split("\n").map((l): StreamEvent => streamEvent.parse(JSON.parse(l)));
  return { events, text: events.filter((e) => e.type === "text").map((e) => (e as { text: string }).text).join("") };
}
const toolNames = (model: MockLanguageModelV4, call = 0) => (model.doStreamCalls[call]?.tools ?? []).map((t) => t.name);

describe("POST /api/agent after a restroom answer", () => {
  it("'get to times square' cannot reach the restroom tool, and plans a trip that draws itself", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const model = scripted([toolCall("transit_plan", { to: "Times Square", depart: "now", timing: "now", language: "en" }), say("Walk to Times Square, about 30 min.")]);
    const { events, text } = await chat(after("get to times square"), model);
    expect(toolNames(model)).not.toContain("nearest_restroom");
    expect(toolNames(model)).toContain("transit_plan");
    // The facts tell the model the earlier topic does not carry over.
    expect(JSON.stringify(model.doStreamCalls[0]?.prompt)).toContain("The latest message is a new request");
    // transit_plan drew the route and opened the panel itself: no extra model calls for showRoute and openPanel.
    const commands = events.filter((e) => e.type === "command").map((e) => (e as { command: { type: string } }).command.type);
    expect(commands).toEqual(["showRoute", "openPanel"]);
    expect(model.doStreamCalls).toHaveLength(2);
    expect(text).toBe("Walk to Times Square, about 30 min. Want the return trip?");
    vi.restoreAllMocks();
  });

  it("'yes please' after a restroom answer may still use the restroom tool", async () => {
    const model = scripted([say("Here you go.")]);
    await chat(after("yes please"), model);
    expect(toolNames(model)).toContain("nearest_restroom");
    expect(JSON.stringify(model.doStreamCalls[0]?.prompt)).not.toContain("The latest message is a new request");
  });
});

describe("POST /api/agent keeps internals and thinking out of the reply", () => {
  it("drops tool names, trip ids and thinking aloud from the streamed text", async () => {
    const model = scripted([say("Let me find the restroom first. Take the E train. Tap the walkToNearest button for trip 234443bb-1a2b-4c3d-8e9f-0123456789ab. It takes 12 min.")]);
    const { text } = await chat([{ role: "user", content: "Let me go to Brooklyn Bridge." }], model);
    expect(text).toBe("Take the E train. It takes 12 min.");
  });
});

describe("POST /api/agent stops calling tools after a few steps", () => {
  it("writes its answer on the last step instead of ending with nothing said", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const calls = Array.from({ length: MAX_TOOL_STEPS }, (_, i) => toolCall("line_status", { lines: ["N"], when: "now" }, `c${i}`));
    const model = scripted([...calls, say("The N has delays.")]);
    const { text } = await chat([{ role: "user", content: "is the N ok" }], model);
    expect(model.doStreamCalls).toHaveLength(MAX_TOOL_STEPS + 1);
    expect(model.doStreamCalls[MAX_TOOL_STEPS]?.toolChoice).toEqual({ type: "none" });
    expect(text).toBe("The N has delays.");
    vi.restoreAllMocks();
  });
});
