import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { BasicTracerProvider } from "@opentelemetry/sdk-trace-base";
import { post, status, voiceToken } from "./routes";
import { exportTrace, type SpanSpec } from "../../lib/tracing";

// Same technique as runLog.test.ts: capture the spans the route exports. mask and
// sessionFrom stay real so the assertions see the privacy behaviour visitors get.
vi.mock("../../lib/tracing", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/tracing")>()),
  exportTrace: vi.fn(),
}));
// For the no-op checks below: watch whether the real tracing module builds an exporter.
vi.mock("@opentelemetry/exporter-trace-otlp-proto", () => ({ OTLPTraceExporter: vi.fn() }));
vi.mock("@opentelemetry/sdk-trace-base", () => ({ BasicTracerProvider: vi.fn(), BatchSpanProcessor: vi.fn() }));

const env = {
  NYC_PRESENTER_HAIKU_KEY: "secret-haiku",
  NYC_PRESENTER_OCTO_KEY: "secret-octo",
  NYC_PRESENTER_OCTO_WORKSPACE_ID: "workspace",
};
const req = (body: unknown, ip = "192.0.2.2", session?: string) => new Request("https://test/api/presenter/ask", {
  method: "POST",
  headers: { "x-forwarded-for": ip, ...(session ? { "x-session-id": session } : {}) },
  body: JSON.stringify(body),
});
const lastRoot = () => vi.mocked(exportTrace).mock.calls.at(-1)![0];
const childOf = (root: SpanSpec, name: string) => root.children!.find((s) => s.name === name)!;

const savedEnv: Record<string, string | undefined> = {};
beforeEach(() => {
  vi.mocked(exportTrace).mockClear();
  vi.mocked(OTLPTraceExporter).mockClear();
  vi.mocked(BasicTracerProvider).mockClear();
  for (const key of ["OCTO_API_KEY", "OCTO_WORKSPACE_ID", "OCTO_TRACES"]) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});
afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("presentation assistant", () => {
  it("reports configuration without returning credentials", async () => {
    const value: unknown = await status(env).json();
    expect(value).toEqual({ haiku: true, octo: true, dictate: false, liveVoice: false });
    expect(JSON.stringify(value)).not.toContain("secret");
  });

  it("keeps the live-call token endpoint off until the LiveKit key and secret are set", async () => {
    const off: unknown = await voiceToken(env).json();
    expect(off).toEqual({ error: "unavailable" });
    const body: unknown = await voiceToken({ ...env, NYC_PRESENTER_LIVEKIT_KEY: "lk-key", NYC_PRESENTER_LIVEKIT_SECRET: "lk-secret" }).json();
    const on = body as { url: string; token: string; room: string };
    expect(on.url).toBe("wss://copilot.design-bakery.com");
    expect(on.room).toMatch(/^nma-present-/);
    expect(on.token.split(".")).toHaveLength(3);
    expect(JSON.stringify(on)).not.toContain("lk-secret");
  });

  it("retrieves only allowlisted sources and returns attribution without excerpts", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation((url, init) => {
      if ((typeof url === "string" ? url : url instanceof URL ? url.href : url.url).includes("/rag/query")) {
        const payload = JSON.parse(init?.body as string) as { filter: { documentIds: string[] } };
        expect(payload.filter.documentIds).toHaveLength(1);
        return Promise.resolve(Response.json({ matches: [
          { documentId: payload.filter.documentIds[0], content: "private source text", page: 2 },
          { documentId: "other-document", content: "never use this" },
        ] }));
      }
      return Promise.resolve(Response.json({ content: [{ type: "tool_use", name: "present_answer", input: {
        chapter: 4, answer: "A mapped landmark can help.", sourceIds: ["0726fe20-8416-480b-9adc-5a8c7a2bf836", "other-document"],
      } }] }));
    });
    const response = await post("ask", req({ question: "What can the sign tell us?", scene: 4 }), env, fetcher);
    const value = await response.json() as { sources: unknown };
    expect(response.status).toBe(200);
    expect(value.sources).toEqual([{ title: "Underground positioning Q&A", page: 2 }]);
    expect(JSON.stringify(value)).not.toContain("private source text");
    expect(JSON.stringify(value)).not.toContain("other-document");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("rejects oversized requests and unsupported weather locations", async () => {
    expect((await post("chat", req({ question: "x".repeat(7000) }), env)).status).toBe(413);
    const response = await post("weather", req({ place: "London" }), env);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "unsupported_place" });
  });

  it("uses the vault relay for a scoped working lease", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation((url, init) => {
      expect(url).toBe("https://octodb.design-bakery.com/api/vault/proxy");
      expect(new Headers(init?.headers).get("x-octo-target")).toBe("https://api.anthropic.com/v1/messages");
      return Promise.resolve(Response.json({ content: [{ type: "text", text: "Hello!" }] }));
    });
    const response = await post("chat", req({ question: "hello", history: [] }), { NYC_PRESENTER_HAIKU_KEY: "octo_tmp_test" }, fetcher);
    expect(await response.json()).toEqual({ answer: "Hello!" });
    const root = lastRoot();
    expect(root.name).toBe("presenter.chat");
    expect(root.attributes).toMatchObject({ kind: "chat", outcome: "answered", "input.value": "hello", "output.value": "Hello!" });
    expect(childOf(root, "haiku.call").attributes).toMatchObject({ relay: "vault", status: "ok", "llm.model_name": "claude-haiku-5-5" });
    expect(JSON.stringify(root)).not.toContain("octo_tmp_test");
  });

  it("bounds simultaneous model calls and releases the capacity", async () => {
    let finish!: () => void;
    const hold = new Promise<void>((resolve) => { finish = resolve; });
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => {
      await hold;
      return Response.json({ content: [{ type: "text", text: "Hello" }] });
    });
    const pending = Array.from({ length: 4 }, (_, i) => post("chat", new Request("https://test/api", {
      method: "POST", headers: { "x-forwarded-for": `198.51.100.${i + 1}` },
      body: JSON.stringify({ question: "hello", history: [] }),
    }), env, fetcher));
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(4));
    const fifth = await post("chat", new Request("https://test/api", {
      method: "POST", headers: { "x-forwarded-for": "198.51.100.10" }, body: JSON.stringify({ question: "hello" }),
    }), env, fetcher);
    expect(fifth.status).toBe(503);
    expect(lastRoot().attributes).toMatchObject({ kind: "chat", outcome: "busy" });
    finish();
    expect((await Promise.all(pending)).every((response) => response.status === 200)).toBe(true);
  });

  it("does not send Octo credentials to another hostname", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ content: [{ type: "tool_use", name: "present_answer", input: { chapter: 1, answer: "Hello", sourceIds: [] } }] }));
    const response = await post("ask", req({ question: "hello" }), { ...env, NYC_PRESENTER_OCTO_URL: "https://other.example/api/rag/query" }, fetcher);
    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe("https://api.anthropic.com/v1/messages");
    expect(childOf(lastRoot(), "octo.retrieve").attributes).toMatchObject({ status: "blocked", match_count: 0 });
  });
});

