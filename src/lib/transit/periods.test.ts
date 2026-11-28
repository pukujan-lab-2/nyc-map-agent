import { describe, expect, it } from "vitest";
import { PERIODS, inEffect, occurrence, periodAt, periodFor, type PeriodKey, type Span } from "./periods";
import { dayWindow, nyEpoch, weekendWindow } from "./weekend";

const at = (iso: string) => Date.parse(iso);
const s = (iso: string) => Date.parse(iso) / 1000;
/** A stretch as New York wall clock, "Sat Nov 28 06 → Sat Nov 28 21". */
const ny = (t: number) => new Date(t * 1000).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "2-digit", hourCycle: "h23" }).replace(/,/g, "");
const wall = (spans: Span[]) => spans.map(([a, b]) => `${ny(a)} → ${ny(b)}`);

describe("which button the New York time picks", () => {
  const cases: Array<[string, PeriodKey]> = [
    ["2026-11-25T05:59:00-05:00", "night"], // Wednesday before dawn: Tuesday's night
    ["2026-11-25T06:00:00-05:00", "day"],
    ["2026-11-25T20:59:00-05:00", "day"],
    ["2026-11-25T21:00:00-05:00", "night"],
    ["2026-11-27T05:00:00-05:00", "night"], // Friday 5 AM: Thursday's night is still a weeknight
    ["2026-11-27T12:00:00-05:00", "day"], // Friday daytime is a weekday
    ["2026-11-27T21:00:00-05:00", "weekendNight"], // Friday 9 PM starts the weekend
    ["2026-11-28T03:00:00-05:00", "weekendNight"],
    ["2026-11-28T06:00:00-05:00", "weekendDay"],
    ["2026-11-29T23:00:00-05:00", "weekendNight"], // Sunday night
    ["2026-11-30T05:59:00-05:00", "weekendNight"], // Monday before 6 AM is still Sunday's night
    ["2026-11-30T06:00:00-05:00", "day"],
    ["2026-11-30T21:00:00-05:00", "night"], // Monday night is a weeknight
  ];
  for (const [iso, key] of cases) it(`${iso} is ${key}`, () => expect(periodAt(at(iso))).toBe(key));

  it("reads New York time, not the phone's: 3 AM UTC on a Friday is Thursday night in New York", () => {
    expect(periodAt(at("2026-11-27T03:00:00Z"))).toBe("night");
  });
});

