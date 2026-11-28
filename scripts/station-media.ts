/**
 * Photos, videos and sensor logs taken inside stations: puts them in Octo files and
 * catalogues them in core.station_media and core.navilens_sightings, so they can be
 * found by station, by words, or by NaviLens code.
 *
 *   pnpm media:publish ingest/station-media/<collection>.json <folder with the prepared files>
 *   pnpm media:find [words...]      e.g. `pnpm media:find 86 elevator`
 *   pnpm media:codes                every NaviLens code we have seen, and where
 *
 * The manifest says what each file is; this script adds its size, checksum and Octo
 * file id. Files go up under station-media/<collection>/ and stay private (never
 * published). A file already in Octo under the same name and size is reused, so a
 * second run only updates the catalogue. docs/STATION_MEDIA.md explains the rest.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { octoConfigFromEnv, octoOrigin, octoQuery } from "../api/_lib/octo";
import { loadEnv } from "./env";

export const KINDS = ["photo", "video", "screenshot", "sensor-log", "walk"] as const;
export const CONFIDENCE = ["photo-read", "video-matches-photo", "video-read-only", "not-read"] as const;
type Kind = (typeof KINDS)[number];
type Confidence = (typeof CONFIDENCE)[number];

export interface Sighting {
  at_s?: number;
  box?: [number, number, number, number];
  confidence: Confidence;
  pattern?: string;
  raw_read?: string;
  place: string;
  crop?: string;
}

export interface MediaEntry {
  stem: string;
  file: string;
  kind: Kind;
  original_name: string;
  original_bytes?: number;
  station: string | null;
  stop_id: string | null;
  station_note?: string;
  title: string;
  place: string | null;
  taken_at?: string;
  duration_s?: number;
  width?: number;
  height?: number;
  faces_blurred: boolean;
  equipment_id?: string;
  tags: string[];
  navilens?: Sighting[];
}

export interface Manifest {
  collection: string;
  source: string;
  prepared?: string;
  files: MediaEntry[];
}

const CODE = /^[CMYK]{25}$/;
/** Collection names and file names become Octo names: letters, digits, dots, dashes and one folder level for crops. */
const SAFE_COLLECTION = /^[a-z0-9][a-z0-9-]{2,80}$/;
const SAFE_FILE = /^(codes\/)?[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/;

/** The pattern turned a quarter turn clockwise; the same turn the NaviLens reader (src/lib/navilens/read.ts) uses. */
export function turned(pattern: string): string {
  let out = "";
  for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++) out += pattern[(4 - col) * 5 + row];
  return out;
}

/** One key per code however the phone was held: the rotation that sorts first. */
export function patternKey(pattern: string): string {
  let best = pattern;
  let p = pattern;
  for (let k = 0; k < 3; k++) {
    p = turned(p);
    if (p < best) best = p;
  }
  return best;
}

/** Cells that differ between two patterns, at the rotation where they differ least. */
export function cellsApart(a: string, b: string): number {
  let best = 25;
  let p = a;
  for (let k = 0; k < 4; k++) {
    let d = 0;
    for (let i = 0; i < 25; i++) if (p[i] !== b[i]) d++;
    best = Math.min(best, d);
    p = turned(p);
  }
  return best;
}

export function octoName(collection: string, file: string): string {
  return `station-media/${collection}/${file}`;
}

export function mimeFor(file: string): string {
  const ext = file.toLowerCase().split(".").pop();
  const types: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    mp4: "video/mp4",
    gz: "application/gzip",
    xz: "application/x-xz",
    json: "application/json",
  };
  return types[ext ?? ""] ?? "application/octet-stream";
}

