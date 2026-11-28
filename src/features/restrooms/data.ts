import { api } from "@/lib/api/client";
import { OSRM_FOOT_URL, type LngLat } from "@/lib/api/routing";
import { businessKind } from "@/lib/map/restroomIcons";
import { loadRestrooms, metresBetween } from "./layers";
import { stateAt, type OpenState } from "@/lib/openHours";
import { estimateMinutes, type RestroomOption } from "./pick";

/**
 * Every restroom near the rider as pick options: the public list
 * (/api/restrooms) and businesses with a toilet (/api/v1/place-toilets),
 * both city-wide and filtered here, so the rider's position never leaves the
 * phone except for the one walking-time request to the router the app
 * already uses for directions.
 */
/** Restrooms further than this are not offered (about a 25-minute walk). */
const NEAR_M = 1600;
/** How many go to the router for real walking times. */
const ROUTED = 12;
const SHOWN = 20;

type Props = Record<string, unknown>;
const s = (p: Props, k: string) => (typeof p[k] === "string" && p[k] ? p[k] : null);
const b = (p: Props, k: string) => (typeof p[k] === "boolean" ? p[k] : null);

let businesses: { at: number; list: Promise<GeoJSON.Feature[]> } | null = null;
/** Businesses with a toilet; refetched after five minutes so open-now stays current. */
function loadBusinesses(): Promise<GeoJSON.Feature[]> {
  if (!businesses || Date.now() - businesses.at > 300_000) {
    businesses = {
      at: Date.now(),
      list: api
        .GET("/api/v1/place-toilets")
        .then(({ data }) => (data?.features as GeoJSON.Feature[] | undefined) ?? [])
        .catch(() => []),
    };
  }
  return businesses.list;
}

function point(f: GeoJSON.Feature): [number, number] | null {
  if (f.geometry?.type !== "Point") return null;
  const [lon, lat] = f.geometry.coordinates as [number, number];
  return Number.isFinite(lon) && Number.isFinite(lat) ? [lon, lat] : null;
}

/** A /api/restrooms or /api/v1/place-toilets feature as an option, minutes estimated from the straight line. */
function toOption(f: GeoJSON.Feature, business: boolean, here: LngLat, now: Date): RestroomOption | null {
  const at = point(f);
  if (!at) return null;
  const p = (f.properties ?? {}) as Props;
  const id = s(p, "id") ?? (typeof f.id === "string" ? f.id : null);
  if (!id) return null;
  return {
    id,
    name: s(p, "name") ?? (business ? "Restroom" : "Public restroom"),
    business,
    kind: business ? businessKind(s(p, "kind") ?? "") : "public",
    brandWikidata: business ? s(p, "brandWikidata") : null,
    lon: at[0],
    lat: at[1],
    open: stateAt(p.open as OpenState | undefined, now),
    hours: s(p, business ? "openingHours" : "hours"),
    fee: b(p, "fee"),
    address: s(p, "address"),
    phone: s(p, "phone"),
    website: s(p, "website"),
    minutes: estimateMinutes(metresBetween([here.lon, here.lat], at)),
  };
}

/** The nearest restrooms of both kinds within {@link NEAR_M}, straight-line nearest first. */
export function nearbyOptions(publicList: GeoJSON.Feature[], businessList: GeoJSON.Feature[], here: LngLat, now: Date): RestroomOption[] {
  const scored: Array<[number, RestroomOption]> = [];
  for (const [list, business] of [[publicList, false], [businessList, true]] as const) {
    for (const f of list) {
      const at = point(f);
      if (!at) continue;
      const m = metresBetween([here.lon, here.lat], at);
      if (m > NEAR_M) continue;
      const o = toOption(f, business, here, now);
      if (o) scored.push([m, o]);
    }
  }
  return scored.sort((x, y) => x[0] - y[0]).slice(0, SHOWN).map(([, o]) => o);
}

/** Walking seconds from `from` to each point, one router request; null where it has no answer. */
async function walkSeconds(from: LngLat, to: LngLat[], signal?: AbortSignal): Promise<Array<number | null>> {
  if (!to.length) return [];
  const coords = [from, ...to].map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
  try {
    const res = await fetch(`${OSRM_FOOT_URL}/table/v1/foot/${coords}?sources=0&annotations=duration`, { signal });
    if (!res.ok) return to.map(() => null);
    const body = (await res.json()) as { code?: string; durations?: Array<Array<number | null>> };
    const row = body.code === "Ok" ? body.durations?.[0] : undefined;
    return to.map((_, i) => (typeof row?.[i + 1] === "number" ? row[i + 1] : null));
  } catch {
    return to.map(() => null);
  }
}

/** Options near the rider with routed walking minutes for the nearest {@link ROUTED}. */
export async function loadOptions(here: LngLat, signal?: AbortSignal): Promise<RestroomOption[]> {
  const [pub, biz] = await Promise.all([loadRestrooms(), loadBusinesses()]);
  const options = nearbyOptions(pub.features, biz, here, new Date());
  const routed = options.slice(0, ROUTED);
  const secs = await walkSeconds(here, routed, signal);
  secs.forEach((sec, i) => {
    if (sec !== null) routed[i].minutes = Math.max(1, Math.round(sec / 60));
  });
  return options;
}

// ---- Riders' answers ----------------------------------------------------------

export interface AnswerSummary {
  confirmedAt: string | null;
  free: boolean | null;
  recentNo: number;
  warn: boolean;
  problem: "closed" | "customers_only" | "out_of_order" | "not_found" | null;
}

/** Recent answers for these restrooms; empty when the route fails. */
export async function loadAnswers(ids: string[]): Promise<Record<string, AnswerSummary>> {
  if (!ids.length) return {};
  try {
    const { data } = await api.GET("/api/v1/restroom-answers", { params: { query: { ids: ids.slice(0, 100).join(",") } } });
    return (data?.answers as Record<string, AnswerSummary> | undefined) ?? {};
  } catch {
    return {};
  }
}

export interface Answer {
  restroomId: string;
  available: boolean;
  paid?: boolean | null;
  customersOnly?: boolean | null;
  codeNeeded?: boolean | null;
  problem?: AnswerSummary["problem"];
}

/** Sends one answer. keepalive, so closing the sheet straight after still delivers it. */
export function sendAnswer(a: Answer): void {
  void fetch(`${window.location.origin}/api/v1/restroom-answers`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(a),
    keepalive: true,
  }).catch(() => {});
}

/** "Free, confirmed 2 days ago" / "Confirmed today"; a warning when several people could not use it lately. */
export function answerLine(a: AnswerSummary | undefined, now: Date): { text: string; warn: boolean } | null {
  if (!a) return null;
  if (a.warn) return { text: `${a.recentNo} people couldn't use it lately`, warn: true };
  if (!a.confirmedAt) return null;
  const days = Math.floor((now.getTime() - Date.parse(a.confirmedAt)) / 86_400_000);
  const when = days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
  return { text: `${a.free ? "Free, confirmed" : "Confirmed"} ${when}`, warn: false };
}
