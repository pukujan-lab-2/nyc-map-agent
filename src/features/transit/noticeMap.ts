import { formatStationName, formatStreetText } from "@/lib/streetName";
import { inManhattan, otherDirection, towardEnd } from "@/lib/transit/serviceChanges";
import { noticeSkips, routeEnds, skippedStations } from "./alertFocus";
import type { TransitAlert } from "./hooks";
import type { StaticSystem } from "./model";
import { bulletId } from "@/lib/transit/bullets";
import type { StepMap } from "./walkMap";

/**
 * The notice walk on the map (step 4 of `docs/PLAN-notice-walks.md`): one walk step's `StepMap` turned into the
 * features `NoticeMapLayers` draws, matching the approved preview (`docs/design/notice-walks-preview.html`).
 *
 * - The line's two tracks over the stretch, each offset to the right of the way it runs (trains keep right),
 *   with arrows, and a signpost beside each track's far end naming where it goes ("Flushing side").
 * - Skipped stops crossed out on the skipping track only; extra stops dotted green; closed stretches dashed.
 * - The rider's train on its track, an arrow ahead of it and a tag saying which way it runs ("to Flushing").
 * - Change markers, bus routes from our bus data with the stop to use, temporary shuttle stops at the MTA's
 *   corners, walking lines, and entrances: the elevator that is out, the one to use, stairs.
 * - Station labels, with the line added when two stations in view share a name.
 *
 * Pure: everything here is testable without a map. Offsets are screen pixels for a north-up map (the notice
 * camera frames with bearing 0); point symbols use `icon-offset`, lines `line-offset`.
 */

type Pos = [number, number];
type Props = Record<string, string | number | boolean | number[]>;
type Point = GeoJSON.Feature<GeoJSON.Point, Props>;
type Line = GeoJSON.Feature<GeoJSON.LineString, Props>;
const fc = <T extends GeoJSON.Feature>(features: T[]): GeoJSON.FeatureCollection<T["geometry"], Props> => ({ type: "FeatureCollection", features }) as never;
const pt = (coordinates: Pos, properties: Props): Point => ({ type: "Feature", properties, geometry: { type: "Point", coordinates } });
const ln = (coordinates: Pos[], properties: Props): Line => ({ type: "Feature", properties, geometry: { type: "LineString", coordinates } });

/** Pixels between a track and the line's middle. */
export const LANE = 7;
/** Metres of track drawn past the first and last station a step names. */
const PAD_M = 450;

/** A bus route's shape and stops as `/api/transit/bus-route` serves them. */
export type BusShape = { route: string; lines: Pos[][]; stops: Array<{ id?: string; name: string; lon: number; lat: number }> };

/**
 * Our bus routes for the name a notice uses. Notices say "M14"; our data has M14A+ and M14D+ (Select Bus
 * Service variants), so a name with no exact match takes every lettered or "+" variant, the "+" one when a
 * route has both. "shuttle" and a temporary shuttle (B109, L92) match nothing and are drawn from their stops.
 */
export function busRoutesFor(name: string, catalog: readonly string[]): string[] {
  const want = name.trim().toUpperCase();
  if (!want || want === "SHUTTLE") return [];
  const exact = catalog.find((r) => r.toUpperCase() === want);
  if (exact) return [exact];
  const variants = catalog.filter((r) => new RegExp(`^${want.replace(/[^A-Z0-9]/g, "")}[A-Z]?\\+?$`).test(r.toUpperCase()));
  return variants.filter((r) => r.endsWith("+") || !variants.includes(`${r}+`));
}

const metres = (a: Pos, b: Pos) => Math.hypot((a[0] - b[0]) * 111_320 * Math.cos((a[1] * Math.PI) / 180), (a[1] - b[1]) * 110_540);

/** The shape of `line` from measure `m0` to `m1`, in that order (so the track runs that way). */
function shapeRun(sys: StaticSystem, line: string, m0: number, m1: number): Pos[] {
  const s = sys.shapes[line];
  if (!s) return [];
  const lo = Math.min(m0, m1), hi = Math.max(m0, m1);
  const run = s.c.filter((_, i) => s.m[i] >= lo && s.m[i] <= hi) as Pos[];
  return m1 >= m0 ? run : run.reverse();
}

