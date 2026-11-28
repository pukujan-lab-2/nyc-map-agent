import { beforeEach, describe, expect, it, vi } from "vitest";

const octoQuery = vi.fn();
vi.mock("../../../api/_lib/octo", () => ({ octoQuery: (...a: unknown[]) => octoQuery(...a) }));
const { GET, POST, summarize } = await import("./answers");

const now = new Date("2026-11-28T18:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

describe("summarize", () => {
  it("a recent Yes that paid nothing reads as free, confirmed then", () => {
    expect(summarize([{ available: true, paid: false, problem: null, answeredAt: daysAgo(2) }], now)).toEqual({ confirmedAt: daysAgo(2), free: true, recentNo: 0, warn: false, problem: null });
  });
  it("a skipped pay question leaves free unknown", () => {
    expect(summarize([{ available: true, paid: null, problem: null, answeredAt: daysAgo(1) }], now)?.free).toBeNull();
  });
  it("several No answers since the last Yes warn, with the latest problem", () => {
    const s = summarize(
      [
        { available: true, paid: false, problem: null, answeredAt: daysAgo(9) },
        { available: false, paid: null, problem: "out_of_order", answeredAt: daysAgo(3) },
        { available: false, paid: null, problem: "closed", answeredAt: daysAgo(1) },
      ],
      now,
    );
    expect(s).toMatchObject({ recentNo: 2, warn: true, problem: "closed", confirmedAt: daysAgo(9) });
  });
  it("one No does not warn, and a Yes after the No answers clears them", () => {
    expect(summarize([{ available: false, paid: null, problem: "closed", answeredAt: daysAgo(1) }], now)?.warn).toBe(false);
    const cleared = summarize(
      [
        { available: false, paid: null, problem: "closed", answeredAt: daysAgo(4) },
        { available: false, paid: null, problem: "closed", answeredAt: daysAgo(3) },
        { available: true, paid: false, problem: null, answeredAt: daysAgo(1) },
      ],
      now,
    );
    expect(cleared).toMatchObject({ recentNo: 0, warn: false });
  });
  it("old answers are ignored", () => {
    expect(summarize([{ available: true, paid: false, problem: null, answeredAt: daysAgo(31) }], now)).toBeNull();
    expect(summarize([{ available: false, paid: null, problem: "closed", answeredAt: daysAgo(20) }, { available: false, paid: null, problem: "closed", answeredAt: daysAgo(16) }], now)?.warn).toBe(false);
  });
});

describe("POST /api/restroom-answers", () => {
  beforeEach(() => octoQuery.mockReset().mockResolvedValue({ rows: [] }));
  const post = (body: unknown) => POST(new Request("http://x/api/restroom-answers", { method: "POST", body: JSON.stringify(body) }));

  it("stores the id, the answers and nothing else", async () => {
    const res = await post({ restroomId: "osm:node/42", available: true, paid: false, customersOnly: true, codeNeeded: null });
    expect(res.status).toBe(204);
    const [sql, params] = octoQuery.mock.calls[0];
    expect(sql).toContain("INSERT INTO core.restroom_answers (restroom_id, available, paid, customers_only, code_needed, problem)");
    expect(params).toEqual(["osm:node/42", true, false, true, null, null]);
  });
  it("a No keeps only what happened", async () => {
    await post({ restroomId: "nyc:Bryant Park", available: false, paid: true, problem: "closed" });
    expect(octoQuery.mock.calls[0][1]).toEqual(["nyc:Bryant Park", false, null, null, null, "closed"]);
  });
  it("refuses an id that is not a restroom and extra kinds of answer", async () => {
    expect((await post({ restroomId: "javascript:alert(1)", available: true })).status).toBe(400);
    expect((await post({ restroomId: "osm:node/1", available: true, problem: "flooded" })).status).toBe(400);
    expect(octoQuery).not.toHaveBeenCalled();
  });
});

describe("GET /api/restroom-answers", () => {
  beforeEach(() => octoQuery.mockReset());
  it("summarises per restroom and leaves out ids with no answers", async () => {
    octoQuery.mockResolvedValue({ rows: [{ restroom_id: "osm:node/1", available: "t", paid: "f", problem: null, answered_at: new Date(Date.now() - 86_400_000) }] });
    const res = await GET(new Request("http://x/api/restroom-answers?ids=osm:node/1,osm:node/2"));
    const body = (await res.json()) as { answers: Record<string, { free: boolean }> };
    expect(Object.keys(body.answers)).toEqual(["osm:node/1"]);
    expect(body.answers["osm:node/1"].free).toBe(true);
    expect(octoQuery.mock.calls[0][1]).toEqual([JSON.stringify(["osm:node/1", "osm:node/2"])]);
  });
  it("400 without ids", async () => {
    expect((await GET(new Request("http://x/api/restroom-answers"))).status).toBe(400);
  });
});
