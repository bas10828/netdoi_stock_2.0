import { error, handler, json } from "@/lib/api";
import { query } from "@/lib/db";
import { clean, toId } from "@/lib/format";

// Set the warranty end date for every device installed in this job.
// only_empty (default true): leave devices that already have a date alone.
export const POST = handler(async (request, { params }) => {
  const id = toId((await params).id);
  if (!id) return error("ไม่พบงาน", 404);
  const body = await request.json().catch(() => ({}));
  const until = clean(body.warranty_until);
  if (!until || !/^\d{4}-\d{2}-\d{2}$/.test(until)) return error("ใส่วันหมดประกัน");
  const onlyEmpty = body.only_empty !== false;

  const rows = await query(
    `UPDATE devices SET warranty_until = $2
      WHERE job_id = $1 AND ($3 = false OR warranty_until IS NULL)
      RETURNING id`,
    [id, until, onlyEmpty]
  );
  return json({ updated: rows.length });
});
