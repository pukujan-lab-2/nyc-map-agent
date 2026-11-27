/**
 * Elevator and escalator outages from the MTA's equipment feeds, slimmed for the map. Pure, so the shaping is
 * tested without the network. Each outage carries its window in epoch seconds, so a time button (this weekend,
 * tonight) can show an elevator that will be out then, not only one that is out now (2026-11-27 audit: the
 * upcoming feed listed 67 outages the app never read).
 */
import { nyEpoch } from "../../../src/lib/transit/weekend";

type Row = Record<string, string>;

type SlimOutage = {
  id: string; station: string; routes: string[]; stops: string[]; equipment: "Elevator" | "Escalator";
  serving: string; reason: string; since: string; back: string; ada: "yes" | "no" | "not-ada"; alternative: string;
  /** The outage window in epoch seconds; `to` 0 when the MTA gives no return time. */
  from: number; to: number;
  /** From the MTA's list of planned outages that have not started yet. */
  upcoming: boolean;
};

/** "11/26/2026 05:07:00 PM" in New York time as epoch seconds; 0 when it does not parse. */
export function outageTime(s: string | undefined): number {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2})(?::(\d{2}))? ?(AM|PM)$/i.exec((s ?? "").trim());
  if (!m) return 0;
  const [, mo, d, y, h, mi, sec, ap] = m;
  const hour = (Number(h) % 12) + (/pm/i.test(ap) ? 12 : 0);
  return nyEpoch(Number(y), Number(mo), Number(d), hour) + Number(mi) * 60 + Number(sec ?? 0);
}

/**
 * Outages placed by the equipment list's GTFS stop ids. `rows` are the current feed's rows (upcoming ones in it are
 * skipped) and `upcoming` the planned-outage feed's rows; pass none for a right-now answer.
 */
export function slimOutages(rows: Row[], equipmentRows: Row[], upcoming: Row[] = []): SlimOutage[] {
  const equipment = new Map(equipmentRows.map((q) => [q.equipmentno, q] as const));
  const current = rows.filter((o) => o.isupcomingoutage !== "Y");
  const outNow = new Set(current.map((o) => o.equipment));
  const stopsOf = (q?: Row) => (q?.elevatorsgtfsstopid ?? "").split(/[/,; ]+/).filter(Boolean);
  const shape = (o: Row, isUpcoming: boolean): SlimOutage => {
    const q = equipment.get(o.equipment);
    const stops = stopsOf(q);
    const isElevator = o.equipmenttype === "EL";
    // Still accessible if another active ADA elevator serves the same stop and is not out, or the unit is redundant.
    const adaStation = [...equipment.values()].some((x) => x.ADA === "Y" && stopsOf(x).some((s) => stops.includes(s)));
    const backup = [...equipment.values()].some((x) => x.equipmentno !== o.equipment && x.equipmenttype === "EL" && x.ADA === "Y" && x.isactive === "Y" && !outNow.has(x.equipmentno) && stopsOf(x).some((s) => stops.includes(s)));
    return {
      id: o.equipment,
      station: o.station,
      routes: (o.trainno ?? "").split("/").filter(Boolean),
      stops,
      equipment: isElevator ? "Elevator" : "Escalator",
      serving: o.serving,
      reason: o.reason,
      since: o.outagedate,
      back: o.estimatedreturntoservice,
      ada: adaStation ? (!isElevator || backup || Number(q?.redundant) === 1 ? "yes" : "no") : "not-ada",
      alternative: q?.alternativeroute ?? "",
      from: outageTime(o.outagedate),
      to: outageTime(o.estimatedreturntoservice),
      upcoming: isUpcoming,
    };
  };
  const seen = new Set(current.map((o) => `${o.equipment}|${o.outagedate}`));
  const later = upcoming.filter((o) => !seen.has(`${o.equipment}|${o.outagedate}`));
  return [...current.map((o) => shape(o, false)), ...later.map((o) => shape(o, true))];
}

/** Outages in effect at any time from → to: started by `to` and not yet back by `from`. */
export function outagesBetween(list: SlimOutage[], from: number, to: number): SlimOutage[] {
  return list.filter((o) => (o.from || 0) <= to && (!o.to || o.to >= from));
}
