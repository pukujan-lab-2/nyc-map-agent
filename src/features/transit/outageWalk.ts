import { formatStationName } from "@/lib/streetName";
import type { DiagramStep } from "./alertDiagram";
import type { Outage } from "./hooks";

/**
 * An elevator or escalator notice as short steps to read aloud (owner, 2026-11-14: "wish it did same for
 * escalator and elevator"): what is out and where, why, until when, then the MTA's detour one instruction at a
 * time, split by where the rider is. Pure.
 */
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** "11/15/2026 10:00:00 PM" as "November 15"; anything else as it came. */
function day(back: string): string {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(back);
  return m ? `${MONTHS[Number(m[1]) - 1]} ${Number(m[2])}` : back;
}

/** Slips in the feed's own text that a voice would read as nonsense. The MTA's words stay as they came under Full notice. */
const SLIPS: Array<[RegExp, string]> = [[/\btrMP\b/g, "trip"], [/\bdownntown\b/gi, "downtown"]];
const tidy = (s: string) => SLIPS.reduce((t, [re, to]) => t.replace(re, to), s).replace(/\s+/g, " ").trim();
const sentence = (s: string) => { const t = tidy(s).replace(/[.\s]+$/, ""); return t ? `${t.charAt(0).toUpperCase()}${t.slice(1)}.` : ""; };

/** Units as rows: an up and down pair is one ("both ways"). */
function units(list: Outage[]): Array<{ o: Outage; both: boolean }> {
  const used = new Set<string>();
  const out: Array<{ o: Outage; both: boolean }> = [];
  for (const o of list) {
    if (used.has(o.id)) continue;
    used.add(o.id);
    const [a, b] = o.serving.split(/ to /);
    const back = list.find((x) => !used.has(x.id) && x.equipment === o.equipment && b && x.serving === `${b} to ${a}`);
    if (back) used.add(back.id);
    out.push({ o, both: Boolean(back) });
  }
  return out;
}

/**
 * The MTA's detour as instructions. "If you are on the downtown 4/5 platform: To transfer, exit … Then re-enter …"
 * becomes "On the downtown 4/5 platform: To transfer, exit …" and "Then re-enter …".
 */
export function detourSteps(alternative: string): string[] {
  const out: string[] = [];
  // A place heading ends in a colon: "If you are on the street:", "To exit the platform:".
  const parts = tidy(alternative.replace(/\n+/g, " ")).split(/(?=\b(?:If you are (?:on|at|in)|To (?:exit|enter|reach|leave)) [^:.]{2,60}:)/);
  for (const part of parts) {
    const m = /^(If you are (?:on|at|in)|To (?:exit|enter|reach|leave)) ([^:.]{2,60}):\s*(.*)$/.exec(part.trim());
    const where = m ? (m[1].startsWith("If") ? `${m[1].replace(/^If you are /, "").replace(/^./, (c) => c.toUpperCase())} ${m[2]}` : `${m[1]} ${m[2]}`) : "";
    // "a St. George-bound train" is Saint George, not the end of a sentence; "to 50 St. Use elevators" is.
    const lines = (m ? m[3] : part).replace(/(^|[a-z,] )St\. (?=[A-Z])/g, "$1St.¤").split(/(?<=[.!?])\s+(?=[A-Z])/).map((l) => l.replace(/¤/g, " ")).map(sentence).filter(Boolean);
    lines.forEach((l, i) => out.push(where && i === 0 ? `${where}: ${l}` : l));
  }
  return out.map((l) => formatStationName(l));
}

export function outageSteps(list: Outage[], ids: string[]): { steps: DiagramStep[]; full: string; more: boolean } {
  if (!list.length) return { steps: [], full: "", more: false };
  const station = formatStationName(list[0].station);
  const rows = units(list);
  const days = [...new Set(list.map((o) => o.back).filter(Boolean).map(day))];
  const alternatives = [...new Set(list.map((o) => o.alternative).filter(Boolean))];
  // Units with different detours: each detour follows its own unit, so "On the street" is about the right elevator.
  const own = alternatives.length > 1;
  const steps: DiagramStep[] = [];
  rows.forEach(({ o, both }, i) => {
    const what = both ? `${o.equipment}s out both ways` : `${o.equipment} out`;
    const where = formatStationName(tidy(o.serving));
    const until = days.length > 1 && o.back ? `, until ${day(o.back)}` : "";
    steps.push({ text: sentence(`${what}${i === 0 ? ` at ${station}` : ""}${where ? `: ${where}` : ""}${until}`), ids });
    if (own && o.alternative) steps.push(...detourSteps(o.alternative).map((text) => ({ text, ids })));
  });
  const reasons = [...new Set(list.map((o) => o.reason).filter(Boolean))];
  if (reasons.length === 1) steps.push({ text: `Why: ${reasons[0].charAt(0).toUpperCase()}${reasons[0].slice(1).toLowerCase()}.`, ids: [] });
  if (days.length === 1) steps.push({ text: `When: until ${days[0]}.`, ids: [] });
  if (!own) for (const alt of alternatives) steps.push(...detourSteps(alt).map((text) => ({ text, ids })));
  return { steps, full: alternatives.join("\n\n"), more: alternatives.length > 0 };
}
