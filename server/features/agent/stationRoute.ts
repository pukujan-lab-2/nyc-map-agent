/**
 * The way through a subway station with no stairs: from the street to a
 * platform or back, step by step, with the sign to follow and the elevator's
 * number. From the MTA's draft station data (public/transit/pathways.json; see
 * src/lib/transit/pathways.ts), with elevators that are out right now left
 * out, so the answer is a way that works now or an honest "none".
 *
 * The draft is from 2021 and knows 230 station entries: a station it does not
 * hold gets "not known", never a guess.
 */
import { readFileSync } from "node:fs";
import { entranceOf, fromStreet, toStreet, type Pathways, type RouteOptions, type RouteStep } from "../../../src/lib/transit/pathways";

let shipped: Pathways | null = null;
export const stationPathways = (): Pathways =>
  (shipped ??= JSON.parse(readFileSync(new URL("../../../public/transit/pathways.json", import.meta.url), "utf8")) as Pathways);

export type Way = "to-platform" | "to-street";
/** An elevator or escalator out of service now, and when the MTA expects it back. */
export interface Out { unit: string; back: string }

export interface PlatformRoute {
  /** The platform's direction as riders see it ("Uptown & Queens"), or "northbound" / "southbound". */
  toward: string;
  /** Each step in order, in plain words. Empty when there is no way. */
  steps: string[];
  /** The street entrance the way starts or ends at, as the MTA's draft names it; the names are not final. */
  entrance: string | null;
  /** True when a step-free way exists right now. */
  stepFree: boolean;
  /** Elevators on the usual step-free way that are out now. */
  out: Out[];
  /** In one sentence, what is different from usual; absent when nothing is. */
  note?: string;
}

const say = (s: RouteStep): string => {
  const sign = s.sign ? `, signed "${s.sign.replace(/\s*\|\s*/g, ", ")}"` : "";
  if (s.mode === "elevator") return `Elevator ${s.equipment}${sign}`;
  if (s.mode === "escalator") return `Escalator ${s.equipment}${sign}`;
  if (s.mode === "fare gate") return `Through the fare gate${sign}`;
  if (s.mode === "exit gate") return `Out through the gate${sign}`;
  return `${s.mode === "stairs" ? "Stairs" : "Along the passage"}${sign}`;
};

/**
 * The step-free ways at one station stop (a GTFS stop id such as "R20"), one
 * per direction the draft knows, or null when it holds neither platform.
 */
export function stationRoutes(data: Pathways, stop: { gtfsId: string; north?: string; south?: string }, way: Way, out: readonly Out[]): PlatformRoute[] | null {
  const down = new Map(out.map((o) => [o.unit.toUpperCase(), o]));
  const find = (platform: string, opts?: RouteOptions) => (way === "to-street" ? toStreet(data, platform, opts) : fromStreet(data, platform, opts));
  const routes: PlatformRoute[] = [];
  for (const [suffix, label, fallback] of [["N", stop.north, "northbound"], ["S", stop.south, "southbound"]] as const) {
    const platform = stop.gtfsId + suffix;
    if (!data.nodes[platform]) continue;
    const usual = find(platform);
    const now = down.size ? find(platform, { outOfService: [...down.keys()] }) : usual;
    const blocked = (usual ?? []).flatMap((s) => (down.has(s.equipment) ? [down.get(s.equipment)!] : []));
    const street = (steps: RouteStep[]) => (way === "to-street" ? data.nodes[steps[steps.length - 1].to]?.name ?? null : entranceOf(data, steps, platform));
    const route: PlatformRoute = { toward: label || fallback, steps: (now ?? []).map(say), entrance: now?.length ? street(now) : null, stepFree: !!now, out: blocked };
    if (!usual) route.note = "The MTA's station data shows no way without stairs to this platform.";
    else if (!now) route.note = `No way without stairs right now: ${blocked.map((o) => `elevator ${o.unit} is out, back ${o.back}`).join("; ")}.`;
    else if (blocked.length) route.note = `This goes round elevator ${blocked.map((o) => o.unit).join(" and ")}, which is out.`;
    routes.push(route);
  }
  return routes.length ? routes : null;
}
