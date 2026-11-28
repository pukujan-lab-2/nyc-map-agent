import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { catalogRows, cellsApart, checkManifest, filesOf, octoName, patternKey, turned, type Manifest } from "./station-media";

const manifest = JSON.parse(
  readFileSync(new URL("../ingest/station-media/86-st-6-train-2026-11-26.json", import.meta.url), "utf8"),
) as Manifest;

const STAIR_WALL = "CKCKMKCMCCCKCYYMCCCCKYYMY";

describe("NaviLens patterns", () => {
  it("turns four times back to where it started", () => {
    expect(turned(turned(turned(turned(STAIR_WALL))))).toBe(STAIR_WALL);
    expect(turned(STAIR_WALL)).not.toBe(STAIR_WALL);
  });

  it("gives one key to a code however the phone was held", () => {
    const keys = new Set([STAIR_WALL, turned(STAIR_WALL), turned(turned(STAIR_WALL)), turned(turned(turned(STAIR_WALL)))].map(patternKey));
    expect(keys.size).toBe(1);
  });

  it("counts the cells two reads differ by, at their best rotation", () => {
    expect(cellsApart(turned(STAIR_WALL), STAIR_WALL)).toBe(0);
    expect(cellsApart("CKCKMCCMCCCKCYYMCCCCKYYMY", STAIR_WALL)).toBe(1);
  });
});

describe("the 86 St manifest", () => {
  it("passes every check", () => {
    expect(checkManifest(manifest)).toEqual([]);
  });

  it("keeps its photo-read codes at least 8 cells apart, so a 4-cell video match cannot pick the wrong one", () => {
    const read = manifest.files.flatMap((f) => (f.navilens ?? []).filter((s) => s.confidence === "photo-read").map((s) => s.pattern!));
    expect(read.length).toBe(3);
    for (let i = 0; i < read.length; i++) for (let j = i + 1; j < read.length; j++) expect(cellsApart(read[i], read[j])).toBeGreaterThanOrEqual(8);
  });

  it("names every file to upload under one Octo folder", () => {
    const files = filesOf(manifest);
    expect(files).toHaveLength(8 + 8);
    expect(new Set(files.map((f) => octoName(manifest.collection, f).split("/").slice(0, 2).join("/")))).toEqual(
      new Set(["station-media/86-st-6-train-2026-11-26"]),
    );
  });

  it("turns into one catalogue row per file and one per sighting", () => {
    const stored = new Map(filesOf(manifest).map((f, i) => [f, { id: `file-${i}`, bytes: 10, sha256: "x" }]));
    const { media, sightings } = catalogRows(manifest, stored);
    expect(media).toHaveLength(8);
    expect(sightings).toHaveLength(8);
    const stair = sightings.filter((s) => s.pattern_key === patternKey(STAIR_WALL));
    expect(stair.map((s) => s.media_id)).toEqual(["86-st-6-train-2026-11-26/IMG_9827", "86-st-6-train-2026-11-26/IMG_9828"]);
    expect(sightings.every((s) => s.crop_file_id?.startsWith("file-"))).toBe(true);
    expect(sightings.filter((s) => s.pattern === null).map((s) => s.confidence).sort()).toEqual([
      "not-read",
      "video-read-only",
      "video-read-only",
      "video-read-only",
    ]);
  });
});

describe("checkManifest", () => {
  const base: Manifest = { collection: "test-visit", source: "a test", files: [] };
  const photo = { stem: "a", file: "a.jpg", kind: "photo" as const, original_name: "A.JPG", station: "86 St", stop_id: "626", title: "t", place: "p", faces_blurred: true, tags: [] };

  it("refuses a pattern on a code nobody could read", () => {
    const m = { ...base, files: [{ ...photo, navilens: [{ confidence: "video-read-only" as const, pattern: STAIR_WALL, place: "x" }] }] };
    expect(checkManifest(m).join(" ")).toMatch(/pattern belongs only/);
  });

  it("refuses a video match that is too far from its photo read", () => {
    const far = "YYYYYYYYYYCCCCCCCCCCKKKKK";
    const m = { ...base, files: [{ ...photo, navilens: [{ confidence: "video-matches-photo" as const, pattern: STAIR_WALL, raw_read: far, place: "x" }] }] };
    expect(checkManifest(m).join(" ")).toMatch(/more than 4 cells/);
  });

  it("refuses file names that could leave the collection's folder", () => {
    const m = { ...base, files: [{ ...photo, file: "../a.jpg" }] };
    expect(checkManifest(m).join(" ")).toMatch(/not a plain file name/);
  });

  it("asks why when a file has no station", () => {
    const m = { ...base, files: [{ ...photo, station: null, stop_id: null }] };
    expect(checkManifest(m).join(" ")).toMatch(/station_note/);
  });
});