/** The way a track runs at measure `m`, as a unit east/north vector. */
function headingAt(sys: StaticSystem, line: string, m: number, up: boolean): Pos {
  const s = sys.shapes[line];
  if (!s?.c.length) return [0, 1];
  let i = s.m.findIndex((x) => x >= m);
  if (i < 0) i = s.m.length - 1;
  const a = s.c[Math.max(0, i - 2)] as Pos, b = s.c[Math.min(s.c.length - 1, i + 2)] as Pos;
  const k = Math.cos((a[1] * Math.PI) / 180);
  let e = (b[0] - a[0]) * k, n = b[1] - a[1];
  const L = Math.hypot(e, n) || 1;
  e /= L; n /= L;
  return up ? [e, n] : [-e, -n];
}

/** Screen pixels (x right, y down) to the right of travel, for a north-up map. */
function rightOf(h: Pos, px: number): Pos {
  // Right of (east, north) is (north, -east); on screen north is up, so y flips.
  return [round(h[1] * px), round(h[0] * px)];
}
const round = (x: number) => Math.round(x * 10) / 10;
const bearingOf = (h: Pos) => (Math.atan2(h[0], h[1]) * 180) / Math.PI;
const ARROWS = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];
const arrowOf = (h: Pos) => ARROWS[Math.round((((bearingOf(h) % 360) + 360) % 360) / 45) % 8];

/**
 * The name riders use for each direction of `line`: [toward the low-measure end, toward the high one].
 * A notice's own label wins ("Flushing"); the other side is "Manhattan" when only it is in Manhattan,
 * else the first word of its terminal ("Coney Island-Stillwell Av" -> "Coney Island"). "uptown" and
 * "downtown" pick an end by latitude.
 */
export function sideNames(sys: StaticSystem, line: string, toward: string | null): [string, string] {
  const ends = routeEnds(sys, line);
  if (ends.length !== 2) return ["", ""];
  const plain = (i: 0 | 1) => (inManhattan(ends[i].at) && !inManhattan(ends[1 - i].at) ? "Manhattan" : ends[i].name.split(/[-/]/)[0].trim());
  const names: [string, string] = [plain(0), plain(1)];
  if (!toward) return names;
  const north: 0 | 1 = ends[0].at[1] > ends[1].at[1] ? 0 : 1;
  const i = /^uptown$/i.test(toward) ? north : /^downtown$/i.test(toward) ? ((1 - north) as 0 | 1) : towardEnd(toward, ends);
  if (i === null) return names;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  names[i] = cap(toward);
  if (!/^(?:up|down)town$/i.test(toward)) names[1 - i] = otherDirection(toward, ends);
  else names[1 - i] = /^uptown$/i.test(toward) ? "Downtown" : "Uptown";
  return names;
}

/** Index of the direction a label names (0 = toward the low-measure end), or null for both or unknown. */
function sideOf(sys: StaticSystem, line: string, toward: string | null): 0 | 1 | null {
  if (!toward) return null;
  const names = sideNames(sys, line, toward);
  const t = toward.toLowerCase();
  if (names[0].toLowerCase() === t) return 0;
  if (names[1].toLowerCase() === t) return 1;
  return null;
}

export interface NoticeMapFeatures {
  stations: GeoJSON.FeatureCollection;
  labels: GeoJSON.FeatureCollection;
  tracks: GeoJSON.FeatureCollection;
  trackStops: GeoJSON.FeatureCollection;
  signposts: GeoJSON.FeatureCollection;
  closed: GeoJSON.FeatureCollection;
  train: GeoJSON.FeatureCollection;
  changes: GeoJSON.FeatureCollection;
  buses: GeoJSON.FeatureCollection;
  busStops: GeoJSON.FeatureCollection;
  walks: GeoJSON.FeatureCollection;
  entrances: GeoJSON.FeatureCollection;
  /** The lines whose train bullets the layer needs as images. */
  bullets: string[];
  bounds: [Pos, Pos] | null;
}

const CHANGE_WORDS = { cross: "Cross to the other platform", same: "Same platform", line: "Change", bus: "Change to the bus" } as const;

/**
 * Every feature one step draws. `color` gives a line's colour; `busShape` gives a loaded bus route (our
 * route name, after `busRoutesFor`), or undefined while it loads.
 */
