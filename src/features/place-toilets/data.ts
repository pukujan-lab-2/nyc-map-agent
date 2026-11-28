import { api } from "@/lib/api/client";
import type { OpenState } from "@/lib/openHours";

/** One place as /api/v1/place-toilets serves it (server/features/place-toilets/schema.ts). */
export interface PlaceToiletProps {
  id: string;
  name: string;
  kind: string;
  access: "anyone" | "customers";
  accessTagged: boolean;
  wheelchair: boolean | null;
  changingTable: boolean | null;
  fee: boolean | null;
  source: "openstreetmap";
  url: string;
  openingHours?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  brandWikidata?: string | null;
  checkDate?: string | null;
  fetchedAt?: string | null;
  /** Open now, worked out by the server in New York time (server/lib/openingHours.ts). */
  open?: OpenState;
}
export type PlaceToiletFeature = GeoJSON.Feature<GeoJSON.Point, PlaceToiletProps>;

export const ACCESS_LABEL: Record<PlaceToiletProps["access"], string> = {
  anyone: "Anyone",
  customers: "Customers only",
};

export const KIND_LABEL: Record<string, string> = {
  restaurant: "Restaurant",
  cafe: "Café",
  fast_food: "Fast food",
  bar: "Bar",
  pub: "Pub",
  shop: "Shop",
};

/** Every business says this: the app cannot know who may use its restroom (owner, 2026-11-27). */
export const CUSTOMERS_LINE = "May be customers only";

/** Minimum zoom for these markers: public restrooms stay primary below it. */
export const MIN_ZOOM = 15;

let cache: Promise<PlaceToiletFeature[]> | null = null;

/** City-wide list, fetched once per page (≈1k points, cached by the CDN for an hour). */
export function fetchPlaceToilets(): Promise<PlaceToiletFeature[]> {
  cache ??= api
    .GET("/api/v1/place-toilets")
    .then(({ data }) => (data?.features as PlaceToiletFeature[] | undefined) ?? [])
    .catch(() => {
      cache = null;
      return [];
    });
  return cache;
}
