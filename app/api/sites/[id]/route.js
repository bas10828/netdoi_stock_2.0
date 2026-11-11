import { error, handler, isUniqueViolation, json } from "@/lib/api";
import { query } from "@/lib/db";
import { clean, toId } from "@/lib/format";

// name: Thai name (or the English one until a Thai name is known); name_en: optional,
// an empty value clears it. Fields left out of the body are kept.
export const PATCH = handler(async (request, { params }) => {
  const id = toId((await params).id);
  if (!id) return error("ไม่พบสถานที่", 404);
  const body = await request.json().catch(() => ({}));
  const name = clean(body.name);
  const nameEn = clean(body.name_en);
  if (!name) return error("กรอกชื่อสถานที่");

  try {
    const [site] = await query(
      `UPDATE sites SET name = $2,
              name_en = CASE WHEN $5 THEN $4 ELSE name_en END,
              note = CASE WHEN $6 THEN $3 ELSE note END
        WHERE id = $1 RETURNING id, name, name_en, note`,
      [id, name, clean(body.note), nameEn, "name_en" in body, "note" in body]
    );
    if (!site) return error("ไม่พบสถานที่", 404);
    return json({ site });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return err.constraint === "sites_name_en_key"
        ? error(`มีสถานที่ชื่ออังกฤษ “${nameEn}” อยู่แล้ว`, 409)
        : error(`มีสถานที่ชื่อ “${name}” อยู่แล้ว`, 409);
    }
    throw err;
  }
});
