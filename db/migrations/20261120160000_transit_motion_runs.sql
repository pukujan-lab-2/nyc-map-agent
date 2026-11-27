-- migrate:up
-- How the map draws subway trains, scored each observer run (server/features/transit/motionScore.ts):
-- how many trains stand at a station, and how many stop-to-stop stretches are drawn faster than a
-- subway car can run. One row per run and notice state, so lines with a service notice in effect
-- are kept apart from lines without. Counts are summed over the run's snapshots. Bounded: at most
-- 3 rows a run, 96 runs a day, deleted after 21 days by the observer.
CREATE TABLE IF NOT EXISTS raw.transit_motion_runs (
  run_at timestamptz NOT NULL,
  notice text NOT NULL CHECK (notice IN ('yes', 'no', 'unknown')), -- a notice was active for the train's line
  snapshots integer NOT NULL,  -- feed snapshots scored in the run
  trains integer NOT NULL,     -- trains drawn, not counting those at their origin or terminal
  parked integer NOT NULL,     -- of those, drawn standing at a station
  legs integer NOT NULL,       -- stretches the map shapes itself, starting within ten minutes
  racing integer NOT NULL,     -- of those, run shorter than the fastest a subway car can make
  tight integer NOT NULL,      -- of those, run within a quarter of the fastest
  PRIMARY KEY (run_at, notice)
);

-- migrate:down
DROP TABLE IF EXISTS raw.transit_motion_runs;
