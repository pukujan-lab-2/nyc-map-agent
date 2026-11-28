import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { ensureBrandIcon, ensureRestroomIcons, ICON_IMAGE } from "@/lib/map/restroomIcons";
import type { RestroomOption } from "./pick";

/**
 * The restrooms the pick shows, drawn on the map with their own icons while
 * the sheet is open (#249): the picked one larger, closed ones faded. Gone
 * when the pick closes.
 */
const SRC = "restroom-pick";
const PICK_LAYER = "restroom-pick";
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function collection(options: RestroomOption[], picked: string | null): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: options.map((o) => ({
      type: "Feature",
      id: o.id,
      geometry: { type: "Point", coordinates: [o.lon, o.lat] },
      properties: { id: o.id, kind: o.kind, brand: o.brandWikidata, picked: o.id === picked, closed: o.open.status === "closed" },
    })),
  };
}

function install(map: MapLibreMap): void {
  ensureRestroomIcons(map);
  if (!map.getSource(SRC)) map.addSource(SRC, { type: "geojson", data: EMPTY });
  if (!map.getLayer(PICK_LAYER)) {
    map.addLayer({
      id: PICK_LAYER,
      type: "symbol",
      source: SRC,
      layout: {
        "icon-image": ICON_IMAGE,
        "icon-size": ["case", ["get", "picked"], 1.25, 0.9],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-pitch-alignment": "viewport",
        "symbol-sort-key": ["case", ["get", "picked"], 1, 0],
      },
      paint: { "icon-opacity": ["case", ["get", "closed"], 0.45, 1] },
    });
  }
}

/** Shows these options (or clears with an empty list). Brand logos load in the background and redraw. */
export function showPickOnMap(map: MapLibreMap, options: RestroomOption[], picked: string | null): void {
  if (!map.isStyleLoaded()) {
    map.once("idle", () => showPickOnMap(map, options, picked));
    return;
  }
  install(map);
  map.moveLayer(PICK_LAYER);
  const data = collection(options, picked);
  void map.getSource<GeoJSONSource>(SRC)?.setData(data);
  const brands = [...new Set(options.map((o) => o.brandWikidata).filter((q): q is string => Boolean(q)))];
  if (!brands.length) return;
  void Promise.all(brands.map((q) => ensureBrandIcon(map, q))).then((added) => {
    if (added.some(Boolean)) void map.getSource<GeoJSONSource>(SRC)?.setData(data);
  });
}

export function clearPickOnMap(map: MapLibreMap): void {
  void map.getSource<GeoJSONSource>(SRC)?.setData(EMPTY);
}
