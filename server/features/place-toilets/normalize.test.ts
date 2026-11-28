import { describe, expect, it } from "vitest";
import { fromOsm } from "./normalize";
import { collectPlaceToilets } from "./ingest";

const el = (tags: Record<string, string>, extra: object = { lat: 40.73, lon: -73.99 }) => ({ type: "node" as const, id: 1, tags, ...extra });

describe("fromOsm", () => {
  it("labels yes/permissive/public as anyone and customers or untagged as customers", () => {
    expect(fromOsm(el({ toilets: "yes", amenity: "cafe", name: "A", "toilets:access": "permissive" }))?.access).toBe("anyone");
    expect(fromOsm(el({ toilets: "yes", amenity: "cafe", name: "A", "toilets:access": "yes" }))?.access).toBe("anyone");
    expect(fromOsm(el({ toilets: "yes", amenity: "pub", name: "A", "toilets:access": "customers" }))?.access).toBe("customers");
    const untagged = fromOsm(el({ toilets: "yes", shop: "books", name: "A" }));
    expect(untagged).toMatchObject({ access: "customers", accessTagged: false, kind: "shop" });
  });
  it("drops private toilets, other amenities and places without a name", () => {
    expect(fromOsm(el({ toilets: "yes", amenity: "cafe", name: "A", "toilets:access": "private" }))).toBeNull();
    expect(fromOsm(el({ toilets: "yes", amenity: "bank", name: "A" }))).toBeNull();
    expect(fromOsm(el({ toilets: "no", amenity: "cafe", name: "A" }))).toBeNull();
    expect(fromOsm(el({ toilets: "yes", amenity: "cafe" }))).toBeNull();
  });
  it("reads wheelchair, changing table, fee and a way's center", () => {
    const p = fromOsm({ type: "way", id: 7, center: { lat: 40.7, lon: -74 }, tags: { toilets: "yes", amenity: "fast_food", name: "B", "toilets:wheelchair": "yes", changing_table: "yes", "toilets:fee": "no" } });
    expect(p).toMatchObject({ id: "osm:way/7", wheelchair: true, changingTable: true, fee: false, lon: -74, url: "https://www.openstreetmap.org/way/7" });
  });
});

describe("fromOsm: what the restroom card shows", () => {
  it("keeps hours, phone, website, address, brand and the check date", () => {
    const p = fromOsm(el({ toilets: "yes", amenity: "cafe", name: "Joe", opening_hours: "Mo-Fr 07:00-19:00", phone: "+1 212 555 0100", website: "https://joe.example", "addr:housenumber": "120", "addr:street": "Fulton Street", "brand:wikidata": "Q37158", check_date: "2026-05-01" }));
    expect(p).toMatchObject({ openingHours: "Mo-Fr 07:00-19:00", phone: "+1 212 555 0100", website: "https://joe.example", address: "120 Fulton Street", brandWikidata: "Q37158", checkDate: "2026-05-01" });
  });
  it("prefers the toilets' own hours and check date, falls back to contact tags, and leaves the rest null", () => {
    const p = fromOsm(el({ toilets: "yes", shop: "books", name: "B", opening_hours: "24/7", "toilets:opening_hours": "Mo-Su 10:00-18:00", "contact:phone": "+1 1", check_date: "2024-01-01", "check_date:opening_hours": "2026-01-01", "addr:street": "Pearl St" }));
    expect(p).toMatchObject({ openingHours: "Mo-Su 10:00-18:00", phone: "+1 1", website: null, address: "Pearl St", brandWikidata: null, checkDate: "2026-01-01" });
  });
});

describe("collectPlaceToilets", () => {
  it("parses an Overpass response and dedupes", async () => {
    const body = { elements: [el({ toilets: "yes", amenity: "cafe", name: "A" }), el({ toilets: "yes", amenity: "cafe", name: "A" })] };
    const { places, elements } = await collectPlaceToilets(() => Promise.resolve(body));
    expect(elements).toBe(2);
    expect(places).toHaveLength(1);
  });
});
