import { error, handler, json } from "@/lib/api";
import { query } from "@/lib/db";
import { clean, toId } from "@/lib/format";
import { canonicalizeField } from "@/lib/catalog";

const FIELDS = ["device_type", "brand", "model", "serial", "mac", "device_name", "ip", "location", "note", "warranty_until"];

// Updates only the fields present in the body
export const PATCH = handler(async (request, { params }) => {
  const id = toId((await params).id);
  if (!id) return error("ไม่พบอุปกรณ์", 404);
  const body = await request.json().catch(() => ({}));
  const fields = FIELDS.filter((f) => f in body);
  const values = fields.map((f) => canonicalizeField(f, clean(body[f])));
  if ("warranty_until" in body && clean(body.warranty_until) && !/^\d{4}-\d{2}-\d{2}$/.test(clean(body.warranty_until))) {
    return error("วันหมดประกันไม่ถูกต้อง");
  }

  // Lifetime and an end date exclude each other: lifetime clears the date, a date clears lifetime
  if ("warranty_lifetime" in body) {
    values.push(body.warranty_lifetime === true);
    fields.push("warranty_lifetime");
    if (body.warranty_lifetime === true && !fields.includes("warranty_until")) {
      fields.push("warranty_until");
      values.push(null);
    } else if (body.warranty_lifetime === true) {
      values[fields.indexOf("warranty_until")] = null;
    }
  } else if (clean(body.warranty_until)) {
    fields.push("warranty_lifetime");
    values.push(false);
  }
  if (fields.length === 0) return error("ไม่มีข้อมูลให้แก้ไข");

  const [device] = await query(
    `UPDATE devices SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(", ")}
      WHERE id = $1 RETURNING id`,
    [id, ...values]
  );
  if (!device) return error("ไม่พบอุปกรณ์", 404);
  return json({ device });
});
