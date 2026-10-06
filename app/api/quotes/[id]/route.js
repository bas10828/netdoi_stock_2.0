import { HttpError, handler, json } from "@/lib/api";
import { query } from "@/lib/db";
import { toId } from "@/lib/format";

// Remove a quotation (and its lines) from its job. Warranty already set from it stays.
export const DELETE = handler(async (_request, { params }) => {
  const id = toId((await params).id);
  if (!id) throw new HttpError("ไม่พบใบเสนอราคา", 404);
  const rows = await query("DELETE FROM quotes WHERE id = $1 RETURNING id", [id]);
  if (rows.length === 0) throw new HttpError("ไม่พบใบเสนอราคา", 404);
  return json({ deleted: id });
});