/** Everything wrong with a manifest, in plain sentences; empty when it is fine. */
export function checkManifest(m: Manifest): string[] {
  const errors: string[] = [];
  if (!SAFE_COLLECTION.test(m.collection ?? "")) errors.push(`collection "${m.collection}" must be lower-case letters, digits and dashes.`);
  if (!m.source) errors.push("source must say who sent the files and from where.");
  const stems = new Set<string>();
  for (const f of m.files ?? []) {
    const at = `file ${f.stem ?? "?"}:`;
    if (stems.has(f.stem)) errors.push(`${at} the stem is used twice.`);
    stems.add(f.stem);
    if (!SAFE_FILE.test(f.file ?? "") || f.file.startsWith("codes/")) errors.push(`${at} file "${f.file}" is not a plain file name.`);
    if (!KINDS.includes(f.kind)) errors.push(`${at} kind must be one of ${KINDS.join(", ")}.`);
    if (!f.title) errors.push(`${at} it needs a title.`);
    if (!f.station && !f.station_note) errors.push(`${at} with no station, station_note must say why.`);
    if (f.taken_at && Number.isNaN(Date.parse(f.taken_at))) errors.push(`${at} taken_at is not a date.`);
    (f.navilens ?? []).forEach((s, i) => {
      const where = `${at} code ${i + 1}:`;
      if (!CONFIDENCE.includes(s.confidence)) errors.push(`${where} confidence must be one of ${CONFIDENCE.join(", ")}.`);
      const trusted = s.confidence === "photo-read" || s.confidence === "video-matches-photo";
      if (trusted !== (s.pattern !== undefined)) errors.push(`${where} a pattern belongs only on photo-read and video-matches-photo codes.`);
      if (s.pattern !== undefined && !CODE.test(s.pattern)) errors.push(`${where} pattern must be 25 of C, M, Y, K.`);
      if (s.raw_read !== undefined && !CODE.test(s.raw_read)) errors.push(`${where} raw_read must be 25 of C, M, Y, K.`);
      if (s.confidence === "video-matches-photo" && s.pattern && s.raw_read && cellsApart(s.raw_read, s.pattern) > 4)
        errors.push(`${where} the video read is more than 4 cells from the pattern it claims to match.`);
      if (s.box && (s.box.length !== 4 || s.box.some((n) => !Number.isInteger(n) || n < 0))) errors.push(`${where} box must be four whole pixel numbers.`);
      if (s.crop && (!SAFE_FILE.test(s.crop) || !s.crop.startsWith("codes/"))) errors.push(`${where} crop must be a file under codes/.`);
      if (!s.place) errors.push(`${where} it needs a place.`);
    });
  }
  if (!m.files?.length) errors.push("the manifest lists no files.");
  return errors;
}

export interface Stored {
  id: string;
  bytes: number;
  sha256: string;
}

/** The catalogue rows for a manifest, given what each file became in Octo. */
export function catalogRows(m: Manifest, stored: ReadonlyMap<string, Stored>) {
  const need = (file: string): Stored => {
    const s = stored.get(file);
    if (!s) throw new Error(`${file} was not stored`);
    return s;
  };
  const media = m.files.map((f) => {
    const s = need(f.file);
    return {
      id: `${m.collection}/${f.stem}`,
      collection: m.collection,
      station: f.station,
      stop_id: f.stop_id,
      station_note: f.station_note ?? null,
      kind: f.kind,
      title: f.title,
      place: f.place,
      octo_file_id: s.id,
      octo_name: octoName(m.collection, f.file),
      mime_type: mimeFor(f.file),
      bytes: s.bytes,
      sha256: s.sha256,
      original_name: f.original_name,
      original_bytes: f.original_bytes ?? null,
      taken_at: f.taken_at ?? null,
      duration_s: f.duration_s ?? null,
      width: f.width ?? null,
      height: f.height ?? null,
      faces_blurred: f.faces_blurred,
      equipment_id: f.equipment_id ?? null,
      source: m.source,
      tags: f.tags,
    };
  });
  const sightings = m.files.flatMap((f) =>
    (f.navilens ?? []).map((s, i) => ({
      media_id: `${m.collection}/${f.stem}`,
      seq: i + 1,
      at_s: s.at_s ?? null,
      box: s.box ?? null,
      pattern: s.pattern ?? null,
      pattern_key: s.pattern ? patternKey(s.pattern) : null,
      confidence: s.confidence,
      raw_read: s.raw_read ?? null,
      place: s.place,
      crop_file_id: s.crop ? need(s.crop).id : null,
    })),
  );
  return { media, sightings };
}

