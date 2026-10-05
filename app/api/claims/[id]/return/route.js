import { error, handler, HttpError, json } from "@/lib/api";
import { transaction } from "@/lib/db";
import { clean, toId } from "@/lib/format";

const RESULTS = ["repaired", "replaced", "rejected"];

// Close an open claim. For "replaced" a new device is created in the old one's
// job and location, and takes over the old one's places in other jobs' reports.
export const POST = handler(async (request, { params }) => {
  const id = toId((await params).id);
  if (!id) return error("ไม่พบเคลม", 404);
  const body = await request.json().catch(() => ({}));
  const returnedOn = clean(body.returned_on);
  if (!returnedOn || !/^\d{4}-\d{2}-\d{2}$/.test(returnedOn)) return error("ใส่วันที่รับคืน");
  if (!RESULTS.includes(body.result)) return error("เลือกผลการเคลม");
  const newSerial = clean(body.replacement?.serial);
  if (body.result === "replaced" && !newSerial) return error("กรอก serial ตัวใหม่");

  const result = await transaction(async (db) => {
    const [claim] = (
      await db.query(
        `SELECT c.id, c.device_id, c.sent_on, c.returned_on, c.note FROM claims c WHERE c.id = $1 FOR UPDATE`,
        [id]
      )
    ).rows;
    if (!claim) throw new HttpError("ไม่พบเคลม", 404);
    if (claim.returned_on) throw new HttpError("เคลมนี้รับคืนไปแล้ว", 409);
    if (returnedOn < claim.sent_on) throw new HttpError("วันรับคืนต้องไม่ก่อนวันส่งเคลม");

    // The replacement must exist before the claim can point at it (CHECK constraints)
    let replacementId = null;
    if (body.result === "replaced") {
      const dup = (
        await db.query(`SELECT place FROM device_overview WHERE lower(btrim(serial)) = lower($1) LIMIT 1`, [newSerial])
      ).rows[0];
      if (dup) throw new HttpError(`serial ${newSerial} มีอยู่แล้วที่ ${dup.place}`, 409);
      replacementId = (
        await db.query(
          `INSERT INTO devices (job_id, device_type, brand, model, serial, mac, device_name, ip, location)
           SELECT job_id, device_type, COALESCE($2, brand), COALESCE($3, model), $4, $5, device_name, ip, location
             FROM devices WHERE id = $1
           RETURNING id`,
          [claim.device_id, clean(body.replacement?.brand), clean(body.replacement?.model), newSerial, clean(body.replacement?.mac)]
        )
      ).rows[0].id;
      // Other jobs' reports now list the new unit instead of the dead one
      await db.query(`UPDATE job_device_refs SET device_id = $2 WHERE device_id = $1`, [claim.device_id, replacementId]);
    }

    const extra = clean(body.note);
    await db.query(
      `UPDATE claims SET returned_on = $2, result = $3, replacement_device_id = $4,
              note = CASE WHEN $5::text IS NULL THEN note WHEN note IS NULL THEN $5 ELSE note || E'\\n' || $5 END
        WHERE id = $1`,
      [id, returnedOn, body.result, replacementId, extra]
    );
    return { ok: true, replacement_device_id: replacementId };
  });

  return json(result);
});
