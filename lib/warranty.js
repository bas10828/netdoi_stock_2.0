import { HttpError } from "./api";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isId = (n) => Number.isInteger(n) && n > 0 && n < 2 ** 31;

// groups: [{ ids: [deviceId, ...], years: 3 } | { ids: [...], lifetime: true } | { ids: [...], clear: true }].
// Throws HttpError(400) when malformed.
export function checkWarrantyGroups(groups, start) {
  if (!Array.isArray(groups) || groups.length === 0) throw new HttpError("เลือกประกันอย่างน้อย 1 กลุ่ม");
  for (const g of groups) {
    if (!Array.isArray(g.ids) || g.ids.length === 0 || !g.ids.every(isId)) throw new HttpError("รายการอุปกรณ์ไม่ถูกต้อง");
    if (g.clear !== true && g.lifetime !== true && !(Number.isInteger(g.years) && g.years >= 1 && g.years <= 10)) throw new HttpError("จำนวนปีประกันไม่ถูกต้อง");
  }
  if (groups.some((g) => g.lifetime !== true && g.clear !== true) && !DATE.test(start ?? "")) throw new HttpError("ใส่วันเริ่มประกัน");
}

// Sets warranty on the given devices, but only those installed in this job (a device the job merely lists
// stays untouched). The end date is computed in SQL so the server's timezone can't shift it by a day.
// onlyEmpty: skip devices that already have a date or Lifetime (a "clear" group ignores it: clearing is explicit).
// Returns how many devices changed.
export async function applyWarranty(db, jobId, groups, start, onlyEmpty) {
  let count = 0;
  for (const g of groups) {
    if (g.clear === true) {
      const res = await db.query(
        "UPDATE devices SET warranty_until = NULL, warranty_lifetime = false WHERE job_id = $1 AND id = ANY($2::int[])",
        [jobId, g.ids]
      );
      count += res.rowCount;
      continue;
    }
    const lifetime = g.lifetime === true;
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
}