describe("presentation assistant traces", () => {
  it("traces an ask turn with retrieval and model children, masked text and no secrets", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation((url) => {
      if ((typeof url === "string" ? url : url instanceof URL ? url.href : url.url).includes("/rag/query")) {
        return Promise.resolve(Response.json({ matches: [
          { documentId: "0726fe20-8416-480b-9adc-5a8c7a2bf836", content: "private source text", page: 2 },
        ] }));
      }
      return Promise.resolve(Response.json({ content: [{ type: "tool_use", name: "present_answer", input: {
        chapter: 4, answer: "Write to a.b@x.co for the sign.", sourceIds: ["0726fe20-8416-480b-9adc-5a8c7a2bf836"],
      } }] }));
    });
    const response = await post("ask", req({ question: "Email a.b@x.co, ssn 123-45-6789: what can the sign tell us?", scene: 4 }, "192.0.2.95", "present-demo-1"), env, fetcher);
    expect(response.status).toBe(200);
    const root = lastRoot();
    expect(root.name).toBe("presenter.ask");
    expect(root.kind).toBe("CHAIN");
    expect(root.error).toBe(false);
    expect(root.end).toBeGreaterThanOrEqual(root.start);
    expect(root.attributes).toMatchObject({ kind: "ask", scene: 4, outcome: "answered" });
    expect(typeof root.attributes!.latency_ms).toBe("number");
    expect(root.attributes!["input.value"]).toBe("Email [email], ssn [ssn]: what can the sign tell us?");
    expect(root.attributes!["output.value"]).toBe("Write to [email] for the sign.");
    const retrieve = childOf(root, "octo.retrieve");
    expect(retrieve.kind).toBe("RETRIEVER");
    expect(retrieve.attributes).toMatchObject({ status: "ok", match_count: 1, document_ids: "0726fe20-8416-480b-9adc-5a8c7a2bf836" });
    const call = childOf(root, "haiku.call");
    expect(call.kind).toBe("LLM");
    expect(call.attributes).toMatchObject({ "llm.model_name": "claude-haiku-5-5", relay: "direct", status: "ok", chapter: 4, source_ids: "0726fe20-8416-480b-9adc-5a8c7a2bf836" });
    expect(typeof call.attributes!.latency_ms).toBe("number");
    expect(vi.mocked(exportTrace).mock.calls.at(-1)![1]).toBe("present-demo-1");
    const serialized = JSON.stringify(root);
    expect(serialized).not.toContain("secret-haiku");
    expect(serialized).not.toContain("secret-octo");
    expect(serialized).not.toContain("private source text");
    expect(serialized).not.toContain("123-45-6789");
    expect(serialized).not.toContain("a.b@x.co");
  });

  it("traces the weather upstream call and its source", async () => {
    const getWeather = vi.fn<(request: Request) => Promise<Response>>().mockResolvedValue(Response.json({ kind: "clear", tempC: 20, source: "open-meteo" }));
    const response = await post("weather", req({ place: "Union Square" }, "192.0.2.97"), env, fetch, getWeather);
    expect(response.status).toBe(200);
    const root = lastRoot();
    expect(root.name).toBe("presenter.weather");
    expect(root.attributes).toMatchObject({ kind: "weather", outcome: "answered", "input.value": "Union Square" });
    expect(childOf(root, "weather.upstream").attributes).toMatchObject({ place: "Union Square", status: "ok", source: "Open-Meteo" });
  });

  it("marks a turn the guide must answer from its prepared script", async () => {
    const response = await post("ask", req({ question: "hello" }, "192.0.2.96"), {});
    expect(response.status).toBe(503);
    const root = lastRoot();
    expect(root.attributes).toMatchObject({ outcome: "prepared-fallback" });
    expect(root.error).toBe(true);
    expect(childOf(root, "octo.retrieve").attributes).toMatchObject({ status: "disabled", match_count: 0 });
    expect(childOf(root, "haiku.call").attributes).toMatchObject({ status: "no_key" });
    expect(childOf(root, "haiku.call").error).toBe(true);
  });

  it("marks an invalid request as an error", async () => {
    const response = await post("ask", req({ question: "" }, "192.0.2.98"), env);
    expect(response.status).toBe(400);
    expect(lastRoot().attributes).toMatchObject({ outcome: "error" });
    expect(lastRoot().error).toBe(true);
  });

  it("traces a rate-limited turn without reading the body", async () => {
    let last!: Response;
    for (let i = 0; i < 9; i += 1) last = await post("chat", req({ question: "hello" }, "192.0.2.99"), {});
    expect(last.status).toBe(429);
    const root = lastRoot();
    expect(root.name).toBe("presenter.chat");
    expect(root.attributes).toMatchObject({ outcome: "rate_limited" });
    expect(root.children).toEqual([]);
    const before = vi.mocked(exportTrace).mock.calls.at(-2)![0];
    expect(before.attributes).toMatchObject({ outcome: "prepared-fallback" });
  });
});