describe("each button's next occurrence", () => {
  // Thursday Nov 26, 10:10 PM: the clock the approved preview plays.
  const thu = at("2026-11-26T22:10:00-05:00");
  it("Night under way runs from this hour to Friday 6 AM", () => {
    const o = occurrence("night", thu);
    expect(wall(o.spans)).toEqual(["Thu Nov 26 22 → Fri Nov 27 06"]);
    expect(o.label).toBe("Now, until Fri 6 AM");
  });
  it("Day is Friday", () => {
    const o = occurrence("day", thu);
    expect(wall(o.spans)).toEqual(["Fri Nov 27 06 → Fri Nov 27 21"]);
    expect(o.label).toBe("Fri Nov 27, 6 AM to 9 PM");
  });
  it("Weekend day is Saturday and Sunday daytime, and asks for the whole stretch between", () => {
    const o = occurrence("weekendDay", thu);
    expect(wall(o.spans)).toEqual(["Sat Nov 28 06 → Sat Nov 28 21", "Sun Nov 29 06 → Sun Nov 29 21"]);
    expect([ny(o.from), ny(o.to)]).toEqual(["Sat Nov 28 06", "Sun Nov 29 21"]);
    expect(o.label).toBe("Sat Nov 28 and Sun Nov 29, 6 AM to 9 PM");
  });
  it("Weekend night is Friday, Saturday and Sunday nights", () => {
    const o = occurrence("weekendNight", thu);
    expect(wall(o.spans)).toEqual(["Fri Nov 27 21 → Sat Nov 28 06", "Sat Nov 28 21 → Sun Nov 29 06", "Sun Nov 29 21 → Mon Nov 30 06"]);
    expect(o.label).toBe("Fri Nov 27 to Sun Nov 29 nights, 9 PM to 6 AM");
  });

  it("on a Friday daytime, Night skips the weekend to Monday", () => {
    expect(wall(occurrence("night", at("2026-11-27T12:00:00-05:00")).spans)).toEqual(["Mon Nov 30 21 → Tue Dec 1 06"]);
  });
  it("on a Saturday afternoon, Weekend night is the nights left and Weekend day is under way", () => {
    const sat = at("2026-11-28T15:00:00-05:00");
    expect(wall(occurrence("weekendNight", sat).spans)).toEqual(["Sat Nov 28 21 → Sun Nov 29 06", "Sun Nov 29 21 → Mon Nov 30 06"]);
    expect(occurrence("weekendNight", sat).label).toBe("Sat Nov 28 and Sun Nov 29 nights, 9 PM to 6 AM");
    expect(occurrence("weekendDay", sat).label).toBe("Now, until 9 PM");
    expect(occurrence("day", sat).label).toBe("Mon Nov 30, 6 AM to 9 PM");
  });
  it("on a Sunday evening, Weekend day is next weekend's", () => {
    const o = occurrence("weekendDay", at("2026-11-29T22:00:00-05:00"));
    expect(o.label).toBe("Sat Dec 5 and Sun Dec 6, 6 AM to 9 PM");
  });
  it("a weeknight at 9 AM names its night and morning", () => {
    expect(occurrence("night", at("2026-12-01T09:00:00-05:00")).label).toBe("Tue Dec 1, 9 PM to Wed 6 AM");
  });
  it("every occurrence fits the server's four-day window and has not ended", () => {
    // Every five hours across a week lands on each weekday's mornings, days and nights.
    for (const [key] of PERIODS) {
      for (let h = 0; h < 7 * 24; h += 5) {
        const now = at("2026-11-23T00:30:00-05:00") + h * 3_600_000;
        const o = occurrence(key, now);
        expect(o.to - o.from).toBeLessThanOrEqual(4 * 86_400);
        expect(o.to * 1000).toBeGreaterThan(now);
      }
    }
  });
});

describe("New York clock changes", () => {
  // Clocks go back at 2 AM on Sunday Nov 1, 2026, and forward at 2 AM on Sunday Mar 14, 2027.
  it("the autumn Saturday night is ten hours long, wall clock 9 PM to 6 AM", () => {
    const [, sat] = occurrence("weekendNight", at("2026-10-29T12:00:00-04:00")).spans;
    expect(ny(sat[0])).toBe("Sat Oct 31 21");
    expect(ny(sat[1])).toBe("Sun Nov 1 06");
    expect(sat[1] - sat[0]).toBe(10 * 3600);
  });
  it("the spring Saturday night is eight hours long, wall clock 9 PM to 6 AM", () => {
    const [, sat] = occurrence("weekendNight", at("2027-03-11T12:00:00-05:00")).spans;
    expect(ny(sat[0])).toBe("Sat Mar 13 21");
    expect(ny(sat[1])).toBe("Sun Mar 14 06");
    expect(sat[1] - sat[0]).toBe(8 * 3600);
  });
  it("6 AM on the spring Sunday is 6 AM daylight time, not 7", () => {
    expect(nyEpoch(2027, 3, 14, 6)).toBe(s("2027-03-14T06:00:00-04:00"));
    expect(nyEpoch(2026, 11, 1, 6)).toBe(s("2026-11-01T06:00:00-05:00"));
  });
  it("an hour the clocks skip comes out as the hour after", () => {
    expect(nyEpoch(2027, 3, 14, 2)).toBe(s("2027-03-14T03:00:00-04:00"));
  });
  it("picks the button by wall clock either side of the change", () => {
    expect(periodAt(at("2026-11-01T05:30:00-05:00"))).toBe("weekendNight");
    expect(periodAt(at("2026-11-01T06:00:00-05:00"))).toBe("weekendDay");
    expect(periodAt(at("2027-03-14T05:30:00-04:00"))).toBe("weekendNight");
    expect(periodAt(at("2027-03-14T06:00:00-04:00"))).toBe("weekendDay");
  });
});

