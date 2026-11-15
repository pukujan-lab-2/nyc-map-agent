-- migrate:up
-- Speech and translation caches (#218; owner, 2026-11-14: "caching would be cheaper right?",
-- "do we have a database model for it so we save it proper, what about pruning").
-- A notice's spoken steps and their translations are made once and served to every rider after.
-- server/features/agent/speechCache.ts writes and prunes both tables.
-- Nothing personal is stored: the MTA's public notice texts and the app's own step sentences,
-- never a rider's question, an answer from the chat, or a location.

-- One row per spoken line. The sound itself is a file in the server's cache folder
-- (SPEECH_CACHE_DIR), never in this table; a row whose file is gone is deleted on the next prune.
-- Pruned hourly: idle 14 days, one day after its notice left the feed, then least recently
-- used first until the files are under 300 MB.
CREATE TABLE core.tts_cache (
  key           text PRIMARY KEY,           -- sha256 of text, language, voice and model version
  lang          text NOT NULL,
  voice         text NOT NULL,              -- the speech server's stack, which picks the voice
  model_version text NOT NULL,
  text          text NOT NULL,
  source_kind   text NOT NULL CHECK (source_kind IN ('notice', 'trip_step')),
  source_id     text,                       -- the MTA notice id; null for a trip step
  file_path     text NOT NULL,              -- file name inside the cache folder
  bytes         integer NOT NULL,
  sample_rate   integer NOT NULL,           -- needed to play the file back (16-bit mono PCM)
  duration_ms   integer,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz NOT NULL DEFAULT now(),
  hits          integer NOT NULL DEFAULT 0,
  gone_at       timestamptz                 -- when its notice was first seen missing from the feed
);
CREATE INDEX IF NOT EXISTS tts_cache_last_used_idx ON core.tts_cache (last_used_at);
CREATE INDEX IF NOT EXISTS tts_cache_source_idx ON core.tts_cache (source_kind, source_id);

-- One row per translated set of lines. Pruned with the audio: idle 14 days, or one day after
-- its notice left the feed.
CREATE TABLE core.translation_cache (
  key          text PRIMARY KEY,            -- sha256 of the source lines, target language and model
  lang         text NOT NULL,
  model        text NOT NULL,
  source_lines jsonb NOT NULL,
  lines        jsonb NOT NULL,
  source_kind  text NOT NULL CHECK (source_kind IN ('notice', 'trip_step')),
  source_id    text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  hits         integer NOT NULL DEFAULT 0,
  gone_at      timestamptz
);
CREATE INDEX IF NOT EXISTS translation_cache_last_used_idx ON core.translation_cache (last_used_at);
CREATE INDEX IF NOT EXISTS translation_cache_source_idx ON core.translation_cache (source_kind, source_id);

-- migrate:down
DROP TABLE IF EXISTS core.translation_cache;
DROP TABLE IF EXISTS core.tts_cache;
