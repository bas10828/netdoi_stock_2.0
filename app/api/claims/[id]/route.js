import { error, handler, json } from "@/lib/api";
import { query } from "@/lib/db";
import { clean, toId } from "@/lib/format";

const FIELDS = ["sent_on", "symptom", "vendor", "ticket_no", "note"];

// Edit an open claim's details (only fields present in the body)
export const PATCH = handler(async (request, { params }) => {
  const id = toId((await params).id);
  if (!id) return error("ไม่พบเคลม", 404);
  const body = await request.json().catch(() => ({}));
  const fields = FIELDS.filter((f) => f in body);
  if (fields.length === 0) return error("ไม่มีข้อมูลให้แก้ไข");
  if ("sent_on" in body && !/^\d{4}-\d{2}-\d{2}$/.test(clean(body.sent_on) ?? "")) return error("วันที่ส่งไม่ถูกต้อง");
  const rows = await query(
    `UPDATE claims SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(", ")}
      WHERE id = $1 AND returned_on IS NULL RETURNING id`,
    [id, ...fields.map((f) => clean(body[f]))]
  );
  if (rows.length === 0) return error("แก้ได้เฉพาะเคลมที่ยังไม่กลับ", 409);
  return json({ ok: true });
});

// Cancel a claim sent by mistake (open claims only)
export const DELETE = handler(async (request, { params }) => {
  const id = toId((await params).id);
  if (!id) return error("ไม่พบเคลม", 404);
  const rows = await query(`DELETE FROM claims WHERE id = $1 AND returned_on IS NULL RETURNING id`, [id]);
  if (rows.length === 0) return error("ยกเลิกได้เฉพาะเคลมที่ยังไม่กลับ", 409);
  return json({ ok: true });
});
