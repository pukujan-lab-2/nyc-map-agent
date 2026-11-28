import { octoQuery } from "../../../api/_lib/octo";
import { fail, json } from "../../../api/_lib/http";
import { openState } from "../../lib/openingHours";
import type { PlaceToiletsResponse } from "./schema";

/**
 * GET /api/v1/place-toilets: restaurants, cafés, bars and shops with a toilet
 * (OpenStreetMap, refreshed nightly into core.place_toilets) as GeoJSON.
 * City-wide; about a thousand points, so the client filters by zoom. Each
 * place says whether it is open now, read in New York time at request time,
 * so the response is cached for five minutes only.
 */
interface Row {
  id: string;
  name: string;
  kind: string;
  access: "anyone" | "customers";
  access_tagged: boolean;
  wheelchair: boolean | null;
  changing_table: boolean | null;
  fee: boolean | null;
  lon: number;
  lat: number;
  url: string;
  opening_hours: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  brand_wikidata: string | null;
  check_date: string | null;
  refreshed_at: string | Date | null;
}

const iso = (v: string | Date | null): string | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00"));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export async function GET(): Promise<Response> {
  try {
    const { rows } = await octoQuery<Row>(
      `SELECT id, name, kind, access, access_tagged, wheelchair, changing_table, fee, lon, lat, url,
              opening_hours, phone, website, address, brand_wikidata, check_date, refreshed_at
       FROM core.place_toilets ORDER BY id`,
      [],
      { rowLimit: 10000 },
    );
    const now = new Date();
    const body: PlaceToiletsResponse = {
      type: "FeatureCollection",
      features: rows.map((r) => {
        const fetchedAt = iso(r.refreshed_at);
        return {
          type: "Feature" as const,
          id: r.id,
          geometry: { type: "Point" as const, coordinates: [Number(r.lon), Number(r.lat)] as [number, number] },
          properties: {
            id: r.id,
            name: r.name,
            kind: r.kind,
            access: r.access,
            accessTagged: r.access_tagged,
            wheelchair: r.wheelchair,
            changingTable: r.changing_table,
            fee: r.fee,
            source: "openstreetmap" as const,
            url: r.url,
            openingHours: r.opening_hours ?? null,
            phone: r.phone ?? null,
            website: r.website ?? null,
            address: r.address ?? null,
            brandWikidata: r.brand_wikidata ?? null,
            checkDate: r.check_date ?? null,
            fetchedAt,
            open: openState(r.opening_hours ?? null, { now, fetchedAt }),
          },
        };
      }),
    };
    return json(body, { maxAge: 300, browserMaxAge: 300 });
  } catch (err) {
    return fail(err);
  }
}
