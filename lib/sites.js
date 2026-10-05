// Find-or-create helpers for sites and jobs, used inside a transaction (db client).
import { HttpError } from "./api";
import { clean, toId } from "./format";

// Job for devices from old projects that were never recorded; added later
// (e.g. when one is sent for claim) so we still know where it is installed.
export const UNRECORDED_JOB = "อุปกรณ์เดิม (ไม่มีรายงาน)";

// site_id, or a name: the same name (ignoring case/spaces) reuses the site
export async function ensureSite(db, { site_id, site_name }) {
  const id = site_id ? toId(site_id) : null;
  if (id) {
    const [site] = (await db.query(`SELECT id FROM sites WHERE id = $1`, [id])).rows;
    if (!site) throw new HttpError("ไม่พบสถานที่ที่เลือก", 404);
    return site.id;
  }
  const name = clean(site_name);
  if (!name) throw new HttpError("เลือกหรือกรอกชื่อสถานที่");
  const [site] = (
    await db.query(
      `INSERT INTO sites (name) VALUES ($1)
       ON CONFLICT ((lower(btrim(name)))) DO UPDATE SET name = sites.name RETURNING id`,
      [name]
    )
  ).rows;
  return site.id;
}

// A job by name at a site: reuses an existing one with that name, otherwise creates it
export async function ensureJob(db, { site_id, site_name, job_name, note }) {
  const siteId = await ensureSite(db, { site_id, site_name });
  const name = clean(job_name) || UNRECORDED_JOB;
  const [found] = (
    await db.query(`SELECT id FROM jobs WHERE site_id = $1 AND lower(btrim(name)) = lower(btrim($2)) ORDER BY id LIMIT 1`, [siteId, name])
  ).rows;
  if (found) return found.id;
  const [job] = (
    await db.query(`INSERT INTO jobs (site_id, name, note) VALUES ($1, $2, $3) RETURNING id`, [siteId, name, clean(note)])
  ).rows;
  return job.id;
}
