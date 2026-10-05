import { error, handler, json } from "@/lib/api";
import { transaction } from "@/lib/db";
import { clean, toId } from "@/lib/format";

const DEVICE_FIELDS = ["device_type", "brand", "model", "serial", "mac", "device_name", "ip", "location", "note"];
const MAX_DEVICES = 5000;
// Jobs created by scripts/migrate-legacy.mjs; removed here once a merge empties them
const LEGACY_JOB_NOTE = "นำเข้าจากระบบเดิม";

// Creates (or reuses) the site and creates the job, then for each device either
// inserts it, or (with merge_device_id) moves that existing device into the job
// and fills in the file's values. One transaction: on any error nothing is saved.
export const POST = handler(async (request) => {
  const body = await request.json().catch(() => ({}));
  const siteId = body.site_id ? toId(body.site_id) : null;
  const siteName = clean(body.site_name);
  const jobName = clean(body.job?.name);
  const deliveredOn = clean(body.job?.delivered_on);
  const devices = Array.isArray(body.devices) ? body.devices : [];

  if (!siteId && !siteName) return error("เลือกหรือกรอกชื่อสถานที่");
  if (!jobName) return error("กรอกชื่องาน");
  if (deliveredOn && !/^\d{4}-\d{2}-\d{2}$/.test(deliveredOn)) return error("วันส่งงานไม่ถูกต้อง");
  if (devices.length === 0) return error("ไม่มีอุปกรณ์ให้บันทึก");
  if (devices.length > MAX_DEVICES) return error(`บันทึกได้ครั้งละไม่เกิน ${MAX_DEVICES} รายการ`);

  const merges = devices.filter((d) => d?.merge_device_id);
  const inserts = devices.filter((d) => !d?.merge_device_id);
  const mergeIds = merges.map((d) => toId(d.merge_device_id));
  if (mergeIds.some((id) => !id)) return error("รหัสอุปกรณ์ที่จะย้ายไม่ถูกต้อง");
  if (new Set(mergeIds).size !== mergeIds.length) {
    return error("มีหลายแถวเลือกย้ายอุปกรณ์ตัวเดียวกัน (serial ซ้ำในไฟล์) ลบหรือเปลี่ยนแถวที่ซ้ำก่อน");
  }

  const result = await transaction(async (db) => {
    let site;
    if (siteId) {
      [site] = (await db.query(`SELECT id FROM sites WHERE id = $1`, [siteId])).rows;
      if (!site) return { error: "ไม่พบสถานที่ที่เลือก", status: 404 };
    } else {
      // Same name (ignoring case/spaces) reuses the existing site
      [site] = (
        await db.query(
          `INSERT INTO sites (name) VALUES ($1)
           ON CONFLICT ((lower(btrim(name)))) DO UPDATE SET name = sites.name
           RETURNING id`,
          [siteName]
        )
      ).rows;
    }

    const [job] = (
      await db.query(
        `INSERT INTO jobs (site_id, name, delivered_on, po_number, note)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [site.id, jobName, deliveredOn, clean(body.job?.po_number), clean(body.job?.note)]
      )
    ).rows;

    let inserted = 0;
    if (inserts.length > 0) {
      // One array per column for a single INSERT ... SELECT FROM unnest(...)
      const columns = DEVICE_FIELDS.map((f) => inserts.map((d) => clean(d?.[f])));
      const res = await db.query(
        `INSERT INTO devices (job_id, ${DEVICE_FIELDS.join(", ")})
         SELECT $1, * FROM unnest(${DEVICE_FIELDS.map((_, i) => `$${i + 2}::text[]`).join(", ")})`,
        [job.id, ...columns]
      );
      inserted = res.rowCount;
    }

    let removedJobs = 0;
    if (merges.length > 0) {
      const { rows: previous } = await db.query(
        `SELECT id, job_id FROM devices WHERE id = ANY($1::int[]) FOR UPDATE`,
        [mergeIds]
      );
      if (previous.length !== mergeIds.length) return { error: "อุปกรณ์เดิมบางตัวถูกลบไปแล้ว ลองโหลดไฟล์ใหม่", status: 409 };

      // File values win when present; blanks keep the existing value; notes are appended
      const columns = DEVICE_FIELDS.map((f) => merges.map((d) => clean(d?.[f])));
      await db.query(
        `UPDATE devices d SET
           job_id = $1,
           ${DEVICE_FIELDS.filter((f) => f !== "note").map((f) => `${f} = COALESCE(v.${f}, d.${f})`).join(",\n           ")},
           note = CASE
             WHEN v.note IS NULL OR v.note = d.note THEN d.note
             WHEN d.note IS NULL THEN v.note
             ELSE d.note || E'\\n' || v.note
           END
         FROM unnest($2::int[], ${DEVICE_FIELDS.map((_, i) => `$${i + 3}::text[]`).join(", ")})
           AS v(id, ${DEVICE_FIELDS.join(", ")})
         WHERE d.id = v.id`,
        [job.id, mergeIds, ...columns]
      );

      // Legacy-migrated jobs left without devices are just noise now
      const oldJobIds = [...new Set(previous.map((p) => p.job_id).filter(Boolean))];
      const removed = await db.query(
        `DELETE FROM jobs j
          WHERE j.id = ANY($1::int[]) AND j.note LIKE $2 || '%'
            AND NOT EXISTS (SELECT 1 FROM devices d WHERE d.job_id = j.id)
          RETURNING site_id`,
        [oldJobIds, LEGACY_JOB_NOTE]
      );
      removedJobs = removed.rowCount;
      // ...and so are the sites those jobs leave empty
      await db.query(
        `DELETE FROM sites s
          WHERE s.id = ANY($1::int[]) AND NOT EXISTS (SELECT 1 FROM jobs j WHERE j.site_id = s.id)`,
        [removed.rows.map((r) => r.site_id)]
      );
    }

    return { site_id: site.id, job_id: job.id, inserted, merged: merges.length, removed_jobs: removedJobs };
  });

  if (result.error) return error(result.error, result.status);
  return json(result, 201);
});
