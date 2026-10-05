import { error, handler, isUniqueViolation, json } from "@/lib/api";
import { query } from "@/lib/db";
import { clean, toId } from "@/lib/format";

export const PATCH = handler(async (request, { params }) => {
  const id = toId((await params).id);
  if (!id) return error("ไม่พบสถานที่", 404);
  const body = await request.json().catch(() => ({}));
  const name = clean(body.name);
  if (!name) return error("กรอกชื่อสถานที่");

  try {
    const [site] = await query(
      `UPDATE sites SET name = $2, note = CASE WHEN $4 THEN $3 ELSE note END WHERE id = $1 RETURNING id, name, note`,
      [id, name, clean(body.note), "note" in body]
    );
    if (!site) return error("ไม่พบสถานที่", 404);
    return json({ site });
  } catch (err) {
    if (isUniqueViolation(err)) return error(`มีสถานที่ชื่อ “${name}” อยู่แล้ว`, 409);
    throw err;
  }
});
