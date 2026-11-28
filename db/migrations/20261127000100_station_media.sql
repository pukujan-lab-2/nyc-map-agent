-- migrate:up
-- Photos, videos and sensor logs taken inside stations, and the NaviLens codes
-- seen in them. The files live in Octo files under station-media/<collection>/
-- (private: not published); these tables say what each one is and where it was
-- taken, so a person or the agent can find "every picture of a NaviLens code at
-- 86 St" with one query. scripts/station-media.ts writes them from a manifest in
-- data/station-media/; docs/STATION_MEDIA.md shows the queries.
CREATE TABLE IF NOT EXISTS core.station_media (
  id text PRIMARY KEY,                  -- '<collection>/<file stem>', e.g. '86-st-6-train-2026-11-26/IMG_9827'
  collection text NOT NULL,             -- one visit or one hand-over, e.g. '86-st-6-train-2026-11-26'
  station text,                         -- station name as the app shows it; NULL when not known
  stop_id text,                         -- GTFS parent stop, e.g. '626' for 86 St (4 5 6)
  station_note text,                    -- how sure the station is, in words, when it is not certain
  kind text NOT NULL CHECK (kind IN ('photo', 'video', 'screenshot', 'sensor-log', 'walk')),
  title text NOT NULL,                  -- what it shows, one plain sentence
  place text,                           -- where in the station it was taken, in words
  octo_file_id text NOT NULL,
  octo_name text NOT NULL,              -- the file's name in Octo files
  mime_type text NOT NULL,
  bytes bigint NOT NULL,
  sha256 text NOT NULL,
  original_name text NOT NULL,          -- the file name the sender used
  original_bytes bigint,                -- its size before we compressed it
  taken_at timestamptz,
  duration_s real,                      -- videos and sensor logs
  width integer,
  height integer,
  faces_blurred boolean NOT NULL DEFAULT false,
  equipment_id text,                    -- an elevator or escalator it shows, e.g. 'EL273'
  source text NOT NULL,                 -- who sent it and from where
  tags text[] NOT NULL DEFAULT '{}',
  added_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS station_media_stop_idx ON core.station_media (stop_id);
CREATE INDEX IF NOT EXISTS station_media_tags_idx ON core.station_media USING gin (tags);

-- One row each time a NaviLens code is seen in a photo or a video. A code is 25
-- cells, C M Y or K, read row by row; pattern_key is the same pattern turned to
-- whichever of its four rotations sorts first, so one code read with the phone
-- held two ways still groups as one.
CREATE TABLE IF NOT EXISTS core.navilens_sightings (
  media_id text NOT NULL REFERENCES core.station_media (id) ON DELETE CASCADE,
  seq integer NOT NULL,                 -- the n-th code seen in this file
  at_s real,                            -- seconds into a video; NULL for a photo
  box integer[] CHECK (box IS NULL OR cardinality(box) = 4),  -- x, y, width, height in the upright original
  pattern text CHECK (pattern ~ '^[CMYK]{25}$'),
  pattern_key text CHECK (pattern_key ~ '^[CMYK]{25}$'),
  -- photo-read: our reader read it from a photo and a person checked it cell by cell.
  -- video-matches-photo: a video read within 4 cells of a photo-read code (two codes differ by 8 or more).
  -- video-read-only: read from video frames only; too blurred to trust, kept in raw_read.
  -- not-read: the code is there but the reader could not read it.
  confidence text NOT NULL CHECK (confidence IN ('photo-read', 'video-matches-photo', 'video-read-only', 'not-read')),
  raw_read text CHECK (raw_read IS NULL OR raw_read ~ '^[CMYK]{25}$'),
  place text NOT NULL,                  -- where the code is, in words
  crop_file_id text,                    -- Octo file: a close crop of the code
  PRIMARY KEY (media_id, seq),
  CHECK ((confidence IN ('photo-read', 'video-matches-photo')) = (pattern IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS navilens_sightings_key_idx ON core.navilens_sightings (pattern_key);

-- Each code we know, with where it was seen and how many files show it.
CREATE OR REPLACE VIEW core.navilens_codes AS
SELECT s.pattern_key,
       min(m.station) AS station,
       min(m.stop_id) AS stop_id,
       string_agg(DISTINCT s.place, '; ') AS places,
       count(*) AS sightings,
       array_agg(DISTINCT s.media_id ORDER BY s.media_id) AS media_ids
FROM core.navilens_sightings s
JOIN core.station_media m ON m.id = s.media_id
WHERE s.pattern_key IS NOT NULL
GROUP BY s.pattern_key;

-- migrate:down
DROP VIEW IF EXISTS core.navilens_codes;
DROP TABLE IF EXISTS core.navilens_sightings;
DROP TABLE IF EXISTS core.station_media;
