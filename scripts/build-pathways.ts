/**
 * Builds public/transit/pathways.json from the MTA's draft station data
 * (GTFS Pathways): what connects to what inside each subway station, with the
 * signs and the elevator numbers. The draft is not on a feed we can fetch; it
 * is the zip in the Google Drive folder linked from New York City Transit's
 * announcement of 2020-05-26 ("Draft NYCT subway GTFS-pathways data release",
 * mtadeveloperresources group). Unzip it and pass the folder:
 *
 *   pnpm build:pathways <folder with stops.txt and pathways.txt>
 *
 * The owner has the MTA's permission to use the draft (2026-11-20).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PATH_MODES, type NodeKind, type PathNode, type PathRow, type Pathways } from "../src/lib/transit/pathways";

/** An entrance further than this from its own station is a slip in the data; its place is dropped, the entrance kept. */
const MAX_ENTRANCE_M = 1000;

/** One CSV line into fields: commas inside double quotes stay, a doubled quote is a quote. */
function fields(line: string): string[] {
  const out: string[] = [];
  let cur = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') quoted = false; else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur);
  return out;
}

function table(path: string): Record<string, string>[] {
  const text = readFileSync(path, "utf8");
  // Some of the draft's files start with a byte-order mark.
  const lines = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).split(/\r?\n/).filter((l) => l.trim());
  const head = fields(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((l) => Object.fromEntries(fields(l).map((v, i) => [head[i], v.trim()])));
}

const metres = (a: [number, number], b: [number, number]): number =>
  Math.hypot((b[0] - a[0]) * 111_320 * Math.cos((a[1] * Math.PI) / 180), (b[1] - a[1]) * 110_540);

function main() {
  const dir = process.argv[2];
  if (!dir) throw new Error("Pass the folder that holds the draft's stops.txt and pathways.txt.");
  const stops = new Map(table(join(dir, "stops.txt")).map((s) => [s.stop_id, s]));
  const rows = table(join(dir, "pathways.txt"));

  const paths: PathRow[] = [];
  const used = new Set<string>();
  for (const r of rows) {
    const mode = Number(r.pathway_mode) - 1;
    if (!PATH_MODES[mode] || !r.from_stop_id || !r.to_stop_id) continue;
    paths.push([r.from_stop_id, r.to_stop_id, mode, r.is_bidirectional === "1" ? 1 : 0, r.signposted_as ?? "", r.reversed_signposted_as ?? "", (r.mta_equipment_id ?? "").toUpperCase()]);
    used.add(r.from_stop_id);
    used.add(r.to_stop_id);
  }

  /** Each station's own place: the average of its platforms', for judging an entrance's. */
  const place = (id: string): [number, number] | null => {
    const s = stops.get(id);
    const lat = Number(s?.stop_lat), lon = Number(s?.stop_lon);
    return s && s.stop_lat && s.stop_lon && Number.isFinite(lat) && Number.isFinite(lon) ? [lon, lat] : null;
  };
  /** The points an entrance is joined to, a few steps out, that have a place: enough to tell a slip from a long passage. */
  const near = new Map<string, string[]>();
  for (const p of paths) { (near.get(p[0]) ?? near.set(p[0], []).get(p[0])!).push(p[1]); (near.get(p[1]) ?? near.set(p[1], []).get(p[1])!).push(p[0]); }
  const placedNear = (id: string): [number, number][] => {
    const seen = new Set([id]); let edge = [id]; const got: [number, number][] = [];
    for (let depth = 0; depth < 6 && edge.length; depth++) {
      const next: string[] = [];
      for (const a of edge) for (const b of near.get(a) ?? []) if (!seen.has(b)) { seen.add(b); next.push(b); const at = place(b); if (at) got.push(at); }
      edge = next;
    }
    return got;
  };

  const nodes: Record<string, PathNode> = {};
  let dropped = 0;
  for (const id of [...used].sort()) {
    const s = stops.get(id);
    const type = s?.location_type ?? "";
    const kind: NodeKind = type === "2" ? "e" : type === "3" || type === "4" ? "n" : "p";
    const node: PathNode = { name: s?.stop_name ?? id, kind };
    const at = place(id);
    if (at && kind === "e") {
      const others = placedNear(id);
      if (others.length && Math.min(...others.map((o) => metres(at, o))) > MAX_ENTRANCE_M) dropped++;
      else node.at = [Number(at[0].toFixed(6)), Number(at[1].toFixed(6))];
    } else if (at && kind === "p") node.at = [Number(at[0].toFixed(6)), Number(at[1].toFixed(6))];
    nodes[id] = node;
  }

  const out: Pathways = { source: "MTA New York City Transit, draft GTFS-Pathways (announced 2020-05-26; files dated 2021-10-11)", nodes, paths };
  writeFileSync("public/transit/pathways.json", JSON.stringify(out));
  const kinds = Object.values(nodes).reduce<Record<string, number>>((n, x) => ({ ...n, [x.kind]: (n[x.kind] ?? 0) + 1 }), {});
  console.log(`pathways.json: ${paths.length} pathways, ${Object.keys(nodes).length} points (${kinds.p ?? 0} platforms, ${kinds.e ?? 0} entrances, ${kinds.n ?? 0} inside); ${dropped} entrance place(s) dropped as slips`);
}

main();
