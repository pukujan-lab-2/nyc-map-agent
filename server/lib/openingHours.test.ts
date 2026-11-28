import { afterEach, describe, expect, it } from "vitest";
import { cityHoursToOsm, cityOpenState, fromNyWall, openState, toNyWall } from "./openingHours";

const at = (iso: string) => new Date(iso);
/** Fetched an hour before, so the record is fresh. */
const fresh = (now: Date) => ({ now, fetchedAt: new Date(now.getTime() - 3_600_000) });

describe("openState", () => {
  const tz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = tz;
  });

  it("is open until the close, in New York time", () => {
    // Saturday 28 Nov 2026, 1 PM in New York (18:00 UTC).
    const now = at("2026-11-28T18:00:00Z");
    expect(openState("Mo-Su 08:00-19:00", fresh(now))).toEqual({ status: "open", until: "2026-11-29T00:00:00.000Z", opensAt: null, reason: null });
  });

  it("is closed before opening and says when it opens", () => {
    const now = at("2026-11-28T11:00:00Z"); // 6 AM in New York
    expect(openState("Mo-Su 08:00-19:00", fresh(now))).toMatchObject({ status: "closed", opensAt: "2026-11-28T13:00:00.000Z" });
  });

  it("reads overnight hours across midnight", () => {
    const bar = "Mo-Su 17:00-02:00";
    // 1 AM Sunday in New York: still open from Saturday evening, closes at 2 AM.
    expect(openState(bar, fresh(at("2026-11-29T06:00:00Z")))).toMatchObject({ status: "open", until: "2026-11-29T07:00:00.000Z" });
    // 3 AM: closed until 5 PM.
    expect(openState(bar, fresh(at("2026-11-29T08:00:00Z")))).toMatchObject({ status: "closed", opensAt: "2026-11-29T22:00:00.000Z" });
  });

  it("closes at 2 AM wall time on the night the clocks fall back", () => {
    // Sun 1 Nov 2026: 2 AM EDT becomes 1 AM EST. At 1:30 AM EST (06:30 UTC) the bar is open until 2 AM EST (07:00 UTC).
    expect(openState("Mo-Su 17:00-02:00", fresh(at("2026-11-01T06:30:00Z")))).toMatchObject({ status: "open", until: "2026-11-01T07:00:00.000Z" });
  });

  it("closes when the clocks jump past 2 AM on the spring change", () => {
    // Sun 8 Mar 2026: 2 AM EST jumps to 3 AM EDT (07:00 UTC). At 1:30 AM EST the bar closes at that jump.
    expect(openState("Mo-Su 17:00-02:00", fresh(at("2026-03-08T06:30:00Z")))).toMatchObject({ status: "open", until: "2026-03-08T07:00:00.000Z" });
    // A café opening at 9 AM that day opens at 9 AM daylight time (13:00 UTC).
    expect(openState("Mo-Su 09:00-17:00", fresh(at("2026-03-08T11:00:00Z")))).toMatchObject({ status: "closed", opensAt: "2026-03-08T13:00:00.000Z" });
  });

  it("gives the same answer whatever zone the server runs in", () => {
    const now = at("2026-11-29T06:00:00Z");
    const here = openState("Mo-Su 17:00-02:00", fresh(now));
    process.env.TZ = "Asia/Tokyo";
    expect(openState("Mo-Su 17:00-02:00", fresh(now))).toEqual(here);
    process.env.TZ = "UTC";
    expect(openState("Mo-Su 17:00-02:00", fresh(now))).toEqual(here);
  });

  it("24/7 is open with no closing time", () => {
    expect(openState("24/7", fresh(at("2026-11-28T18:00:00Z")))).toEqual({ status: "open", until: null, opensAt: null, reason: null });
  });

  it("never guesses: missing, unreadable and stale hours are unknown", () => {
    const now = at("2026-11-28T18:00:00Z");
    expect(openState(null, fresh(now))).toMatchObject({ status: "unknown", reason: "missing" });
    expect(openState("  ", fresh(now))).toMatchObject({ status: "unknown", reason: "missing" });
    expect(openState("ask the barista", fresh(now))).toMatchObject({ status: "unknown", reason: "unclear" });
    expect(openState("Mo-Su 08:00-19:00", { now, fetchedAt: "2026-10-28T17:00:00Z" })).toMatchObject({ status: "unknown", reason: "stale" });
    expect(openState("Mo-Su 08:00-19:00", { now, fetchedAt: null })).toMatchObject({ status: "unknown", reason: "stale" });
  });

  it("round-trips New York wall time", () => {
    const now = at("2026-07-04T16:20:00Z");
    expect(fromNyWall(toNyWall(now)).toISOString()).toBe(now.toISOString());
    expect(toNyWall(now).getHours()).toBe(12);
  });
});