export function noticeMapFeatures(
  map: StepMap,
  sys: StaticSystem,
  opts: { color: (line: string) => string; catalog?: readonly string[]; busShape?: (route: string) => BusShape | undefined },
): NoticeMapFeatures {
  const byId = new Map(sys.stations.features.map((f) => [f.properties.id, f]));
  const at = (id: string) => byId.get(id)?.geometry.coordinates as Pos | undefined;
  const nameOf = (id: string) => formatStationName(String(byId.get(id)?.properties.name ?? id));
  const all: Pos[] = [];
  const keep = (p: Pos | undefined) => { if (p) all.push(p); return p; };

  // A station named by another line's id in the same complex (Queensboro Plaza is 718 on the 7, R09 on the N).
  const onLine = (id: string, line: string): string => {
    const sm = sys.stopM[line] ?? {};
    if (sm[id] !== undefined) return id;
    const p = at(id);
    if (!p) return id;
    const near = Object.keys(sm).map((o) => ({ o, d: at(o) ? metres(at(o)!, p) : Infinity })).sort((x, y) => x.d - y.d)[0];
    return near && near.d < 350 ? near.o : id;
  };
  const tracks: Line[] = [], trackStops: Point[] = [], signposts: Point[] = [], closed: Line[] = [], train: Point[] = [];
  const onTrack = new Set<string>();
  const skipIds = new Set<string>();
  for (const t0 of map.tracks ?? []) {
    const t = { ...t0, from: onLine(t0.from, t0.line), to: onLine(t0.to, t0.line), skip: t0.skip?.map((id) => onLine(id, t0.line)), stops: t0.stops?.map((id) => onLine(id, t0.line)) };
    const sm = sys.stopM[t.line];
    if (!sm || sm[t.from] === undefined || sm[t.to] === undefined) continue;
    const end = Math.max(...Object.values(sm));
    const lo = Math.max(0, Math.min(sm[t.from], sm[t.to]) - PAD_M), hi = Math.min(end, Math.max(sm[t.from], sm[t.to]) + PAD_M);
    const names = sideNames(sys, t.line, t.toward);
    const changed = sideOf(sys, t.line, t.toward);
    const color = opts.color(t.line);
    // side 0 runs toward the low-measure end, side 1 toward the high one.
    for (const side of [0, 1] as const) {
      const up = side === 1;
      const run = shapeRun(sys, t.line, up ? lo : hi, up ? hi : lo);
      if (run.length < 2) continue;
      const hit = changed === null || changed === side;
      const shut = Boolean(t.closed) && hit;
      tracks.push(ln(run, { line: t.line, color, side, closed: shut, toward: names[side] }));
      if (shut) closed.push(ln(run, { line: t.line }));
      run.forEach((p) => all.push(p));
      // The signpost stands beside its own track, past the stretch's far end in the way that track runs.
      const farM = up ? hi : lo;
      const h = headingAt(sys, t.line, farM, up);
      const off = rightOf(h, LANE + 20);
      // Its arrow points from the middle of the stretch to that end: the way riders see the track go, not a last bend.
      const mid = run[Math.floor(run.length / 2)], far = run[run.length - 1];
      const k = Math.cos((far[1] * Math.PI) / 180);
      const way: Pos = [(far[0] - mid[0]) * k, far[1] - mid[1]];
      signposts.push(pt(far, { text: `${arrowOf(way)} ${names[side]} side`, side, offset: [round(off[0] / 12.5), round(off[1] / 12.5)], skipping: hit && Boolean(t.skip?.length || t.closed) }));
      for (const [id, m] of Object.entries(sm)) {
        const p = at(id);
        if (!p || m < lo || m > hi) continue;
        onTrack.add(id);
        const o = rightOf(headingAt(sys, t.line, m, up), LANE);
        const state = hit && t.skip?.includes(id) ? "skip" : hit && t.stops?.includes(id) ? "extra" : shut ? "closed" : "stop";
        if (state === "skip") skipIds.add(id);
        trackStops.push(pt(p, { id, side, state, icon: `notice-stop-${state}`, offset: o }));
      }
    }
  }

  if (map.ride) {
    // A rerouted train (the A over the F from Delancey St) runs on the track of a line that serves both ends.
    const routesAt = (id: string) => String(byId.get(id)?.properties.routes ?? "").split(/[\s,]+/).filter(Boolean);
    const both = (l: string) => sys.stopM[l]?.[onLine(map.ride!.from, l)] !== undefined && sys.stopM[l]?.[onLine(map.ride!.to, l)] !== undefined;
    const track = [map.ride.line, ...routesAt(map.ride.from), ...routesAt(map.ride.to)].find(both) ?? map.ride.line;
    const r = { ...map.ride, track, from: onLine(map.ride.from, track), to: onLine(map.ride.to, track) }, sm = sys.stopM[track] ?? {};
    const p = keep(at(r.from));
    if (p && sm[r.from] !== undefined && sm[r.to] !== undefined) {
      const up = sm[r.to] >= sm[r.from];
      const h = headingAt(sys, r.track, sm[r.from], up);
      const o = rightOf(h, LANE);
      const toward = r.toward ?? sideNames(sys, r.track, null)[up ? 1 : 0];
      const color = opts.color(r.line);
      train.push(pt(p, { line: r.line, color, bullet: bulletId(r.line, color), bulletOffset: [round(o[0] / 0.8), round(o[1] / 0.8)], bearing: round(bearingOf(h)), tag: toward ? `to ${toward}` : "", tagOffset: [round(o[0] / 12), round(o[1] / 12 + 1.1)] }));
      keep(at(r.to));
    } else if (p && at(r.to)) {
      // No one line runs from one end to the other (a reroute over two lines): the train at its start,
      // pointing straight at where it is going.
      const q = at(r.to)!, k = Math.cos((p[1] * Math.PI) / 180);
      const e = (q[0] - p[0]) * k, n = q[1] - p[1], L = Math.hypot(e, n) || 1;
      const color = opts.color(r.line);
      train.push(pt(p, { line: r.line, color, bullet: bulletId(r.line, color), bulletOffset: [0, 0], bearing: round(bearingOf([e / L, n / L])), tag: r.toward ? `to ${r.toward}` : "", tagOffset: [0, 1.1] }));
      keep(q);
    }
  }

  const changes: Point[] = [];
  for (const c of map.change ?? []) {
    const p = keep(at(c.at));
    if (!p) continue;
    const label = c.kind === "line" && c.to?.length ? `Change to the ${c.to.join(", ")}` : CHANGE_WORDS[c.kind];
    changes.push(pt(p, { id: c.at, kind: c.kind, label }));
  }

  const buses: Line[] = [], busStops: Point[] = [];
  for (const b of map.bus ?? []) {
    const ours = b.shuttle ? [] : busRoutesFor(b.route, opts.catalog ?? []);
    const shapes = ours.map((r) => opts.busShape?.(r)).filter((s): s is BusShape => Boolean(s));
    const stopPts = b.stops.map((s) => ({ ...s, p: keep(at(s.station)) })).filter((s): s is typeof s & { p: Pos } => Boolean(s.p));
    if (shapes.length) {
      for (const s of shapes) for (const l of s.lines) buses.push(ln(l, { route: b.route, ours: s.route, shuttle: false }));
      // The stop to use: our nearest stop of that route to each station the step names.
      for (const s of stopPts) {
        const near = shapes.flatMap((g) => g.stops).map((q) => ({ q, d: metres([q.lon, q.lat], s.p) })).sort((x, y) => x.d - y.d)[0];
        const p = near && near.d < 600 ? ([near.q.lon, near.q.lat] as Pos) : s.p;
        busStops.push(pt(keep(p)!, { route: b.route, station: s.station, shuttle: false, label: `${b.route}${s.corner ? `: ${formatStreetText(s.corner)}` : near && near.d < 600 ? `: ${formatStreetText(near.q.name)}` : ""}` }));
      }
    } else {
      // A shuttle, or a route not loaded yet: the bus runs stop to stop through the stations it serves.
      if (stopPts.length > 1) buses.push(ln(stopPts.map((s) => s.p), { route: b.route, ours: "", shuttle: true }));
      for (const s of stopPts) {
        const name = b.shuttle ? (/^shuttle$/i.test(b.route) ? "Shuttle bus" : `${b.route} shuttle`) : b.route;
        busStops.push(pt(s.p, { route: b.route, station: s.station, shuttle: b.shuttle, label: s.corner ? `${name}: ${formatStreetText(s.corner)}` : name }));
      }
    }
  }

  const walks: Line[] = [];
  for (const w of map.walk ?? []) {
    const a = keep(at(w.from)), b = keep(at(w.to));
    if (a && b) walks.push(ln([a, b], { from: w.from, to: w.to }));
  }

  const entrances: Point[] = [];
  const ents = sys.entrances?.features ?? [];
  for (const e of map.entrances ?? []) {
    let p: Pos | undefined = e.at;
    let kind = "";
    if (!p && e.id && /^\d+$/.test(e.id)) {
      const f = ents[Number(e.id)];
      if (f) { p = f.geometry.coordinates as Pos; kind = f.properties.kind; }
    }
    if (!p) {
      const elevators = ents.filter((f) => f.properties.id === (e.id ?? e.station) && /levator/i.test(f.properties.kind));
      if (elevators.length === 1) { p = elevators[0].geometry.coordinates as Pos; kind = elevators[0].properties.kind; }
    }
    if (p && !kind) kind = ents.find((f) => metres(f.geometry.coordinates as Pos, p!) < 3)?.properties.kind ?? "Elevator";
    const mapped = Boolean(p);
    p ??= at(e.station);
    if (!keep(p)) continue;
    const elevator = /levator/i.test(kind || "Elevator");
    const icon = e.state === "closed" ? "notice-elev-out" : elevator ? "notice-access" : "notice-walk";
    const what = e.state === "closed" ? (elevator ? "Elevator out" : "Entrance closed") : elevator ? "Elevator to use" : "Stairs to use";
    entrances.push(pt(p!, { station: e.station, id: e.id ?? "", state: e.state, icon, label: mapped ? what : `${what}: not on our map` }));
  }

  // Stations: every one the step names, the rider's ringed; skipped ones are drawn on their track instead.
  const stationIds = [...new Set([...map.stations, ...(map.you ? [map.you] : [])])];
  const stations: Point[] = [], labels: Point[] = [];
  const lineFor = (id: string) => {
    const routes = String(byId.get(id)?.properties.routes ?? "").split(/[\s,]+/).filter(Boolean);
    return [...map.lines, ...(map.tracks ?? []).map((t) => t.line), map.ride?.line ?? ""].find((l) => l && routes.includes(l)) ?? routes[0] ?? "";
  };
  const shown = stationIds.filter((id) => at(id));
  for (const id of shown) {
    const p = keep(at(id))!;
    // Two stations with one name, in this step or within 3 km of each other: say the line too ("86 St (4)").
    // One complex can hold two ids under one name (59 St-Columbus Circle on the A and the 1): those are not twins.
    const twin = sys.stations.features.some((f) => {
      if (f.properties.id === id || formatStationName(String(f.properties.name)) !== nameOf(id)) return false;
      const d = metres(f.geometry.coordinates as Pos, p);
      return d > 300 && (shown.includes(f.properties.id) || d < 3000);
    });
    const line = twin ? lineFor(id) : "";
    stations.push(pt(p, { id, you: id === map.you, onTrack: onTrack.has(id), skip: skipIds.has(id) }));
    labels.push(pt(p, { id, label: line ? `${nameOf(id)} (${line})` : nameOf(id), skip: skipIds.has(id), change: (map.change ?? []).some((c) => c.at === id) }));
  }

  const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
  return {
    stations: fc(stations), labels: fc(labels), tracks: fc(tracks), trackStops: fc(trackStops), signposts: fc(signposts),
    closed: fc(closed), train: fc(train), changes: fc(changes), buses: fc(buses), busStops: fc(busStops), walks: fc(walks),
    entrances: fc(entrances), bullets: [...new Set(train.map((t) => String(t.properties.line)))],
    bounds: all.length ? [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]] : null,
  };
}

