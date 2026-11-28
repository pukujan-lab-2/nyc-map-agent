-- migrate:up
-- Restroom hours and what riders found (#249).
-- core.place_toilets keeps the OpenStreetMap details the restroom card shows:
-- opening_hours (OSM syntax, read at request time in New York time), phone,
-- website, a one-line street address, brand:wikidata (the storefront logo)
-- and OSM's check_date (when a mapper last confirmed the place).
ALTER TABLE core.place_toilets
  ADD COLUMN opening_hours  text,
  ADD COLUMN phone          text,
  ADD COLUMN website        text,
  ADD COLUMN address        text,
  ADD COLUMN brand_wikidata text,
  ADD COLUMN check_date     text;

-- The city list also says when we last fetched each row (raw.restrooms.loaded_at),
-- so a stale copy can say "Hours may have changed" instead of "Open now".
CREATE OR REPLACE VIEW core.restrooms AS
SELECT facility_name AS name,
       row->>'location_type' AS location_type,
       row->>'operator' AS operator,
       row->>'status' AS status,
       row->>'hours_of_operation' AS hours,
       row->>'accessibility' AS accessibility,
       row->>'restroom_type' AS restroom_type,
       row->>'changing_stations' AS changing_stations,
       (row->>'latitude')::double precision AS lat,
       (row->>'longitude')::double precision AS lon,
       COALESCE((row->>':updated_at')::timestamptz, loaded_at) AS updated_at,
       loaded_at AS fetched_at
FROM raw.restrooms
WHERE row->>'latitude' IS NOT NULL AND row->>'longitude' IS NOT NULL;

-- One answer to "Was the restroom available to use?" after a walk ends there.
-- Anonymous: no account, no device id, no position. The server checks the
-- phone was near the restroom and drops the position before this insert.
CREATE TABLE core.restroom_answers (
  id              bigserial PRIMARY KEY,
  restroom_id     text NOT NULL,
  available       boolean NOT NULL,
  paid            boolean,
  customers_only  boolean,
  code_needed     boolean,
  problem         text CHECK (problem IN ('closed', 'customers_only', 'out_of_order', 'not_found')),
  answered_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX restroom_answers_recent ON core.restroom_answers (restroom_id, answered_at DESC);

-- migrate:down
DROP TABLE IF EXISTS core.restroom_answers;
DROP VIEW IF EXISTS core.restrooms;
CREATE VIEW core.restrooms AS
SELECT facility_name AS name,
       row->>'location_type' AS location_type,
       row->>'operator' AS operator,
       row->>'status' AS status,
       row->>'hours_of_operation' AS hours,
       row->>'accessibility' AS accessibility,
       row->>'restroom_type' AS restroom_type,
       row->>'changing_stations' AS changing_stations,
       (row->>'latitude')::double precision AS lat,
       (row->>'longitude')::double precision AS lon,
       COALESCE((row->>':updated_at')::timestamptz, loaded_at) AS updated_at
FROM raw.restrooms
WHERE row->>'latitude' IS NOT NULL AND row->>'longitude' IS NOT NULL;
ALTER TABLE core.place_toilets
  DROP COLUMN IF EXISTS opening_hours,
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS website,
  DROP COLUMN IF EXISTS address,
  DROP COLUMN IF EXISTS brand_wikidata,
  DROP COLUMN IF EXISTS check_date;
