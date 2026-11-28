import { describe, expect, it } from "vitest";
import { ARRIVE_M, hasArrived } from "./arrival";
import { answerLine, nearbyOptions } from "./data";

describe("hasArrived", () => {
  it("arrives within a few metres, allowing for the fix's own error up to 30 m", () => {
    expect(hasArrived(ARRIVE_M, null)).toBe(true);
    expect(hasArrived(60, 10)).toBe(false);
    expect(hasArrived(60, 30)).toBe(true);
    // A very rough fix does not count as being there.
    expect(hasArrived(120, 500)).toBe(false);
  });
});

describe("answerLine", () => {
  const now = new Date("2026-11-28T18:00:00Z");
  it("free, confirmed N days ago", () => {
    expect(answerLine({ confirmedAt: "2026-11-26T12:00:00Z", free: true, recentNo: 0, warn: false, problem: null }, now)).toEqual({ text: "Free, confirmed 2 days ago", warn: false });
    expect(answerLine({ confirmedAt: "2026-11-28T12:00:00Z", free: null, recentNo: 0, warn: false, problem: null }, now)?.text).toBe("Confirmed today");
  });
  it("several recent No answers warn", () => {
    expect(answerLine({ confirmedAt: null, free: null, recentNo: 3, warn: true, problem: "closed" }, now)).toEqual({ text: "3 people couldn't use it lately", warn: true });
    expect(answerLine({ confirmedAt: null, free: null, recentNo: 1, warn: false, problem: "closed" }, now)).toBeNull();
    expect(answerLine(undefined, now)).toBeNull();
  });
});

describe("nearbyOptions", () => {
  const here = { lon: -74.009, lat: 40.7095 };
  const f = (id: string, lon: number, lat: number, props: Record<string, unknown> = {}): GeoJSON.Feature => ({ type: "Feature", id, geometry: { type: "Point", coordinates: [lon, lat] }, properties: { id, name: id, ...props } });
  it("mixes public and business restrooms near the rider, nearest first, and leaves far ones out", () => {
    const list = nearbyOptions(
      [f("nyc:Park", -74.0085, 40.7101), f("nyc:Bronx", -73.9, 40.85)],
      [f("osm:node/1", -74.0091, 40.7097, { kind: "cafe", brandWikidata: "Q37158", open: { status: "open", until: null, opensAt: null, reason: null } })],
      here,
      new Date(),
    );
    expect(list.map((o) => [o.id, o.business, o.kind])).toEqual([["osm:node/1", true, "cafe"], ["nyc:Park", false, "public"]]);
    expect(list[0]).toMatchObject({ brandWikidata: "Q37158", open: { status: "open" } });
    expect(list[1].open.status).toBe("unknown");
  });
});
