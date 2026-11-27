import { describe, expect, it } from "vitest";
import { outageTime, outagesBetween, slimOutages } from "./outages";

const equipment = [
  { equipmentno: "EL131", equipmenttype: "EL", ADA: "Y", isactive: "Y", elevatorsgtfsstopid: "414/D11", alternativeroute: "Take the Bx1." },
  { equipmentno: "EL124", equipmenttype: "EL", ADA: "Y", isactive: "Y", elevatorsgtfsstopid: "A06", alternativeroute: "" },
];
// Rows shaped like the MTA's nyct_ene.json and nyct_ene_upcoming.json on 2026-11-27.
const now = [{ station: "161 St-Yankee Stadium", trainno: "B/D/4", equipment: "EL131", equipmenttype: "EL", serving: "161 St & River Ave (NE corner) to mezzanine", reason: "Under Investigation", outagedate: "11/26/2026 05:07:00 PM", estimatedreturntoservice: "11/27/2026 01:00:00 AM", isupcomingoutage: "N" }];
const upcoming = [{ station: "175 St", trainno: "A", equipment: "EL124", equipmenttype: "EL", serving: "Mezzanine to platform", reason: "Planned Work", outagedate: "12/16/2026 10:00:00 PM", estimatedreturntoservice: "12/17/2026 06:00:00 AM", isupcomingoutage: "Y" }];

describe("elevator outages with their windows", () => {
  it("reads the MTA's New York times as epoch seconds", () => {
    expect(outageTime("11/26/2026 05:07:00 PM")).toBe(Date.UTC(2026, 10, 26, 22, 7) / 1000);
    expect(outageTime("12/17/2026 12:30:00 AM")).toBe(Date.UTC(2026, 11, 17, 5, 30) / 1000);
    expect(outageTime("")).toBe(0);
  });

  it("keeps a right-now answer to the current feed", () => {
    const list = slimOutages(now, equipment);
    expect(list.map((o) => [o.id, o.upcoming])).toEqual([["EL131", false]]);
    expect(list[0]).toMatchObject({ station: "161 St-Yankee Stadium", routes: ["B", "D", "4"], stops: ["414", "D11"], equipment: "Elevator", alternative: "Take the Bx1." });
  });

  it("shows a planned outage on the time button it falls in, and not on others", () => {
    const list = slimOutages(now, equipment, upcoming);
    const night = (d: number) => [Date.UTC(2026, 11, d, 2) / 1000, Date.UTC(2026, 11, d, 11) / 1000] as const; // 9 PM to 6 AM New York
    expect(outagesBetween(list, ...night(17)).map((o) => o.id)).toEqual(["EL124"]);
    expect(outagesBetween(list, ...night(20)).map((o) => o.id)).toEqual([]);
  });

  it("does not count an outage twice when both feeds list it", () => {
    expect(slimOutages(now, equipment, [{ ...now[0], isupcomingoutage: "Y" }])).toHaveLength(1);
  });
});
