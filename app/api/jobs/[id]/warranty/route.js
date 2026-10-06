import { HttpError, handler, json } from "@/lib/api";
import { transaction } from "@/lib/db";
import { clean, toId } from "@/lib/format";
import { applyWarranty, checkWarrantyGroups } from "@/lib/warranty";

// Set warranty on devices installed in this job, one group (same brand + model) at a time.
//   body: { start: "YYYY-MM-DD", only_empty?: true,
//           groups: [{ ids: [deviceId, ...], years?: 3 } | { ids: [...], lifetime: true }] }
export const POST = handler(async (request, { params }) => {
  const jobId = toId((await params).id);
  if (!jobId) throw new HttpError("ไม่พบงาน", 404);
  const body = await request.json().catch(() => ({}));
  const start = clean(body.start);
  checkWarrantyGroups(body.groups, start);
  const updated = await transaction((db) => applyWarranty(db, jobId, body.groups, start, body.only_empty !== false));
  return json({ updated });
});