/** Every file the manifest names: the media themselves and the code crops. */
export function filesOf(m: Manifest): string[] {
  return [...m.files.map((f) => f.file), ...m.files.flatMap((f) => (f.navilens ?? []).flatMap((s) => (s.crop ? [s.crop] : [])))];
}

interface OctoFile {
  id: string;
  name: string;
  sizeBytes: number;
}

async function octoFetch(path: string, init: RequestInit = {}): Promise<unknown> {
  const cfg = octoConfigFromEnv();
  const res = await fetch(`${octoOrigin()}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${cfg.apiKey}`, "content-type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(600_000),
  });
  if (!res.ok) throw new Error(`Octo ${path.split("?")[0]} answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function publish(manifestPath: string, folder: string): Promise<void> {
  const m = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
  const errors = checkManifest(m);
  if (errors.length) throw new Error(`The manifest is not ready:\n- ${errors.join("\n- ")}`);
  const { workspaceId } = octoConfigFromEnv();
  const existing = (await octoFetch(`/api/files?workspaceId=${workspaceId}&limit=1000`)) as OctoFile[];
  const stored = new Map<string, Stored>();
  for (const file of filesOf(m)) {
    const bytes = readFileSync(join(folder, file));
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const name = octoName(m.collection, file);
    const same = existing.find((f) => f.name === name && f.sizeBytes === bytes.length);
    let id = same?.id;
    if (!id) {
      const up = (await octoFetch("/api/files/upload", {
        method: "POST",
        body: JSON.stringify({ workspaceId, name, mimeType: mimeFor(file), data: bytes.toString("base64"), dataEncoding: "base64" }),
      })) as { id: string };
      id = String(up.id);
    }
    stored.set(file, { id, bytes: bytes.length, sha256 });
    console.log(`${same ? "kept    " : "uploaded"} ${name} (${(bytes.length / 1e6).toFixed(2)} MB)`);
  }
  const { media, sightings } = catalogRows(m, stored);
  await octoQuery(
    `INSERT INTO core.station_media (id, collection, station, stop_id, station_note, kind, title, place, octo_file_id, octo_name,
       mime_type, bytes, sha256, original_name, original_bytes, taken_at, duration_s, width, height, faces_blurred, equipment_id, source, tags)
     SELECT r.id, r.collection, r.station, r.stop_id, r.station_note, r.kind, r.title, r.place, r.octo_file_id, r.octo_name,
       r.mime_type, r.bytes, r.sha256, r.original_name, r.original_bytes, r.taken_at, r.duration_s, r.width, r.height, r.faces_blurred,
       r.equipment_id, r.source, ARRAY(SELECT jsonb_array_elements_text(r.tags))
     FROM jsonb_to_recordset($1::jsonb) AS r(id text, collection text, station text, stop_id text, station_note text, kind text, title text,
       place text, octo_file_id text, octo_name text, mime_type text, bytes bigint, sha256 text, original_name text, original_bytes bigint,
       taken_at timestamptz, duration_s real, width integer, height integer, faces_blurred boolean, equipment_id text, source text, tags jsonb)
     ON CONFLICT (id) DO UPDATE SET collection = excluded.collection, station = excluded.station, stop_id = excluded.stop_id,
       station_note = excluded.station_note, kind = excluded.kind, title = excluded.title, place = excluded.place,
       octo_file_id = excluded.octo_file_id, octo_name = excluded.octo_name, mime_type = excluded.mime_type, bytes = excluded.bytes,
       sha256 = excluded.sha256, original_name = excluded.original_name, original_bytes = excluded.original_bytes,
       taken_at = excluded.taken_at, duration_s = excluded.duration_s, width = excluded.width, height = excluded.height,
       faces_blurred = excluded.faces_blurred, equipment_id = excluded.equipment_id, source = excluded.source, tags = excluded.tags`,
    [JSON.stringify(media)],
  );
  // A file's sightings are replaced as a set, so a code dropped from the manifest leaves the catalogue too.
  await octoQuery(`DELETE FROM core.navilens_sightings WHERE media_id = ANY(ARRAY(SELECT jsonb_array_elements_text($1::jsonb)))`, [
    JSON.stringify(media.map((r) => r.id)),
  ]);
  if (sightings.length) {
    await octoQuery(
      `INSERT INTO core.navilens_sightings (media_id, seq, at_s, box, pattern, pattern_key, confidence, raw_read, place, crop_file_id)
       SELECT r.media_id, r.seq, r.at_s, CASE WHEN r.box IS NULL THEN NULL ELSE ARRAY(SELECT jsonb_array_elements_text(r.box)::integer) END,
         r.pattern, r.pattern_key, r.confidence, r.raw_read, r.place, r.crop_file_id
       FROM jsonb_to_recordset($1::jsonb) AS r(media_id text, seq integer, at_s real, box jsonb, pattern text, pattern_key text,
         confidence text, raw_read text, place text, crop_file_id text)`,
      [JSON.stringify(sightings)],
    );
  }
  console.log(`catalogued ${media.length} files and ${sightings.length} NaviLens sightings in ${m.collection}`);
}

async function find(words: string[]): Promise<void> {
  const { rows } = await octoQuery<{ id: string; kind: string; station: string | null; title: string; octo_name: string; octo_file_id: string; codes: string | null }>(
    `SELECT m.id, m.kind, m.station, m.title, m.octo_name, m.octo_file_id,
            (SELECT string_agg(coalesce(s.pattern, '(' || s.confidence || ')') || coalesce(' at ' || s.at_s || ' s', '') || ': ' || s.place, E'\\n      ' ORDER BY s.seq)
               FROM core.navilens_sightings s WHERE s.media_id = m.id) AS codes
     FROM core.station_media m
     WHERE NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements_text($1::jsonb) w
       WHERE concat_ws(' ', m.id, m.station, m.stop_id, m.title, m.place, m.equipment_id, array_to_string(m.tags, ' ')) NOT ILIKE '%' || w || '%')
     ORDER BY m.taken_at NULLS LAST, m.id`,
    [JSON.stringify(words)],
  );
  if (!rows.length) console.log("Nothing matches.");
  for (const r of rows) {
    console.log(`${r.id}  [${r.kind}${r.station ? `, ${r.station}` : ""}]\n  ${r.title}\n  Octo file ${r.octo_file_id} (${r.octo_name})`);
    if (r.codes) console.log(`  NaviLens:\n      ${r.codes}`);
  }
}

async function codes(): Promise<void> {
  const { rows } = await octoQuery<{ pattern_key: string; station: string | null; places: string; sightings: number; media_ids: string[] }>(
    "SELECT pattern_key, station, places, sightings, media_ids FROM core.navilens_codes ORDER BY station NULLS LAST, pattern_key",
  );
  for (const r of rows) console.log(`${r.pattern_key}  ${r.station ?? "station not known"}, seen ${r.sightings}x\n  ${r.places}\n  ${r.media_ids.join(", ")}`);
}

async function main(argv: string[]): Promise<void> {
  loadEnv();
  const [cmd, ...rest] = argv;
  if (cmd === "publish" && rest.length === 2) return publish(rest[0], rest[1]);
  if (cmd === "find") return find(rest);
  if (cmd === "codes") return codes();
  console.error("usage: station-media.ts publish <manifest.json> <folder> | find [words...] | codes");
  process.exit(2);
}

if (process.argv[1]?.endsWith("station-media.ts")) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
