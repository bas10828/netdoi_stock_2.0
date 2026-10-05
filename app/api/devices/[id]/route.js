import { error, handler, json } from "@/lib/api";
import { query } from "@/lib/db";
import { clean, toId } from "@/lib/format";

const FIELDS = ["device_type", "brand", "model", "serial", "mac", "device_name", "ip", "location", "note"];

// Updates only the fields present in the body
export const PATCH = handler(async (request, { params }) => {
  const id = toId((await params).id);
  if (!id) return error("ไม่พบอุปกรณ์", 404);
  const body = await request.json().catch(() => ({}));
  const fields = FIELDS.filter((f) => f in body);
  if (fields.length === 0) return error("ไม่มีข้อมูลให้แก้ไข");

  const [device] = await query(
    `UPDATE devices SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(", ")}
      WHERE id = $1 RETURNING id`,
    [id, ...fields.map((f) => clean(body[f]))]
  );
  if (!device) return error("ไม่พบอุปกรณ์", 404);
  return json({ device });
});