/** The line panel's own use of inEffect: a notice's windows, else its start and end; an outage's from and to. */
const alertInEffect = (a: { windows?: Array<[number, number]>; start?: number; end?: number }, spans: Span[]) => inEffect(a.windows?.length ? a.windows : [[a.start ?? 0, a.end ?? 0]], spans);
const outageInEffect = (o: { from?: number; to?: number }, spans: Span[]) => inEffect([[o.from ?? 0, o.to ?? 0]], spans);

describe("only notices in effect in the period", () => {
  const weekendDay = occurrence("weekendDay", at("2026-11-26T22:10:00-05:00")).spans;
  const weekendNight = occurrence("weekendNight", at("2026-11-26T22:10:00-05:00")).spans;

  it("a notice with windows counts only where a window meets the period's hours", () => {
    // The 74 St-Broadway skip: overnight Saturday only.
    const satNight = { windows: [[s("2026-11-28T22:00:00-05:00"), s("2026-11-29T05:00:00-05:00")]] as Array<[number, number]>, start: s("2026-11-28T06:00:00-05:00"), end: s("2026-11-29T21:00:00-05:00") };
    expect(alertInEffect(satNight, weekendNight)).toBe(true);
    expect(alertInEffect(satNight, weekendDay)).toBe(false); // its windows win over the wide start and end
  });
  it("rush-hour windows are not on Weekend day", () => {
    const rush = { windows: [[s("2026-11-30T06:30:00-05:00"), s("2026-11-30T09:30:00-05:00")], [s("2026-12-01T06:30:00-05:00"), s("2026-12-01T09:30:00-05:00")]] as Array<[number, number]> };
    expect(alertInEffect(rush, weekendDay)).toBe(false);
    expect(alertInEffect(rush, occurrence("day", at("2026-11-29T12:00:00-05:00")).spans)).toBe(true);
  });
  it("a window ending as the period starts does not count", () => {
    expect(alertInEffect({ windows: [[s("2026-11-28T01:00:00-05:00"), s("2026-11-28T06:00:00-05:00")]] }, weekendDay)).toBe(false);
  });
  it("without windows, start and end decide; an open end runs on", () => {
    expect(alertInEffect({ start: s("2026-11-28T08:00:00-05:00"), end: s("2026-11-28T12:00:00-05:00") }, weekendDay)).toBe(true);
    expect(alertInEffect({ start: s("2026-11-28T08:00:00-05:00"), end: s("2026-11-28T12:00:00-05:00") }, weekendNight)).toBe(false);
    expect(alertInEffect({ start: s("2026-11-01T00:00:00-04:00"), end: 0 }, weekendNight)).toBe(true);
    expect(alertInEffect({ start: s("2026-12-01T00:00:00-05:00"), end: 0 }, weekendNight)).toBe(false);
    expect(alertInEffect({}, weekendDay)).toBe(true);
  });
  it("an elevator outage counts from its planned start until it is back", () => {
    const planned = { from: s("2026-11-29T07:00:00-05:00"), to: s("2026-11-29T15:00:00-05:00") };
    expect(outageInEffect(planned, weekendDay)).toBe(true);
    expect(outageInEffect(planned, weekendNight)).toBe(false);
    expect(outageInEffect({ from: s("2026-11-20T07:00:00-05:00"), to: 0 }, weekendNight)).toBe(true);
    expect(outageInEffect({}, weekendNight)).toBe(true);
  });
});

describe("the button an answer opens on", () => {
  it("this weekend opens Weekend day, a weekday opens Day", () => {
    const tue = at("2026-11-24T10:00:00-05:00");
    expect(periodFor(weekendWindow(tue))).toBe("weekendDay");
    expect(periodFor(dayWindow(tue))).toBe("day");
    expect(periodFor(dayWindow(at("2026-11-28T10:00:00-05:00")))).toBe("weekendDay");
  });
});