describe("cityHoursToOsm", () => {
  it("reads one range for every day", () => {
    expect(cityHoursToOsm("7am-10pm")).toEqual({ value: "Mo-Su 07:00-22:00", mayOpenLater: false });
    expect(cityHoursToOsm("6:00am-8:00pm Daily")).toEqual({ value: "Mo-Su 06:00-20:00", mayOpenLater: false });
    expect(cityHoursToOsm("Everyday 8:00 am-10:00 pm")?.value).toBe("Mo-Su 08:00-22:00");
    expect(cityHoursToOsm("8am-4pm, Open later seasonally")).toEqual({ value: "Mo-Su 08:00-16:00", mayOpenLater: true });
  });

  it("reads one line per day, with Closed days", () => {
    const text = "Sunday: Closed \nMonday: 10:00 am - 6:00 pm \nTuesday: 1:00 pm - 6:00 pm \nSaturday: 10:00 am - 5:00 pm";
    expect(cityHoursToOsm(text)?.value).toBe("Su off; Mo 10:00-18:00; Tu 13:00-18:00; Sa 10:00-17:00");
    expect(cityHoursToOsm("Monday\t10 am - 6 pm\nSunday\tCLOSED")?.value).toBe("Mo 10:00-18:00; Su off");
  });

  it("passes OSM syntax through and reads 24 hours", () => {
    expect(cityHoursToOsm("Mo-Su 08:00-16:00")?.value).toBe("Mo-Su 08:00-16:00");
    expect(cityHoursToOsm("24 Hours")?.value).toBe("24/7");
    expect(cityHoursToOsm("Open 24/7")?.value).toBe("24/7");
  });

  it("leaves what it cannot read as unknown, including a range that ends before it starts", () => {
    expect(cityHoursToOsm("7am - dusk")).toBeNull();
    expect(cityHoursToOsm("March-October: 7am - 11pm, November-March: 7am - 10pm")).toBeNull();
    expect(cityHoursToOsm("Monday: 10:00 am - 6:00 pm\nTuesday: 10:00 pm - 7:00 pm")).toBeNull();
    expect(cityHoursToOsm(null)).toBeNull();
  });
});

describe("cityOpenState", () => {
  const now = at("2026-11-28T18:00:00Z");
  it("a closed status wins over the hours", () => {
    expect(cityOpenState("7am-10pm", "Not Operational", fresh(now)).status).toBe("closed");
    expect(cityOpenState("7am-10pm", "Closed for Construction", fresh(now)).status).toBe("closed");
    expect(cityOpenState("Temp Closed", "Operational", fresh(now)).status).toBe("closed");
  });
  it("open later seasonally is unknown after the listed close, not closed", () => {
    expect(cityOpenState("8am-4pm, Open later seasonally", "Operational", fresh(now)).status).toBe("open");
    expect(cityOpenState("8am-4pm, Open later seasonally", "Operational", fresh(at("2026-11-28T23:00:00Z")))).toMatchObject({ status: "unknown", reason: "unclear" });
    // Before opening it is closed, and says when it opens.
    expect(cityOpenState("8am-4pm, Open later seasonally", "Operational", fresh(at("2026-11-28T11:00:00Z")))).toMatchObject({ status: "closed", opensAt: "2026-11-28T13:00:00.000Z" });
  });
  it("unreadable or old city hours are unknown", () => {
    expect(cityOpenState("7am - dusk", "Operational", fresh(now))).toMatchObject({ status: "unknown", reason: "unclear" });
    expect(cityOpenState(null, null, fresh(now))).toMatchObject({ status: "unknown", reason: "missing" });
    expect(cityOpenState("7am-10pm", "Operational", { now, fetchedAt: "2026-09-01T00:00:00Z" })).toMatchObject({ status: "unknown", reason: "stale" });
  });
});
