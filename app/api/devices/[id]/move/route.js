import { error, handler, HttpError, json } from "@/lib/api";
import { transaction } from "@/lib/db";
import { clean, toId } from "@/lib/format";
import { recordMoves, snapshotDevices, todayIso } from "@/lib/moves";

// Move one device to another job, optionally with a new location; records history
export const POST = handler(async (request, { params, user }) => {
  const id = toId((await params).id);
  if (!id) return error("ไม่พบอุปกรณ์", 404);
  const body = await request.json().catch(() => ({}));
  const toJobId = toId(body.job_id);
  if (!toJobId) return error("เลือกงานปลายทาง");
  const movedOn = clean(body.moved_on) ?? todayIso();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(movedOn)) return error("วันที่ย้ายไม่ถูกต้อง");

  const result = await transaction(async (db) => {
    const [before] = await snapshotDevices(db, [id]);
    if (!before) throw new HttpError("ไม่พบอุปกรณ์", 404);
    if (before.job_id === toJobId) throw new HttpError("อุปกรณ์อยู่ในงานนี้อยู่แล้ว", 400);
    const { rowCount } = await db.query(`SELECT 1 FROM jobs WHERE id = $1`, [toJobId]);
    if (!rowCount) throw new HttpError("ไม่พบงานปลายทาง", 404);

    // Blank location keeps the current one
    await db.query(`UPDATE devices SET job_id = $2, location = COALESCE($3, location) WHERE id = $1`, [
      id,
      toJobId,
      clean(body.location),
    ]);
    // Always record a manual move, even out of a legacy-migrated job
    await recordMoves(db, [{ ...before, job_note: null }], {
      toJobId,
      movedOn,
      note: clean(body.note),
      createdBy: user.username,
    });
    return { ok: true };
  });

  return json(result);
});
