import { createElement } from "react";
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent, MapMouseEvent } from "maplibre-gl";
import { kioskSources, pickAt } from "@/lib/map/streetPick";
import { pushPanel } from "@/lib/store/PanelContext";
import { businessKind, ensureBrandIcon, ensureRestroomIcons, ICON_IMAGE } from "@/lib/map/restroomIcons";
import { hoursLabel, stateAt } from "@/lib/openHours";
import { CUSTOMERS_LINE, fetchPlaceToilets, KIND_LABEL, MIN_ZOOM, type PlaceToiletFeature } from "./data";
import { PlaceToiletSheet } from "./PlaceToiletSheet";
import { isShopsEnabled, subscribeShops } from "./store";

/**
 * Shops & cafés with a toilet from zoom 15, under the green public restroom
 * discs, which stay primary: each shows its kind (a café cup, a knife and
 * fork, a glass, a bag) or its brand logo, with a small green restroom badge
 * (#249, src/lib/map/restroomIcons.ts). Data is fetched only once the chip is on.
 */
const SRC = "place-toilets";
const PLACE_TOILETS_LAYER = "place-toilets";
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/** What the symbol layer reads: the id (for the click), the icon's kind and the brand. */
function toCollection(places: PlaceToiletFeature[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: places.map((f) => ({
      type: "Feature",
      geometry: f.geometry,
      properties: { id: f.properties.id, kind: businessKind(f.properties.kind), brand: f.properties.brandWikidata ?? null },
    })),
  };
}

export function mount(map: MapLibreMap): () => void {
  let places: PlaceToiletFeature[] = [];
  let alive = true;
  if (!map.getSource(SRC)) map.addSource(SRC, { type: "geojson", data: EMPTY, attribution: "© OpenStreetMap contributors (ODbL)" });
  ensureRestroomIcons(map);
  map.addLayer(
    {
      id: PLACE_TOILETS_LAYER,
      type: "symbol",
      source: SRC,
      minzoom: MIN_ZOOM,
      layout: {
        visibility: "none",
        "icon-image": ICON_IMAGE,
        "icon-size": ["interpolate", ["linear"], ["zoom"], 15, 0.6, 18, 0.9],
        "icon-allow-overlap": true,
        "icon-pitch-alignment": "viewport",
      },
    },
    map.getLayer("restrooms") ? "restrooms" : undefined,
  );

  const apply = (on: boolean) => {
    kioskSources.places = on;
    if (!alive || !map.getLayer(PLACE_TOILETS_LAYER)) return;
    map.setLayoutProperty(PLACE_TOILETS_LAYER, "visibility", on ? "visible" : "none");
    if (on && !places.length) {
      void fetchPlaceToilets().then((p) => {
        if (!alive) return;
        places = p;
        const data = toCollection(p);
        void map.getSource<GeoJSONSource>(SRC)?.setData(data);
        // Brand logos replace the kind icon as they arrive.
        const brands = [...new Set(p.map((x) => x.properties.brandWikidata).filter((q): q is string => Boolean(q)))];
        void Promise.all(brands.map((q) => ensureBrandIcon(map, q))).then((added) => {
          if (alive && added.some(Boolean)) void map.getSource<GeoJSONSource>(SRC)?.setData(data);
        });
      });
    }
  };

  const open = (f: PlaceToiletFeature) => {
    const p = f.properties;
    const [lon, lat] = f.geometry.coordinates as [number, number];
    pushPanel({
      id: `place-toilet:${p.id}`,
      title: p.name,
      subtitle: `${KIND_LABEL[p.kind] ?? "Place"} with restroom`,
      summary: `${hoursLabel(stateAt(p.open, new Date()), new Date())} · ${CUSTOMERS_LINE}`,
      details: createElement(PlaceToiletSheet, { place: p, lon, lat }),
    });
  };
  const onClick = (e: MapLayerMouseEvent) => {
    const id = e.features?.[0]?.properties?.id as string | undefined;
    const f = places.find((x) => x.properties.id === id);
    if (f) open(f);
  };
  // The 3D kiosk for a place at street level opens the same sheet.
  const onKiosk = (e: MapMouseEvent) => {
    const k = pickAt(map, e.point.x, e.point.y);
    if (k?.kind !== "place") return;
    const f = places.find((x) => x.properties.id === k.id);
    if (f) open(f);
  };
  const pointer = () => (map.getCanvas().style.cursor = "pointer");
  const unpointer = () => (map.getCanvas().style.cursor = "");
  map.on("click", PLACE_TOILETS_LAYER, onClick);
  map.on("click", onKiosk);
  map.on("mouseenter", PLACE_TOILETS_LAYER, pointer);
  map.on("mouseleave", PLACE_TOILETS_LAYER, unpointer);
  const unsub = subscribeShops(apply);
  apply(isShopsEnabled());

  return () => {
    alive = false;
    unsub();
    map.off("click", PLACE_TOILETS_LAYER, onClick);
    map.off("click", onKiosk);
    map.off("mouseenter", PLACE_TOILETS_LAYER, pointer);
    map.off("mouseleave", PLACE_TOILETS_LAYER, unpointer);
    if (map.getLayer(PLACE_TOILETS_LAYER)) map.removeLayer(PLACE_TOILETS_LAYER);
    if (map.getSource(SRC)) map.removeSource(SRC);
  };
}
