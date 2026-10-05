import { error, handler, json } from "@/lib/api";
import { query } from "@/lib/db";
import { clean, toId } from "@/lib/format";

const FIELDS = ["name", "delivered_on", "po_number", "note"];

// Updates only the fields present in the body
export const PATCH = handler(async (request, { params }) => {
  const id = toId((await params).id);
  if (!id) return error("ไม่พบงาน", 404);
  const body = await request.json().catch(() => ({}));
  const fields = FIELDS.filter((f) => f in body);
  if (fields.length === 0) return error("ไม่มีข้อมูลให้แก้ไข");
  if ("name" in body && !clean(body.name)) return error("กรอกชื่องาน");
  const deliveredOn = clean(body.delivered_on);
  if (deliveredOn && !/^\d{4}-\d{2}-\d{2}$/.test(deliveredOn)) return error("วันส่งงานไม่ถูกต้อง");

  const [job] = await query(
    `UPDATE jobs SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(", ")}
      WHERE id = $1 RETURNING id`,
    [id, ...fields.map((f) => clean(body[f]))]
  );
  if (!job) return error("ไม่พบงาน", 404);
  return json({ job });
});