describe("tracing stays a no-op when it is off", () => {
  const freshTracing = async () => {
    vi.resetModules();
    return vi.importActual<typeof import("../../lib/tracing")>("../../lib/tracing");
  };
  const spec: SpanSpec = { name: "presenter.ask", kind: "CHAIN", start: 1, end: 2 };

  it("builds the exporter when a key and workspace are set", async () => {
    process.env.OCTO_API_KEY = "trace-key";
    process.env.OCTO_WORKSPACE_ID = "trace-workspace";
    vi.mocked(BasicTracerProvider).mockImplementation(function () { return { getTracer: () => ({ startSpan: () => ({ setStatus: () => undefined, end: () => undefined }) }) }; } as never);
    const tracing = await freshTracing();
    tracing.exportTrace(spec);
    expect(OTLPTraceExporter).toHaveBeenCalledTimes(1);
    expect(BasicTracerProvider).toHaveBeenCalledTimes(1);
  });

  it("exports nothing when OCTO_TRACES=off even with keys", async () => {
    process.env.OCTO_API_KEY = "trace-key";
    process.env.OCTO_WORKSPACE_ID = "trace-workspace";
    process.env.OCTO_TRACES = "off";
    const tracing = await freshTracing();
    expect(() => tracing.exportTrace(spec)).not.toThrow();
    expect(OTLPTraceExporter).not.toHaveBeenCalled();
    expect(BasicTracerProvider).not.toHaveBeenCalled();
  });

  it("exports nothing without a key", async () => {
    process.env.OCTO_WORKSPACE_ID = "trace-workspace";
    const tracing = await freshTracing();
    expect(() => tracing.exportTrace(spec)).not.toThrow();
    expect(OTLPTraceExporter).not.toHaveBeenCalled();
    expect(BasicTracerProvider).not.toHaveBeenCalled();
  });
});