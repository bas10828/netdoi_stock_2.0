import { error, handler, HttpError, json } from "@/lib/api";
import { transaction } from "@/lib/db";
import { clean, toId } from "@/lib/format";
import { ensureJob } from "@/lib/sites";

const MAX_ITEMS = 500;

// Send one or more devices for claim, sharing date/vendor/ticket.
// items: [{ device_id, symptom }] or, for a device not in the system,
//        [{ serial, mac?, brand?, model?, device_type?, location?, symptom,
//           site_id? | site_name?, job_name? }]
// A new device goes into job_name (default "อุปกรณ์เดิม (ไม่มีรายงาน)") at that site,
// so we know where it is installed; without a site it is added without a job.
export const POST = handler(async (request, { user }) => {
  const body = await request.json().catch(() => ({}));
  const sentOn = clean(body.sent_on);
  if (!sentOn || !/^\d{4}-\d{2}-\d{2}$/.test(sentOn)) return error("ใส่วันที่ส่งเคลม");
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) return error("ยังไม่มีอุปกรณ์ในรายการ");
  if (items.length > MAX_ITEMS) return error(`ส่งได้ครั้งละไม่เกิน ${MAX_ITEMS} รายการ`);
  const vendor = clean(body.vendor);
  const ticketNo = clean(body.ticket_no);
  const note = clean(body.note);

  const created = await transaction(async (db) => {
    const ids = [];
    for (const item of items) {
      let deviceId = item.device_id ? toId(item.device_id) : null;
      if (!deviceId) {
        const serial = clean(item.serial);
        if (!serial) throw new HttpError("อุปกรณ์ที่ไม่มีในระบบต้องมี serial");
        const dup = (
          await db.query(`SELECT place FROM device_overview WHERE lower(btrim(serial)) = lower($1) LIMIT 1`, [serial])
        ).rows[0];
        if (dup) throw new HttpError(`serial ${serial} มีอยู่แล้วที่ ${dup.place} · เลือกตัวนั้นแทน`, 409);
        const jobId =
          item.site_id || clean(item.site_name)
            ? await ensureJob(db, {
                site_id: item.site_id,
                site_name: item.site_name,
                job_name: item.job_name,
                note: "เพิ่มตอนส่งเคลม (ไม่มีรายงาน Inventory)",
              })
            : null;
        deviceId = (
          await db.query(
            `INSERT INTO devices (job_id, serial, mac, brand, model, device_type, location)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [jobId, serial, clean(item.mac), clean(item.brand), clean(item.model), clean(item.device_type), clean(item.location)]
          )
        ).rows[0].id;
      }

      const [dev] = (await db.query(`SELECT serial, status FROM device_overview WHERE id = $1`, [deviceId])).rows;
      if (!dev) throw new HttpError("ไม่พบอุปกรณ์บางตัว ลองโหลดหน้าใหม่", 404);
      const label = dev.serial || `อุปกรณ์ #${deviceId}`;
      if (dev.status === "claim") throw new HttpError(`${label} มีเคลมที่ยังไม่กลับอยู่แล้ว`, 409);
      if (dev.status === "replaced") throw new HttpError(`${label} ถูกแทนด้วยตัวใหม่แล้ว ส่งเคลมตัวใหม่แทน`, 409);

      try {
        const [claim] = (
          await db.query(
            `INSERT INTO claims (device_id, sent_on, symptom, vendor, ticket_no, note, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [deviceId, sentOn, clean(item.symptom), vendor, ticketNo, note, user.username]
          )
        ).rows;
        ids.push(claim.id);
      } catch (err) {
        // Same device twice in one batch hits the one-open-claim index
        if (err.code === "23505") throw new HttpError(`${label} อยู่ในรายการซ้ำ`, 409);
        throw err;
      }
    }
    return ids;
  });

  return json({ claim_ids: created, count: created.length }, 201);
});
