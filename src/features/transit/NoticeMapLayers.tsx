import { useEffect, useMemo, useState } from "react";
import { Layer, Source, useMap } from "react-map-gl/maplibre";
import type { Map as MaplibreMap } from "maplibre-gl";
import { lineColor, bulletId, addBulletImage } from "@/lib/transit/bullets";
import type { Palette } from "@/lib/theme";
import { setNoticeMapView } from "./alertFocus";
import { fetchBusCatalog, useBusShapes, type TransitAlert } from "./hooks";
import type { StaticSystem } from "./model";
import { LANE, busRoutesFor, noticeMapFeatures, stepMapFrom, type BusShape, type NoticeMapFeatures } from "./noticeMap";
import type { StepMap } from "./walkMap";

type Walk = { ids: string[]; corners: Array<{ id: string; text: string }>; bus: string[]; map?: StepMap };

/** The bus catalog's route names, loaded once; empty until it arrives (bus lines then draw stop to stop). */
function useCatalog(want: boolean): readonly string[] {
  const [names, setNames] = useState<readonly string[]>([]);
  useEffect(() => {
    if (!want || names.length) return;
    let live = true;
    void fetchBusCatalog().then((n) => { if (live) setNames(n); }).catch(() => undefined);
    return () => { live = false; };
  }, [want, names.length]);
  return names;
}

const IDLE: Walk = { ids: [], corners: [], bus: [] };
/**
 * The open walk step's map features: the step's own `StepMap`, or one made from today's walk focus. With the
 * notice open and nothing being said, the notice's own tracks stay drawn (a shuttle notice then shows its whole
 * route, drawn by TransitLayer).
 */
function useNoticeMapFeatures(sys: StaticSystem | undefined, walk: Walk | null, alert: TransitAlert | null, route: string): NoticeMapFeatures | null {
  const step = useMemo(() => (sys && alert ? walk?.map ?? stepMapFrom(walk ?? IDLE, alert, sys, route || alert.routes[0] || "") : null), [sys, walk, alert, route]);
  const catalog = useCatalog(Boolean(step?.bus?.some((b) => !b.shuttle)));
  const ours = useMemo(() => [...new Set((step?.bus ?? []).filter((b) => !b.shuttle).flatMap((b) => busRoutesFor(b.route, catalog)))], [step, catalog]);
  const shapes = useBusShapes(ours) as unknown as BusShape[];
  return useMemo(() => {
    if (!step || !sys) return null;
    const byRoute = new Map(shapes.map((s) => [s.route.toUpperCase(), s]));
    return noticeMapFeatures(step, sys, { color: lineColor, catalog, busShape: (r) => byRoute.get(r.toUpperCase()) });
  }, [step, sys, catalog, shapes]);
}

const GLYPH: Record<string, string[]> = {
  // From the approved preview: an accessibility figure, a walking person, an elevator cab (crossed out when out).
  access: ["M16 4.5a1 1 0 1 0 0-.01", "M18 19l1-7-6 1", "M5 8l3-3 5.5 3-2.36 3.5", "M4.24 14.5a5 5 0 0 0 6.88 6", "M13.76 17.5a5 5 0 0 0-6.88-6"],
  walk: ["M12 5a1 1 0 1 0 0-.01", "M9 20l3-6 3 6", "M6 8l6 2 6-2", "M12 10v4"],
  elevOff: ["M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z", "M9.5 10l2.5-2.5 2.5 2.5", "M9.5 14l2.5 2.5 2.5-2.5", "M2.5 21.5L21.5 2.5"],
};

