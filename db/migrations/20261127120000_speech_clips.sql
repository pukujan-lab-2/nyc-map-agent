-- migrate:up
-- Notice-walk speech made ahead (owner, 2026-11-27: generate the audio when a notice arrives, save it,
-- serve it, and clean it up when it is no longer used or the notice changes).
-- server/features/agent/clipStore.ts writes and deletes the rows.
-- Nothing about riders is stored: each row is one of the app's own walk sentences about a public MTA notice.

-- One row per spoken sentence. The sound is a file in the server's clip folder (SPEECH_CACHE_DIR), never in
-- this table; a row whose file is gone is deleted when the server starts. A clip no live notice uses
-- (notice_ids empty) is deleted once it has not been played for 7 days.
CREATE TABLE core.speech_clips (
  key          text PRIMARY KEY,                 -- sha256 of the words as spoken, the language and the voice
  lang         text NOT NULL,
  voice        text NOT NULL,                    -- the speech server's stack and Kokoro model version
  text         text NOT NULL,
  file         text NOT NULL,                    -- file name inside the clip folder
  bytes        integer NOT NULL,
  sample_rate  integer NOT NULL,                 -- needed to play the file back (16-bit mono PCM)
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  notice_ids   text[] NOT NULL DEFAULT '{}'      -- the live MTA notices whose walks say it
);
CREATE INDEX IF NOT EXISTS speech_clips_last_used_idx ON core.speech_clips (last_used_at);

-- migrate:down
DROP TABLE IF EXISTS core.speech_clips;
