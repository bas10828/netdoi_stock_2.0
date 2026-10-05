// Device relocation history (table device_moves). Use inside a transaction:
//   const before = await snapshotDevices(db, ids);   // before changing job_id
//   ...UPDATE devices SET job_id = ...
//   await recordMoves(db, before, { toJobId, movedOn, note, createdBy });

// Jobs made by scripts/migrate-legacy.mjs. Pulling a device out of one is data
// cleanup (the old system lost track of it), not a physical move, so no history.
export const LEGACY_JOB_NOTE = "นำเข้าจากระบบเดิม";

export async function snapshotDevices(db, deviceIds) {
  const { rows } = await db.query(
    `SELECT d.id, d.job_id, d.location, j.note AS job_note,
            coalesce(s.name, '?') || ' · ' || coalesce(j.name, '?') AS label
       FROM devices d
       LEFT JOIN jobs j ON j.id = d.job_id
       LEFT JOIN sites s ON s.id = j.site_id
      WHERE d.id = ANY($1::int[])
      FOR UPDATE OF d`,
    [deviceIds]
  );
  return rows;
}

// Inserts one move per device that really changed job; returns how many
export async function recordMoves(db, before, { toJobId, movedOn, note = null, createdBy = null }) {
  const moved = before.filter(
    (b) => b.job_id && b.job_id !== toJobId && !String(b.job_note ?? "").startsWith(LEGACY_JOB_NOTE)
  );
  if (moved.length === 0) return 0;

  const res = await db.query(
    `INSERT INTO device_moves (device_id, from_job_id, to_job_id, from_label, to_label,
                               from_location, to_location, moved_on, note, created_by)
     SELECT v.id, v.from_job_id, $1, v.from_label,
            coalesce(s.name, '?') || ' · ' || coalesce(j.name, '?'),
            v.from_location, d.location, $2, $3, $4
       FROM unnest($5::int[], $6::int[], $7::text[], $8::text[])
              AS v(id, from_job_id, from_label, from_location)
       JOIN devices d ON d.id = v.id
       JOIN jobs j ON j.id = $1
       JOIN sites s ON s.id = j.site_id`,
    [
      toJobId,
      movedOn,
      note,
      createdBy,
      moved.map((b) => b.id),
      moved.map((b) => b.job_id),
      moved.map((b) => b.label),
      moved.map((b) => b.location),
    ]
  );
  return res.rowCount;
}

export function todayIso() {
  // Server local date (Asia/Bangkok on the office machines)
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
