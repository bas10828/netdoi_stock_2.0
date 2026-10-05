// Migrates v1 equipment (db/legacy/equipment.json) into sites/jobs/devices
// following db/legacy/mapping.xlsx. Runs as the app role (DATABASE_URL).
//
//   npm run db:migrate-legacy            add rows not migrated yet (safe to re-run)
//   npm run db:migrate-legacy -- --reset remove previously migrated rows first,
//                                        e.g. after editing mapping.xlsx
//
// Only rows with a serial are migrated; v1 comments become the device note.
import { readFile } from "node:fs/promises";
import pg from "pg";
import * as XLSX from "xlsx";

const JOB_NOTE_PREFIX = "นำเข้าจากระบบเดิม";
const reset = process.argv.includes("--reset");
const file = (name) => new URL(`../db/legacy/${name}`, import.meta.url);

const equipment = JSON.parse(await readFile(file("equipment.json"), "utf8"));
const comments = JSON.parse(await readFile(file("comments.json"), "utf8"));
const book = XLSX.read(await readFile(file("mapping.xlsx")));
const mapping = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval: "", raw: false });

const text = (v) => String(v ?? "").trim();
const mapByProject = new Map(
  mapping.map((m) => [text(m["project เดิม"]) === "(ว่าง)" ? "" : text(m["project เดิม"]), m])
);

// v1 comments by serial, oldest first, as "[2024-07-08 bas10828] text"
const notesBySerial = new Map();
for (const c of [...comments].sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)))) {
  const key = text(c.serial).toLowerCase();
  if (!key || !text(c.comment_text)) continue;
  const line = `[${String(c.timestamp ?? "").slice(0, 10)} ${text(c.user)}] ${text(c.comment_text)}`;
  notesBySerial.set(key, [...(notesBySerial.get(key) ?? []), line]);
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
await db.query("BEGIN");
try {
  if (reset) {
    const d = await db.query(
      `DELETE FROM devices d WHERE legacy_equipment_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM claims c WHERE c.device_id = d.id OR c.replacement_device_id = d.id)`
    );
    const j = await db.query(
      `DELETE FROM jobs j WHERE note LIKE $1 || '%' AND NOT EXISTS (SELECT 1 FROM devices d WHERE d.job_id = j.id)`,
      [JOB_NOTE_PREFIX]
    );
    const s = await db.query(`DELETE FROM sites s WHERE NOT EXISTS (SELECT 1 FROM jobs j WHERE j.site_id = s.id)`);
    console.log(`Reset: removed ${d.rowCount} devices, ${j.rowCount} jobs, ${s.rowCount} empty sites`);
  }

  const jobIds = new Map(); // "site|job|date" -> job id
  const stats = { migrated: 0, existing: 0, noSerial: 0, skippedProject: 0 };

  for (const r of equipment) {
    const project = text(r.project);
    const m = mapByProject.get(project);
    if (!m || text(m["นำเข้า (Y/N)"]).toUpperCase() !== "Y" || !text(m["สถานที่"])) {
      stats.skippedProject += 1;
      continue;
    }
    if (!text(r.serial)) {
      stats.noSerial += 1;
      continue;
    }

    const siteName = text(m["สถานที่"]);
    const jobName = text(m["ชื่องาน"]) || "ข้อมูลจากระบบเดิม";
    const date = /^\d{4}-\d{2}-\d{2}$/.test(text(m["วันส่งงาน"])) ? text(m["วันส่งงาน"]) : null;
    const jobKey = `${siteName.toLowerCase()}|${jobName}|${date}`;

    let jobId = jobIds.get(jobKey);
    if (!jobId) {
      const [site] = (
        await db.query(
          `INSERT INTO sites (name) VALUES ($1)
           ON CONFLICT ((lower(btrim(name)))) DO UPDATE SET name = sites.name RETURNING id`,
          [siteName]
        )
      ).rows;
      const found = await db.query(
        `SELECT id FROM jobs WHERE site_id = $1 AND name = $2 AND delivered_on IS NOT DISTINCT FROM $3::date
           AND note LIKE $4 || '%' LIMIT 1`,
        [site.id, jobName, date, JOB_NOTE_PREFIX]
      );
      jobId =
        found.rows[0]?.id ??
        (
          await db.query(
            `INSERT INTO jobs (site_id, name, delivered_on, note) VALUES ($1, $2, $3, $4) RETURNING id`,
            [site.id, jobName, date, `${JOB_NOTE_PREFIX}: ${project || "(ไม่มี project)"}`]
          )
        ).rows[0].id;
      jobIds.set(jobKey, jobId);
    }

    const note = notesBySerial.get(text(r.serial).toLowerCase())?.join("\n") || null;
    const res = await db.query(
      `INSERT INTO devices (job_id, brand, model, serial, mac, note, legacy_equipment_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (legacy_equipment_id) DO NOTHING`,
      [jobId, text(r.brand) || null, text(r.model) || null, text(r.serial), text(r.mac) || null, note, r.id]
    );
    stats[res.rowCount ? "migrated" : "existing"] += 1;
  }

  await db.query("COMMIT");
  console.log(
    `Migrated ${stats.migrated} devices (${stats.existing} already there). ` +
      `Skipped: ${stats.noSerial} without serial, ${stats.skippedProject} in projects marked N.`
  );
} catch (err) {
  await db.query("ROLLBACK");
  console.error("Migration failed, nothing saved:", err.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
