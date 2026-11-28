import type { BusinessKind } from "@/lib/map/restroomIcons";
import type { OpenState } from "@/lib/openHours";

/**
 * The restroom pick (#249): the closest open restroom by walking time, public
 * or business. When that one is a business, the closest public restroom is
 * offered too, but only when it is open and at most {@link FREE_EXTRA_MIN}
 * minutes further. The app says where and when; the rider chooses.
 */
export interface RestroomOption {
  id: string;
  name: string;
  /** A restaurant, café, bar or shop: its restroom may be for customers only. */
  business: boolean;
  kind: BusinessKind | "public";
  brandWikidata: string | null;
  lon: number;
  lat: number;
  open: OpenState;
  /** The hours as the source wrote them, for the full card. */
  hours: string | null;
  fee: boolean | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  /** Walking minutes from the rider (routed when the router answers, else estimated). */
  minutes: number;
}

export const FREE_EXTRA_MIN = 5;

const byMinutes = (a: RestroomOption, b: RestroomOption) => a.minutes - b.minutes || a.name.localeCompare(b.name);

/** Free means a public restroom that does not charge. */
export const isFree = (o: RestroomOption) => !o.business && o.fee !== true;

export function pickRestroom(options: RestroomOption[]): { closest: RestroomOption | null; free: RestroomOption | null } {
  const open = options.filter((o) => o.open.status === "open").sort(byMinutes);
  const closest = open[0] ?? null;
  if (!closest?.business) return { closest, free: null };
  const free = open.find((o) => isFree(o) && o.minutes - closest.minutes <= FREE_EXTRA_MIN) ?? null;
  return { closest, free };
}

/** Closed restrooms cannot be picked; open and unknown ones can. */
export const pickable = (o: RestroomOption) => o.open.status !== "closed";

const RANK = { open: 0, unknown: 1, closed: 2 } as const;

/** The full list: open ones first, then unknown, then closed, each nearest first. */
export function listOrder(options: RestroomOption[]): RestroomOption[] {
  return [...options].sort((a, b) => RANK[a.open.status] - RANK[b.open.status] || byMinutes(a, b));
}

/** A city walk is about 1.3 times the straight line, at 1.3 m/s. */
export function estimateMinutes(straightMetres: number): number {
  return Math.max(1, Math.round((straightMetres * 1.3) / 1.3 / 60));
}

/** "Public · free", "Public · fee", "May be customers only". */
export function accessLine(o: RestroomOption): string {
  if (o.business) return "May be customers only";
  return o.fee === true ? "Public · fee" : "Public · free";
}
