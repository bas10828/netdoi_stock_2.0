import { HttpError, handler, json } from "@/lib/api";
import { transaction } from "@/lib/db";
import { clean, toId } from "@/lib/format";

// Set warranty on devices installed in this job, one group (same brand + model) at a time.
//   body: { start: "YYYY-MM-DD", only_empty?: true,
//           groups: [{ ids: [deviceId, ...], years?: 3 } | { ids: [...], lifetime: true }] }
// years: end date = start + N years. lifetime: no end date. Only devices whose job_id is
// this job are touched, so a device listed here but installed elsewhere is never changed.
export const POST = handler(async (request, { params }) => {
  const jobId = toId((await params).id);
  if (!jobId) throw new HttpError("ไม่พบงาน", 404);
  const body = await request.json().catch(() => ({}));
  const start = clean(body.start);
  const onlyEmpty = body.only_empty !== false;
  const groups = Array.isArray(body.groups) ? body.groups : [];
  if (groups.length === 0) throw new HttpError("เลือกประกันอย่างน้อย 1 กลุ่ม");

  for (const g of groups) {
    const ids = Array.isArray(g.ids) ? g.ids : [];
    if (ids.length === 0 || !ids.every((n) => Number.isInteger(n) && n > 0 && n < 2 ** 31)) throw new HttpError("รายการอุปกรณ์ไม่ถูกต้อง");
    if (g.lifetime !== true && !(Number.isInteger(g.years) && g.years >= 1 && g.years <= 10)) throw new HttpError("จำนวนปีประกันไม่ถูกต้อง");
  }
  if (groups.some((g) => g.lifetime !== true) && !(start && /^\d{4}-\d{2}-\d{2}$/.test(start))) throw new HttpError("ใส่วันเริ่มประกัน");

  const updated = await transaction(async (db) => {
    let count = 0;
    for (const g of groups) {
      const lifetime = g.lifetime === true;
      // End date is computed in SQL so the server's timezone can't shift it by a day
      const res = await db.query(
        `UPDATE devices
            SET warranty_until = CASE WHEN $3::boolean THEN NULL ELSE ($4::date + make_interval(years => $5::int))::date END,
                warranty_lifetime = $3::boolean
          WHERE job_id = $1 AND id = ANY($2::int[])
            AND ($6::boolean = false OR (warranty_until IS NULL AND NOT warranty_lifetime))`,
        [jobId, g.ids, lifetime, lifetime ? null : start, lifetime ? 0 : g.years, onlyEmpty]
      );
      count += res.rowCount;
    }
    return count;
  });
  return json({ updated });
});
