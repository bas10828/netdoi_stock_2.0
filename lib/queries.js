// Read queries used by server pages and API routes
import { query } from "./db";
import { searchKey } from "./format";

const DEVICE_COLUMNS = `id, job_id, device_type, brand, model, serial, mac, device_name, ip, location, note,
  job_name, job_delivered_on, site_id, site_name, status`;

export async function searchDevices(q, limit = 50) {
  const key = searchKey(q);
  const text = String(q ?? "").trim().toLowerCase();
  if (!key && !text) return [];
  // Serial/MAC compared without separators; model and location by plain substring
  return query(
    `SELECT ${DEVICE_COLUMNS}
       FROM device_overview
      WHERE ($1 <> '' AND (regexp_replace(lower(coalesce(serial, '')), '[^a-z0-9]', '', 'g') LIKE '%' || $1 || '%'
                       OR regexp_replace(lower(coalesce(mac, '')), '[^a-z0-9]', '', 'g') LIKE '%' || $1 || '%'))
         OR lower(coalesce(model, '')) LIKE '%' || $2 || '%'
         OR lower(coalesce(location, '')) LIKE '%' || $2 || '%'
      ORDER BY (lower(serial) = $2 OR regexp_replace(lower(coalesce(mac, '')), '[^a-z0-9]', '', 'g') = $1) DESC,
               id DESC
      LIMIT $3`,
    [key, text, limit]
  );
}

export async function getStats() {
  const [row] = await query(
    `SELECT (SELECT count(*) FROM sites)::int   AS sites,
            (SELECT count(*) FROM jobs)::int    AS jobs,
            (SELECT count(*) FROM devices)::int AS devices,
            (SELECT count(*) FROM claims WHERE returned_on IS NULL)::int AS open_claims`
  );
  return row;
}

const JOB_SUMMARY = `
  SELECT j.id, j.site_id, s.name AS site_name, j.name, j.delivered_on, j.po_number, j.note, j.created_at,
         count(d.id)::int AS device_count,
         count(d.id) FILTER (WHERE d.status = 'claim')::int AS open_claims
    FROM jobs j
    JOIN sites s ON s.id = j.site_id
    LEFT JOIN device_overview d ON d.job_id = j.id`;

export async function getRecentJobs(limit = 6) {
  return query(
    `${JOB_SUMMARY}
     GROUP BY j.id, s.name
     ORDER BY j.delivered_on DESC NULLS LAST, j.created_at DESC
     LIMIT $1`,
    [limit]
  );
}

export async function getSites() {
  return query(
    `SELECT s.id, s.name,
            count(DISTINCT j.id)::int AS job_count,
            count(d.id)::int AS device_count,
            count(d.id) FILTER (WHERE d.status = 'claim')::int AS open_claims,
            max(j.delivered_on) AS last_delivered_on
       FROM sites s
       LEFT JOIN jobs j ON j.site_id = s.id
       LEFT JOIN device_overview d ON d.job_id = j.id
      GROUP BY s.id
      ORDER BY max(j.delivered_on) DESC NULLS LAST, s.name`
  );
}

export async function getSite(id) {
  const [site] = await query(`SELECT id, name, note FROM sites WHERE id = $1`, [id]);
  if (!site) return null;
  const jobs = await query(
    `${JOB_SUMMARY}
     WHERE j.site_id = $1
     GROUP BY j.id, s.name
     ORDER BY j.delivered_on DESC NULLS LAST, j.created_at DESC`,
    [id]
  );
  return { ...site, jobs };
}

export async function getJob(id) {
  const [job] = await query(`${JOB_SUMMARY} WHERE j.id = $1 GROUP BY j.id, s.name`, [id]);
  if (!job) return null;
  const devices = await query(
    `SELECT ${DEVICE_COLUMNS} FROM device_overview WHERE job_id = $1 ORDER BY id`,
    [id]
  );
  return { ...job, devices };
}

export async function getDevice(id) {
  const [device] = await query(`SELECT ${DEVICE_COLUMNS}, created_at FROM device_overview WHERE id = $1`, [id]);
  if (!device) return null;
  // Claims on this device, plus the claim that produced it (if it is a replacement unit)
  const claims = await query(
    `SELECT c.id, c.device_id, c.sent_on, c.symptom, c.vendor, c.ticket_no, c.returned_on, c.result,
            c.replacement_device_id, c.note,
            old.serial AS old_serial, rep.serial AS replacement_serial
       FROM claims c
       JOIN devices old ON old.id = c.device_id
       LEFT JOIN devices rep ON rep.id = c.replacement_device_id
      WHERE c.device_id = $1 OR c.replacement_device_id = $1
      ORDER BY c.sent_on, c.id`,
    [id]
  );
  const moves = await query(
    `SELECT m.id, m.from_job_id, m.to_job_id, m.from_label, m.to_label, m.from_location, m.to_location,
            m.moved_on, m.note, m.created_by, fj.delivered_on AS from_delivered_on
       FROM device_moves m
       LEFT JOIN jobs fj ON fj.id = m.from_job_id
      WHERE m.device_id = $1
      ORDER BY m.moved_on, m.id`,
    [id]
  );
  return { ...device, claims, moves };
}

// Devices that were in this job and have since moved elsewhere (latest move out per device)
export async function getMovedOut(jobId) {
  return query(
    `SELECT DISTINCT ON (m.device_id)
            m.device_id, m.moved_on, m.from_location, d.brand, d.model, d.serial,
            d.job_id AS now_job_id, d.job_name AS now_job_name, d.site_name AS now_site_name, d.location AS now_location
       FROM device_moves m
       JOIN device_overview d ON d.id = m.device_id
      WHERE m.from_job_id = $1 AND d.job_id IS DISTINCT FROM $1
      ORDER BY m.device_id, m.moved_on DESC, m.id DESC`,
    [jobId]
  );
}
