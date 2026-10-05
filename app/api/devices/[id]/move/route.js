import { error, handler, HttpError, json } from "@/lib/api";
import { transaction } from "@/lib/db";
import { clean, toId } from "@/lib/format";
import { recordMoves, snapshotDevices, todayIso } from "@/lib/moves";
import { ensureJob } from "@/lib/sites";

// Move one device to another job, optionally with a new location; records history.
// Target: job_id, or new_job { site_id | site_name, job_name } (found or created) —
// e.g. to say where a device from an old, unrecorded project is installed.
export const POST = handler(async (request, { params, user }) => {
  const id = toId((await params).id);
  if (!id) return error("ไม่พบอุปกรณ์", 404);
  const body = await request.json().catch(() => ({}));
  const newJob = body.new_job && (body.new_job.site_id || clean(body.new_job.site_name)) ? body.new_job : null;
  if (!newJob && !toId(body.job_id)) return error("เลือกงานปลายทาง");
  const movedOn = clean(body.moved_on) ?? todayIso();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(movedOn)) return error("วันที่ย้ายไม่ถูกต้อง");

  const result = await transaction(async (db) => {
    const [before] = await snapshotDevices(db, [id]);
    if (!before) throw new HttpError("ไม่พบอุปกรณ์", 404);
    const toJobId = newJob ? await ensureJob(db, newJob) : toId(body.job_id);
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
    // (a device that had no job is simply placed: there is nothing to move from)
    await recordMoves(db, [{ ...before, job_note: null }], {
      toJobId,
      movedOn,
      note: clean(body.note),
      createdBy: user.username,
    });
    return { ok: true, job_id: toJobId };
  });

  return json(result);
});
