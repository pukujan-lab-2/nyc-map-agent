import { describe, expect, it } from "vitest";
import type { Outage } from "./hooks";
import { detourSteps, outageSteps } from "./outageWalk";

const unit = (over: Partial<Outage>): Outage => ({ id: "x", station: "Fulton St", routes: ["A", "C", "4", "5"], stops: ["418"], equipment: "Elevator", serving: "", reason: "Repair", since: "", back: "11/15/2026 01:00:00 AM", ada: "yes", alternative: "", ...over });

// Fulton St as the live site served it on 2026-11-14, the feed's own slips included ("trMP", "downntown").
const fulton: Outage[] = [
  unit({ id: "ES362X", equipment: "Escalator", serving: "uptown 4/5 platform level to Transit Center exit (Fulton St east of Broadway)", back: "11/15/2026 10:00:00 PM" }),
  unit({ id: "EL729X", serving: "Transit Center concourse to downntown 4/5 platform and access to rest of complex", alternative: "If you are on the downtown 4/5 platform: To transfer, exit through the faregates and take the elevator to street level or Lower Concourse. Then re-enter through the faregates to complete your trMP. If you are on the lower concourse: Exit through the faregates and take the elevator near the passageway to PATH to downtown 4/5 and re-enter through the faregates." }),
  unit({ id: "ES361X", equipment: "Escalator", serving: "uptown 4/5 platform level to Transit Center exit (NE corner of John St & Broadway)", back: "11/15/2026 06:00:00 PM" }),
];

describe("outageSteps", () => {
  it("says each unit, why and until when, then the detour one instruction at a time by where the rider is", () => {
    const w = outageSteps(fulton, ["418"]);
    expect(w.steps.map((s) => s.text)).toEqual([
      "Escalator out at Fulton Street: uptown 4/5 platform level to Transit Center exit (Fulton Street east of Broadway).",
      "Elevator out: Transit Center concourse to downtown 4/5 platform and access to rest of complex.",
      "Escalator out: uptown 4/5 platform level to Transit Center exit (NE corner of John Street & Broadway).",
      "Why: Repair.",
      "When: until November 15.",
      "On the downtown 4/5 platform: To transfer, exit through the faregates and take the elevator to street level or Lower Concourse.",
      "Then re-enter through the faregates to complete your trip.",
      "On the lower concourse: Exit through the faregates and take the elevator near the passageway to PATH to downtown 4/5 and re-enter through the faregates.",
    ]);
    // The station is lit while a unit or a detour step is said.
    expect(w.steps[0].ids).toEqual(["418"]);
    expect(w.steps[3].ids).toEqual([]);
    // The MTA's own words, slips and all, stay under Full notice.
    expect(w.more).toBe(true);
    expect(w.full).toContain("trMP");
  });

  it("says an up and down pair once, and each unit's own date when they differ", () => {
    const pair = [
      unit({ id: "a", station: "34 St-Penn Station", equipment: "Escalator", serving: "mezzanine to 7 Av & 34 St (NE corner)", reason: "Capital Replacement", back: "12/31/2026 11:00:00 PM" }),
      unit({ id: "b", station: "34 St-Penn Station", equipment: "Escalator", serving: "7 Av & 34 St (NE corner) to mezzanine", reason: "Capital Replacement", back: "12/31/2026 11:00:00 PM" }),
      unit({ id: "c", station: "34 St-Penn Station", serving: "street to mezzanine", reason: "Capital Replacement", back: "11/20/2026 11:00:00 PM" }),
    ];
    const w = outageSteps(pair, []);
    expect(w.steps.map((s) => s.text)).toEqual([
      "Escalators out both ways at 34 Street-Penn Station: mezzanine to 7 Avenue & 34 Street (NE corner), until December 31.",
      "Elevator out: street to mezzanine, until November 20.",
      "Why: Capital replacement.",
    ]);
    expect(w.more).toBe(false);
  });
});

describe("detourSteps", () => {
  it("keeps a heading that is not about where you are, and takes line breaks as spaces", () => {
    expect(detourSteps("To exit the platform: Take a Manhattan-bound B or Q to DeKalb Av. Transfer to a 95 St-bound R.\n\nIf you are in the mezzanine: For B/Q, take a Manhattan-bound R to DeKalb Av and transfer to B/Q.")).toEqual([
      "To exit the platform: Take a Manhattan-bound B or Q to DeKalb Avenue.",
      "Transfer to a 95 Street-bound R.",
      "In the mezzanine: For B/Q, take a Manhattan-bound R to DeKalb Avenue and transfer to B/Q.",
    ]);
  });

  it("does not end a sentence at 'St.' in a name", () => {
    expect(detourSteps("If you are on the street: Follow New Dorp Ln to take a St. George-bound SIR train to Dongan Hills station. Use ramps to transfer.")).toEqual([
      "On the street: Follow New Dorp Lane to take a St. George-bound SIR train to Dongan Hills station.",
      "Use ramps to transfer.",
    ]);
  });

  it("reads a detour with no heading as its sentences", () => {
    expect(detourSteps("Use the elevator at the north end. Ask a station agent for help.")).toEqual(["Use the elevator at the north end.", "Ask a station agent for help."]);
  });
});