/**
 * Until the walk builder (plan step 3) puts a `StepMap` on each step: one from today's walk focus (the step's
 * stations, its shuttle corners, the buses it names) and the open notice (a skip's tracks and train).
 */
export function stepMapFrom(
  walk: { ids: string[]; corners: Array<{ id: string; text: string }>; bus: string[] },
  alert: TransitAlert | null,
  sys: StaticSystem,
  route: string,
): StepMap {
  const map: StepMap = { stations: [...walk.ids], lines: route ? [route] : [] };
  const skip = alert ? noticeSkips(alert, route).find((c) => c.toward) ?? noticeSkips(alert, route)[0] : undefined;
  const sm = sys.stopM[route];
  if (alert && skip && sm) {
    const skipped = skippedStations(alert, sys, route).filter((id) => sm[id] !== undefined);
    if (skipped.length) {
      const seq = Object.keys(sm).sort((a, b) => sm[a] - sm[b]);
      const idx = skipped.map((id) => seq.indexOf(id));
      const from = seq[Math.max(0, Math.min(...idx) - 1)], to = seq[Math.min(seq.length - 1, Math.max(...idx) + 1)];
      map.tracks = [{ line: route, from, to, toward: skip.toward, skip: skipped }];
      const side = sideOf(sys, route, skip.toward);
      if (side !== null) map.ride = side === 1 ? { line: route, from, to, toward: skip.toward } : { line: route, from: to, to: from, toward: skip.toward };
      for (const id of [from, to]) if (!map.stations.includes(id)) map.stations.push(id);
    }
  }
  if (walk.bus.length) map.bus = walk.bus.map((r) => ({ route: r, shuttle: false, stops: [] }));
  const corners = new Map<string, string[]>();
  for (const c of walk.corners) corners.set(c.id, [...(corners.get(c.id) ?? []), c.text]);
  if (corners.size) (map.bus ??= []).push({ route: alert?.replacement?.[0] ?? "shuttle", shuttle: true, stops: [...corners].map(([station, t]) => ({ station, corner: t.join("; ") })) });
  return map;
}
