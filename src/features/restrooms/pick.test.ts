import { describe, expect, it } from "vitest";
import { accessLine, listOrder, pickable, pickRestroom, type RestroomOption } from "./pick";
import { clockLabel, hoursLabel, stateAt, type OpenState } from "@/lib/openHours";

const OPEN: OpenState = { status: "open", until: null, opensAt: null, reason: null };
const CLOSED: OpenState = { status: "closed", until: null, opensAt: "2026-11-29T13:00:00Z", reason: null };
const UNKNOWN: OpenState = { status: "unknown", until: null, opensAt: null, reason: "missing" };
const r = (id: string, minutes: number, over: Partial<RestroomOption> = {}): RestroomOption => ({
  id, name: id, business: false, kind: "public", brandWikidata: null, lon: 0, lat: 0, open: OPEN, hours: null, fee: null, address: null, phone: null, website: null, minutes, ...over,
});

describe("pickRestroom", () => {
  it("picks the closest open restroom, public or business", () => {
    expect(pickRestroom([r("park", 4), r("cafe", 2, { business: true, kind: "cafe" })]).closest?.id).toBe("cafe");
    expect(pickRestroom([r("park", 4), r("cafe", 6, { business: true, kind: "cafe" })]).closest?.id).toBe("park");
  });
  it("skips closed and unknown restrooms", () => {
    const p = pickRestroom([r("shut", 1, { open: CLOSED }), r("maybe", 2, { open: UNKNOWN }), r("park", 9)]);
    expect(p.closest?.id).toBe("park");
    expect(pickRestroom([r("shut", 1, { open: CLOSED })]).closest).toBeNull();
  });
  it("offers a free public restroom beside a business only when it is open and at most 5 minutes further", () => {
    const cafe = r("cafe", 2, { business: true, kind: "cafe" });
    expect(pickRestroom([cafe, r("park", 7)]).free?.id).toBe("park");
    expect(pickRestroom([cafe, r("park", 8)]).free).toBeNull();
    expect(pickRestroom([cafe, r("park", 4, { open: CLOSED })]).free).toBeNull();
    expect(pickRestroom([cafe, r("park", 4, { open: UNKNOWN })]).free).toBeNull();
    expect(pickRestroom([cafe, r("paid", 3, { fee: true }), r("park", 6)]).free?.id).toBe("park");
    expect(pickRestroom([cafe, r("deli", 3, { business: true, kind: "food" })]).free).toBeNull();
  });
  it("offers no free option when the closest is already public", () => {
    expect(pickRestroom([r("park", 2), r("other", 3)]).free).toBeNull();
  });
});

describe("listOrder", () => {
  it("lists open ones first, then unknown, then closed (not pickable), each nearest first", () => {
    const list = listOrder([r("shut", 1, { open: CLOSED }), r("far", 9), r("maybe", 2, { open: UNKNOWN }), r("near", 3)]);
    expect(list.map((o) => o.id)).toEqual(["near", "far", "maybe", "shut"]);
    expect(list.map(pickable)).toEqual([true, true, true, false]);
  });
});

describe("labels", () => {
  const now = new Date("2026-11-28T18:00:00Z"); // 1 PM in New York
  it("says when it closes or opens, in New York time", () => {
    expect(hoursLabel({ ...OPEN, until: "2026-11-29T00:00:00Z" }, now)).toBe("Open until 7 PM");
    expect(hoursLabel({ ...OPEN, until: "2026-11-28T23:30:00Z" }, now)).toBe("Open until 6:30 PM");
    expect(hoursLabel(OPEN, now)).toBe("Open 24 hours");
    expect(hoursLabel(CLOSED, now)).toBe("Closed · opens Sun 8 AM");
    expect(hoursLabel(UNKNOWN, now)).toBe("Hours may have changed");
    expect(clockLabel("2026-11-28T13:00:00Z", now)).toBe("8 AM");
  });
  it("a cached open state past its closing time reads as closed", () => {
    expect(stateAt({ ...OPEN, until: "2026-11-28T17:00:00Z" }, now).status).toBe("closed");
    expect(stateAt({ ...CLOSED, opensAt: "2026-11-28T17:00:00Z" }, now).status).toBe("unknown");
    expect(stateAt(null, now).status).toBe("unknown");
  });
  it("business rows say customers only; public ones say free", () => {
    expect(accessLine(r("cafe", 1, { business: true }))).toBe("May be customers only");
    expect(accessLine(r("park", 1))).toBe("Public · free");
    expect(accessLine(r("paid", 1, { fee: true }))).toBe("Public · fee");
  });
});
