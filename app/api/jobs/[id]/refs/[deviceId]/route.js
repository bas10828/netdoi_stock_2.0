import { error, handler, json } from "@/lib/api";
import { query } from "@/lib/db";
import { toId } from "@/lib/format";

// Stop listing a device in this job's report (the device itself is untouched)
export const DELETE = handler(async (request, { params }) => {
  const { id, deviceId } = await params;
  const jobId = toId(id);
  const devId = toId(deviceId);
  if (!jobId || !devId) return error("ไม่พบรายการ", 404);
  const rows = await query(`DELETE FROM job_device_refs WHERE job_id = $1 AND device_id = $2 RETURNING device_id`, [jobId, devId]);
  if (rows.length === 0) return error("ไม่พบรายการ", 404);
  return json({ ok: true });
});