/** The walk's own map images, drawn once per map at twice the pixel density. */
function addNoticeIcons(map: MaplibreMap) {
  const draw = (id: string, size: number, paint: (c: CanvasRenderingContext2D, s: number) => void) => {
    if (map.hasImage(id)) return;
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return;
    ctx.canvas.width = ctx.canvas.height = size * 2;
    ctx.scale(2, 2);
    paint(ctx, size);
    map.addImage(id, ctx.getImageData(0, 0, size * 2, size * 2), { pixelRatio: 2 });
  };
  const ring = (c: CanvasRenderingContext2D, s: number, r: number, stroke: string, fill: string, w: number) => {
    c.beginPath(); c.arc(s / 2, s / 2, r, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); c.lineWidth = w; c.strokeStyle = stroke; c.stroke();
  };
  draw("notice-stop-stop", 12, (c, s) => ring(c, s, 3.8, "#e2e8f0", "#0e1726", 1.8));
  draw("notice-stop-extra", 14, (c, s) => ring(c, s, 4.5, "#ffffff", "#16a34a", 1.8));
  draw("notice-stop-closed", 14, (c, s) => ring(c, s, 4.5, "#64748b", "#0e1726", 2));
  draw("notice-stop-skip", 18, (c, s) => {
    ring(c, s, 6.5, "#ef4444", "#0e1726", 2.5);
    c.lineCap = "round"; c.lineWidth = 2.2; c.strokeStyle = "#ef4444";
    c.beginPath(); c.moveTo(s / 2 - 4, s / 2 - 4); c.lineTo(s / 2 + 4, s / 2 + 4); c.stroke();
  });
  // Points along the line's direction: line-placed symbols run their x-axis with the line.
  draw("notice-arrow", 10, (c) => {
    c.lineCap = "round"; c.lineJoin = "round"; c.lineWidth = 1.6; c.strokeStyle = "#f8fafc";
    c.beginPath(); c.moveTo(3, 1.5); c.lineTo(7, 5); c.lineTo(3, 8.5); c.stroke();
  });
  // Points up: rotated to the train's heading.
  draw("notice-heading", 18, (c) => {
    c.beginPath(); c.moveTo(9, 1.5); c.lineTo(16, 15); c.lineTo(9, 11.5); c.lineTo(2, 15); c.closePath();
    c.fillStyle = "#f8fafc"; c.fill(); c.lineWidth = 1.5; c.strokeStyle = "#0e1726"; c.stroke();
  });
  const badge = (id: string, glyph: string, fill: string) => draw(id, 26, (c, s) => {
    ring(c, s, 11, "#ffffff", fill, 2);
    c.save(); c.translate(s / 2 - 7.5, s / 2 - 7.5); c.scale(15 / 24, 15 / 24);
    c.lineWidth = 2.4; c.strokeStyle = "#ffffff"; c.lineCap = "round"; c.lineJoin = "round";
    for (const d of GLYPH[glyph]) c.stroke(new Path2D(d));
    c.restore();
  });
  badge("notice-access", "access", "#2563eb");
  badge("notice-walk", "walk", "#475569");
  badge("notice-elev-out", "elevOff", "#dc2626");
}

const TEXT: { "text-font": string[]; "text-size": number } = { "text-font": ["Noto Sans Bold"], "text-size": 12 };

/**
 * The open walk step on the map (plan step 4): tracks, signposts, the train, changes, buses, shuttle stops,
 * walking lines, entrances and station labels. Data comes from `useNoticeMapFeatures`.
 */
