-- migrate:up
-- How long subway trains are at stations, measured by the observer
-- (server/features/transit/stopObserve.ts) on the numbered lines and the 7, from each train's own
-- vehicle report: from its last movement before it reports "stopped at" to the window in which it
-- stops reporting that. Not yet checked against a stopwatch, so it may include the train running
-- in along the platform. Bounded: the observer deletes rows older than 30 days, so the table stays
-- under about 2 million rows.
CREATE TABLE IF NOT EXISTS raw.transit_stop_obs (
  observed_at timestamptz NOT NULL,   -- when the train left
  route text NOT NULL,
  dir smallint,
  stop text NOT NULL,                 -- platform id, e.g. 127S
  seconds real NOT NULL CHECK (seconds > 0 AND seconds <= 900),
  slack real NOT NULL CHECK (slack >= 0), -- how far off `seconds` can be
  notice boolean,                     -- a service notice was active for the line; null = not known
  trip_id text NOT NULL,
  PRIMARY KEY (trip_id, stop, observed_at)
);
CREATE INDEX IF NOT EXISTS transit_stop_obs_time ON raw.transit_stop_obs (observed_at);

-- A normal stop per platform, line and New York hour of the week: no notice on the line, and
-- under three minutes, so a held train does not pass for an ordinary stop.
CREATE MATERIALIZED VIEW IF NOT EXISTS marts.transit_stop_hourly AS
SELECT
  route, coalesce(dir, -1)::smallint AS dir, stop,
  extract(isodow FROM observed_at AT TIME ZONE 'America/New_York')::smallint AS dow,
  extract(hour FROM observed_at AT TIME ZONE 'America/New_York')::smallint AS hour,
  count(*)::int AS n,
  percentile_cont(0.2) WITHIN GROUP (ORDER BY seconds)::real AS p20_s,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY seconds)::real AS median_s,
  percentile_cont(0.8) WITHIN GROUP (ORDER BY seconds)::real AS p80_s
FROM raw.transit_stop_obs
WHERE notice IS NOT TRUE AND seconds < 180
GROUP BY 1, 2, 3, 4, 5;
CREATE UNIQUE INDEX IF NOT EXISTS transit_stop_hourly_key
  ON marts.transit_stop_hourly (route, dir, stop, dow, hour);

-- migrate:down
DROP MATERIALIZED VIEW IF EXISTS marts.transit_stop_hourly;
DROP TABLE IF EXISTS raw.transit_stop_obs;
