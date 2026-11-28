import { octoQuery } from "../../../api/_lib/octo";
import { fail, json } from "../../../api/_lib/http";
import { mergeRestrooms, type CityRestroom } from "./merge";
import type { OsmToilet } from "./osm";

/**
 * GET /api/restrooms: public restrooms as one GeoJSON FeatureCollection. The
 * city list (core.restrooms) merged with OpenStreetMap public toilets
 * (core.osm_toilets); each record says its source, asOf and whether it is open
 * now (New York time, at request time). When the OSM table
 * cannot be read, the city list is served alone.
 */
type Raw<T> = { [K in keyof T]: T[K] | string | null };

const iso = (v: unknown): string | null => {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
  if (typeof v !== "string" || !v) return null;
  // Postgres text form ("2025-06-27 13:37:17.684+00") as well as ISO.
  const d = new Date(v.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00"));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const text = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const bool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : v === "true" || v === "t" ? true : v === "false" || v === "f" ? false : null);

async function readOsm(): Promise<OsmToilet[]> {
  try {
    const { rows } = await octoQuery<Raw<OsmToilet> & { opening_hours: unknown; changing_table: unknown; edited_at: unknown; refreshed_at: unknown }>(
      "SELECT id, name, access, fee, wheelchair, opening_hours, changing_table, unisex, operator, url, edited_at, refreshed_at, lon, lat FROM core.osm_toilets ORDER BY id",
      [],
      { rowLimit: 10000 },
    );
    return rows.map((r) => ({
      id: String(r.id),
      name: text(r.name),
      access: text(r.access),
      fee: bool(r.fee),
      wheelchair: text(r.wheelchair),
      openingHours: text(r.opening_hours),
      changingTable: bool(r.changing_table),
      unisex: bool(r.unisex),
      operator: text(r.operator),
      url: String(r.url),
      editedAt: iso(r.edited_at),
      fetchedAt: iso(r.refreshed_at),
      lon: Number(r.lon),
      lat: Number(r.lat),
    }));
  } catch (err) {
    console.error(`restrooms: OSM toilets unavailable, serving the city list alone (${err instanceof Error ? err.message : String(err)})`);
    return [];
  }
}

export async function GET(): Promise<Response> {
  try {
    const [{ rows }, osm] = await Promise.all([
      octoQuery<Raw<CityRestroom>>(
        "SELECT name, status, hours, accessibility, operator, location_type, changing_stations, updated_at, fetched_at, lat, lon FROM core.restrooms ORDER BY name",
        [],
        { rowLimit: 5000 },
      ),
      readOsm(),
    ]);
    const city: CityRestroom[] = rows.map((r) => ({
      name: String(r.name),
      status: text(r.status),
      hours: text(r.hours),
      accessibility: text(r.accessibility),
      operator: text(r.operator),
      location_type: text(r.location_type),
      changing_stations: text(r.changing_stations),
      updated_at: iso(r.updated_at),
      fetched_at: iso(r.fetched_at),
      lon: Number(r.lon),
      lat: Number(r.lat),
    }));
    // Open now is read at request time, so the edge keeps it five minutes.
    return json(mergeRestrooms(city, osm, new Date()), { maxAge: 300 });
  } catch (err) {
    return fail(err);
  }
}