export default function NoticeMapLayers({ sys, walk, alert, route, theme }: { sys: StaticSystem | undefined; walk: Walk | null; alert: TransitAlert; route: string; theme: Palette }) {
  const fx = useNoticeMapFeatures(sys, walk, alert, route);
  // TransitLayer frames the camera on the step and stands its own marks down; it hears only when they change.
  const key = fx ? `${fx.bounds?.flat().map((x) => x.toFixed(4)).join(",") ?? ""}|${fx.tracks.features.length > 0}|${fx.busStops.features.map((f) => String(f.properties?.station)).join(",")}` : "";
  useEffect(() => {
    setNoticeMapView(fx ? { bounds: fx.bounds, tracks: fx.tracks.features.length > 0, busStations: fx.busStops.features.map((f) => String(f.properties?.station)) } : null);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => setNoticeMapView(null), []);
  return fx ? <Layers fx={fx} theme={theme} /> : null;
}

function Layers({ fx, theme }: { fx: NoticeMapFeatures; theme: Palette }) {
  const { current } = useMap();
  const map = current?.getMap();
  useEffect(() => {
    if (!map) return;
    const add = () => { addNoticeIcons(map); for (const l of fx.bullets) addBulletImage(map, bulletId(l, lineColor(l))); };
    add();
    map.on("styledata", add);
    return () => { map.off("styledata", add); };
  }, [map, fx.bullets]);
  const halo = { "text-halo-color": theme.dark ? "rgba(14,23,38,0.95)" : "rgba(255,255,255,0.95)", "text-halo-width": 2.2 } as const;
  const ink = theme.dark ? "#f1f5f9" : "#0f172a";
  return (
    <>
      <Source id="notice-walks" type="geojson" data={fx.walks}>
        <Layer id="notice-walk-line" type="line" layout={{ "line-cap": "round", "line-join": "round" }}
          paint={{ "line-color": theme.dark ? "#f8fafc" : "#1e293b", "line-width": 3, "line-dasharray": [0.6, 1.8] }} />
      </Source>
      <Source id="notice-buses" type="geojson" data={fx.buses}>
        <Layer id="notice-bus-line" type="line" layout={{ "line-cap": "round", "line-join": "round" }}
          paint={{ "line-color": ["case", ["get", "shuttle"], "#f59e0b", "#0ea5e9"], "line-width": 4, "line-opacity": 0.85,
            "line-dasharray": ["case", ["get", "shuttle"], ["literal", [1.2, 1.2]], ["literal", [1, 0]]] as never }} />
      </Source>
      <Source id="notice-tracks" type="geojson" data={fx.tracks}>
        {/* Two tracks, each to the right of the way it runs: the line-offset sign follows the line's own direction. */}
        {/* A dark bed over the line's own stroke, so the two tracks read apart at any zoom. */}
        <Layer id="notice-track-bed" type="line" filter={["==", ["get", "side"], 0]} layout={{ "line-cap": "round", "line-join": "round" }}
          paint={{ "line-color": theme.dark ? "#0e1726" : "#f8fafc", "line-width": LANE * 2 + 10, "line-opacity": 0.92 }} />
        <Layer id="notice-track" type="line" layout={{ "line-cap": "butt", "line-join": "round" }}
          paint={{ "line-color": ["get", "color"], "line-width": 3.5, "line-offset": LANE, "line-opacity": ["case", ["get", "closed"], 0.35, 0.95] }} />
        <Layer id="notice-track-arrow" type="symbol"
          layout={{ "symbol-placement": "line", "symbol-spacing": 70, "icon-image": "notice-arrow", "icon-offset": [0, LANE], "icon-allow-overlap": true, "icon-ignore-placement": true, "icon-rotation-alignment": "map" }} />
      </Source>
      <Source id="notice-closed" type="geojson" data={fx.closed}>
        <Layer id="notice-closed-line" type="line" layout={{ "line-cap": "butt" }}
          paint={{ "line-color": "#64748b", "line-width": 3, "line-offset": LANE, "line-dasharray": [1.5, 1.5] }} />
      </Source>
      <Source id="notice-track-stops" type="geojson" data={fx.trackStops}>
        <Layer id="notice-track-stop" type="symbol"
          layout={{ "icon-image": ["get", "icon"], "icon-offset": ["get", "offset"] as never, "icon-allow-overlap": true, "icon-ignore-placement": true, "symbol-sort-key": ["case", ["==", ["get", "state"], "skip"], 2, 1] }} />
      </Source>
      <Source id="notice-signposts" type="geojson" data={fx.signposts}>
        <Layer id="notice-signpost" type="symbol"
          layout={{ ...TEXT, "text-field": ["get", "text"], "text-size": 12.5, "text-offset": ["get", "offset"] as never, "text-allow-overlap": true }}
          paint={{ "text-color": "#0f172a", "text-halo-color": "#f8fafc", "text-halo-width": 4 }} />
      </Source>
      <Source id="notice-changes" type="geojson" data={fx.changes}>
        <Layer id="notice-change" type="circle" paint={{ "circle-radius": 8, "circle-color": "rgba(14,23,38,0.6)", "circle-stroke-color": "#60a5fa", "circle-stroke-width": 3 }} />
        <Layer id="notice-change-label" type="symbol"
          layout={{ ...TEXT, "text-size": 11, "text-field": ["get", "label"], "text-anchor": "top", "text-offset": [0, 1.3], "text-max-width": 12, "text-optional": true }}
          paint={{ "text-color": theme.dark ? "#93c5fd" : "#1d4ed8", ...halo }} />
      </Source>
      <Source id="notice-stations" type="geojson" data={fx.stations}>
        <Layer id="notice-station" type="circle" filter={["all", ["!", ["get", "onTrack"]], ["!", ["get", "skip"]]]}
          paint={{ "circle-radius": 4, "circle-color": "#0e1726", "circle-stroke-color": "#e2e8f0", "circle-stroke-width": 1.8 }} />
        <Layer id="notice-you" type="circle" filter={["get", "you"]}
          paint={{ "circle-radius": 14, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": theme.dark ? "#f8fafc" : "#0f172a", "circle-stroke-width": 2 }} />
      </Source>
      <Source id="notice-bus-stops" type="geojson" data={fx.busStops}>
        <Layer id="notice-bus-stop" type="circle"
          paint={{ "circle-radius": 6, "circle-color": ["case", ["get", "shuttle"], "#f59e0b", "#0284c7"], "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 }} />
        <Layer id="notice-bus-stop-label" type="symbol"
          layout={{ ...TEXT, "text-size": 11.5, "text-field": ["get", "label"], "text-variable-anchor": ["left", "right", "top", "bottom"], "text-radial-offset": 1, "text-justify": "auto", "text-max-width": 14, "text-optional": true }}
          paint={{ "text-color": ["case", ["get", "shuttle"], theme.dark ? "#fcd34d" : "#92400e", theme.dark ? "#7dd3fc" : "#0369a1"], ...halo }} />
      </Source>
      <Source id="notice-entrances" type="geojson" data={fx.entrances}>
        <Layer id="notice-entrance" type="symbol"
          layout={{ "icon-image": ["get", "icon"], "icon-allow-overlap": true, "icon-ignore-placement": true,
            ...TEXT, "text-field": ["get", "label"], "text-size": 11.5, "text-variable-anchor": ["left", "right", "top"], "text-radial-offset": 1.3, "text-justify": "auto", "text-max-width": 12, "text-optional": true }}
          paint={{ "text-color": ["case", ["==", ["get", "state"], "closed"], theme.dark ? "#fca5a5" : "#b91c1c", ink], ...halo }} />
      </Source>
      <Source id="notice-labels" type="geojson" data={fx.labels}>
        <Layer id="notice-label" type="symbol"
          layout={{ ...TEXT, "text-field": ["get", "label"], "text-variable-anchor": ["right", "left", "top", "bottom"], "text-radial-offset": 1.1, "text-justify": "auto", "text-max-width": 14,
            "symbol-sort-key": ["case", ["get", "change"], 0, ["get", "skip"], 1, 2] }}
          paint={{ "text-color": ["case", ["get", "skip"], theme.dark ? "#fca5a5" : "#b91c1c", ink], ...halo }} />
      </Source>
      <Source id="notice-train" type="geojson" data={fx.train}>
        <Layer id="notice-train-heading" type="symbol"
          layout={{ "icon-image": "notice-heading", "icon-rotate": ["get", "bearing"], "icon-rotation-alignment": "map", "icon-offset": [LANE, -24], "icon-allow-overlap": true, "icon-ignore-placement": true }} />
        <Layer id="notice-train-bullet" type="symbol"
          layout={{ "icon-image": ["get", "bullet"], "icon-size": 0.8, "icon-offset": ["get", "bulletOffset"] as never, "icon-allow-overlap": true, "icon-ignore-placement": true,
            ...TEXT, "text-field": ["get", "tag"], "text-anchor": "top", "text-offset": ["get", "tagOffset"] as never, "text-allow-overlap": true }}
          paint={{ "text-color": "#ffffff", "text-halo-color": ["get", "color"], "text-halo-width": 3 }} />
      </Source>
    </>
  );
}
