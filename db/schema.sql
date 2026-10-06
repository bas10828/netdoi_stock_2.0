-- netdoi_stock 2.0 schema
-- Idempotent: safe to run more than once (npm run db:migrate).

BEGIN;

-- All tables live in the app schema (created by scripts/setup-db.mjs)
SET LOCAL search_path TO stock;

CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  username   TEXT NOT NULL UNIQUE,
  email      TEXT,
  password   TEXT NOT NULL,            -- bcrypt hash
  role       TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A place we install equipment at (hospital, school, municipality, ...)
CREATE TABLE IF NOT EXISTS sites (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Same name with different case/spacing is the same site
CREATE UNIQUE INDEX IF NOT EXISTS sites_name_key ON sites (lower(btrim(name)));

-- One delivered job at a site = one Inventory report
CREATE TABLE IF NOT EXISTS jobs (
  id           SERIAL PRIMARY KEY,
  site_id      INTEGER NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
  name         TEXT NOT NULL,          -- e.g. "CCTV", "AP WiFi"
  delivered_on DATE,
  po_number    TEXT,                   -- optional, for future use
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jobs_site_id_idx ON jobs (site_id);

CREATE TABLE IF NOT EXISTS devices (
  id                  SERIAL PRIMARY KEY,
  job_id              INTEGER REFERENCES jobs(id) ON DELETE RESTRICT,
  device_type         TEXT,
  brand               TEXT,
  model               TEXT,
  serial              TEXT,
  mac                 TEXT,
  device_name         TEXT,
  ip                  TEXT,
  location            TEXT,
  note                TEXT,
  legacy_equipment_id INTEGER UNIQUE,  -- equipment.id in the v1 database, for re-runnable migration
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Columns added after the first release (CREATE TABLE IF NOT EXISTS skips existing tables)
ALTER TABLE devices ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS warranty_until DATE;  -- optional
ALTER TABLE devices ADD COLUMN IF NOT EXISTS warranty_lifetime BOOLEAN NOT NULL DEFAULT false;  -- true = no end date (warranty_until stays NULL)

CREATE INDEX IF NOT EXISTS devices_job_id_idx ON devices (job_id);
-- Serial/MAC are not unique (old data has duplicates); indexed for search
CREATE INDEX IF NOT EXISTS devices_serial_idx ON devices (lower(serial));
CREATE INDEX IF NOT EXISTS devices_mac_idx ON devices (lower(mac));

-- Warranty claims (RMA). Device status is derived from these rows.
CREATE TABLE IF NOT EXISTS claims (
  id                    SERIAL PRIMARY KEY,
  device_id             INTEGER NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
  sent_on               DATE NOT NULL,
  symptom               TEXT,
  vendor                TEXT,
  ticket_no             TEXT,
  returned_on           DATE,          -- NULL = still out
  result                TEXT CHECK (result IN ('repaired', 'replaced', 'rejected')),
  replacement_device_id INTEGER REFERENCES devices(id) ON DELETE RESTRICT,
  note                  TEXT,
  created_by            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (returned_on IS NULL OR returned_on >= sent_on),
  -- A claim is closed with a result, or open without one
  CHECK ((returned_on IS NULL) = (result IS NULL)),
  -- Only a "replaced" result points at a new device, and it must
  CHECK ((COALESCE(result, '') = 'replaced') = (replacement_device_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS claims_device_id_idx ON claims (device_id);
-- At most one open claim per device
CREATE UNIQUE INDEX IF NOT EXISTS claims_one_open_per_device
  ON claims (device_id) WHERE returned_on IS NULL;

-- A device relocated from one job to another (e.g. a customer's existing AP
-- moved to another building in a new project). The device row holds where it
-- is now; this keeps where it was. Labels are snapshots so history survives
-- jobs being renamed or deleted.
CREATE TABLE IF NOT EXISTS device_moves (
  id            SERIAL PRIMARY KEY,
  device_id     INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  from_job_id   INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  to_job_id     INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  from_label    TEXT NOT NULL,         -- "site · job" at the time of the move
  to_label      TEXT NOT NULL,
  from_location TEXT,
  to_location   TEXT,
  moved_on      DATE NOT NULL,
  note          TEXT,
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS device_moves_device_id_idx ON device_moves (device_id);
CREATE INDEX IF NOT EXISTS device_moves_from_job_id_idx ON device_moves (from_job_id);

-- A device that stays where it is (installed under devices.job_id) but is also
-- listed in another job's Inventory report, e.g. a later project that extends
-- the same building's system. Not a move: no history, the device is unchanged.
CREATE TABLE IF NOT EXISTS job_device_refs (
  job_id     INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  device_id  INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  note       TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id, device_id)
);
CREATE INDEX IF NOT EXISTS job_device_refs_device_id_idx ON job_device_refs (device_id);

-- Devices with their job/site and a status derived from claims:
--   claim    = has an open claim
--   replaced = a claim returned a new unit in its place
--   ok       = otherwise
-- Dropped and recreated so new device columns are picked up.
DROP VIEW IF EXISTS device_overview;
CREATE VIEW device_overview AS
SELECT
  d.*,
  j.name         AS job_name,
  j.delivered_on AS job_delivered_on,
  j.site_id,
  s.name         AS site_name,
  CASE
    WHEN EXISTS (SELECT 1 FROM claims c WHERE c.device_id = d.id AND c.returned_on IS NULL) THEN 'claim'
    WHEN EXISTS (SELECT 1 FROM claims c WHERE c.device_id = d.id AND c.result = 'replaced') THEN 'replaced'
    ELSE 'ok'
  END AS status,
  (SELECT count(*)::int FROM job_device_refs r WHERE r.device_id = d.id) AS shared_count,
  -- Display label; devices sent for claim that aren't in any report have no job
  coalesce(s.name || ' · ' || j.name, 'ไม่สังกัดงาน') AS place
FROM devices d
LEFT JOIN jobs j ON j.id = d.job_id
LEFT JOIN sites s ON s.id = j.site_id;

COMMIT;
