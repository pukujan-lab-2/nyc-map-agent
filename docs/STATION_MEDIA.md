# Station photos, videos and NaviLens codes

A partner walked 86 St on 2026-11-26 from the 86TH ST mosaic to the elevator at the northeast corner of 86 St and Lexington Ave, filming it and logging the phone's sensors, and photographed four NaviLens codes on the way. Those files now live in Octo, and two tables say what each one shows, so the question "which pictures show a NaviLens code at 86 St?" is one query.

## Where things are

The files are in Octo files under `station-media/<collection>/`, one folder per visit. They are private: none is published to a public link. Each code sighting also has a close crop under `station-media/<collection>/codes/`.

The catalogue is two tables in Octo's database, added by `db/migrations/20261127000100_station_media.sql`:

- `core.station_media` has one row per file: station and GTFS stop id, what it shows, where in the station, when, its Octo file id, its size before and after compression, and tags.
- `core.navilens_sightings` has one row each time a NaviLens code appears in a file: the pattern when we trust it, where the code is, the pixel box, the second of video, and the crop's Octo file id.
- `core.navilens_codes` is a view with one row per known code, the places it was seen and the files that show it.

The manifest that fills them is checked in, one file per collection, in `ingest/station-media/`. It is the place to correct a title or a station by hand; publishing again updates the rows and reuses the uploaded files.

## Finding things

```bash
pnpm media:find 86 elevator      # every file whose words match all the words given
pnpm media:find navilens         # every file that shows a code
pnpm media:codes                 # every code we trust, with where it is
```

Or in SQL through Octo:

```sql
-- Every picture or video of a NaviLens code at 86 St, with the second it appears
SELECT m.title, m.octo_file_id, s.at_s, s.pattern, s.confidence, s.place, s.crop_file_id
FROM core.navilens_sightings s JOIN core.station_media m ON m.id = s.media_id
WHERE m.stop_id = '626' ORDER BY m.taken_at, s.seq;

-- Which files show this code, however the phone was held when it was read
SELECT * FROM core.navilens_codes WHERE pattern_key = 'CKCKMKCMCCCKCYYMCCCCKYYMY';
```

To match a code read in the app against the table, turn the read pattern to its key first (`patternKey` in `scripts/station-media.ts`; the same quarter turn the reader in `src/lib/navilens/read.ts` uses).

## How much to trust a code's pattern

A code is 25 cells, each cyan, magenta, yellow or black (C, M, Y, K), read row by row. The `confidence` column says where a pattern came from:

| confidence | meaning | pattern filled in |
| --- | --- | --- |
| photo-read | Our reader read it from a full-size photo, and a person checked every cell against the picture | yes |
| video-matches-photo | A video frame's read is within 4 cells of a photo-read code; the codes we have differ from each other by 8 or more | yes, the photo's |
| video-read-only | Only video frames show it, and they are too blurred to trust; the read is kept in `raw_read` | no |
| not-read | The code is there but the reader could not read it | no |

In the 86 St set, three codes are photo-read, one video sighting matches the stair-wall code, three codes are seen only on video (on a platform column, above the fare machines, and on the street entrance railing), and the code at Lexington Av-59 St was not read.

The photo reads used the reader from pull request 261 with one change: it accepts a code when half the samples around the code's white frame look white, where it asks for three quarters. The 86 St "No Exit" code only reads with that change, and its read matched a cell-by-cell check exactly. The 59 St code still does not read (dim light, a tilt, and an MTA logo printed in its black border).

## What was done to the files

Photos are cut to 2400 pixels on the long side and the screenshot to 1600; the video is 720p H.264 at 1.8 Mbit/s with mono audio. Faces are blurred with Apple's Vision face detector at the source's full size, plus the head end of every person the body detector finds, because a person turned away has no face to detect. All metadata is dropped, including the phone's GPS, which underground was a stale fix 3.7 km wide. The sensor log is kept twice: converted to the app's walk recording (`pnpm walk:from-sensor-logger`) and gzipped, and as the original CSVs in a tar.xz.

For the 86 St set that took the files from 411 MB to 54 MB, most of it the video (377 MB to 44 MB). The blurring and encoding tools are small Swift programs kept outside the repository; the manifest's `prepared` line says what they did.

## Adding a new visit

1. Prepare the files (resize, blur faces, drop metadata) into one folder, with code crops in `codes/`.
2. Write `ingest/station-media/<collection>.json` like the 86 St one. Leave `pattern` off any code nobody has checked.
3. Run `pnpm media:publish ingest/station-media/<collection>.json <folder>`. It refuses a manifest with a problem and says what to fix.
