// Imports a TP-Link Omada Controller device export (CSV) into one site/job.
// For sites installed over several projects without Inventory reports.
//
//   node --env-file=.env scripts/import-omada.mjs <file.csv> --site "<site>" --job "<job>" [--dry-run]
//
// - Devices already in the system (same S/N or MAC) stay where they are; only
//   their empty fields are filled (type, name, IP, location, MAC, brand, model).
// - Others are added to the job (created at the site if needed).
// - "16_AP16_อาคารคหกรรม(ส่งตรวจสอบ)": name = whole, location = text after the
//   2nd "_", note = text in the trailing parentheses.
// One transaction; --dry-run rolls back after printing what would happen.
import { readFile } from "node:fs/promises";
import pg from "pg";

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const file = args.find((a) => !a.startsWith("--") && !Object.values({ s: opt("site"), j: opt("job") }).includes(a));
const siteName = opt("site");
const jobName = opt("job");
const dryRun = args.includes("--dry-run");
if (!file || !siteName || !jobName) {
  console.error('Usage: import-omada.mjs <file.csv> --site "<site>" --job "<job>" [--dry-run]');
  process.exit(1);
}

// Minimal CSV parser: quoted fields with "" escapes (Omada exports have no newlines in fields)
function parseLine(line) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') (cur += '"'), i++;
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") out.push(cur), (cur = "");
    else cur += c;
  }
  out.push(cur);
  return out;
}

const STATUS_WORDS = /เสีย|ชำรุด|ซ่อม|เคลม|ส่ง|ตรวจสอบ|ถอด|ไม่ใช้|หาย|broken|rma/i;

const value = (v) => {
  const s = String(v ?? "").trim();
  return s === "" || s === "-" ? null : s;
};

function toDevice(r) {
  const name = value(r["DEVICE NAME"]);
  let location = null;
  let note = null;
  if (name) {
    const parts = name.split("_");
    let rest = parts.length >= 3 ? parts.slice(2).join("_") : null;
    // Trailing "(...)": a condition ("เสีย", "ส่งตรวจสอบ") goes to the note,
    // anything else (usually a room, "(ห้องธุรการ)") stays in the location
    const paren = name.match(/\(([^()]*)\)\s*$/);
    if (paren && STATUS_WORDS.test(paren[1])) {
      note = `Omada: ${paren[1].trim()}`;
      if (rest) rest = rest.replace(/\(([^()]*)\)\s*$/, "");
    } else if (paren && rest) {
      rest = rest.replace(/\s*\(([^()]*)\)\s*$/, " ($1)");
    }
    location = value(rest);
  }
  const model = value(r["MODEL"])?.replace(/\s+v[\d.]+$/i, "") ?? null;
  const macHex = (r["MAC ADDRESS"] ?? "").replace(/[^0-9a-f]/gi, "").toUpperCase();
  return {
    serial: value(r["SERIAL NUMBER"]),
    mac: macHex.length === 12 ? macHex.match(/.{2}/g).join(":") : null,
    macKey: macHex.toLowerCase(),
    model,
    brand: "TP-Link",
    device_type: /^EAP/i.test(model ?? "") ? "Access Point" : /^(TL-)?(SG|ES|SX|SL)/i.test(model ?? "") ? "Switch" : /^ER/i.test(model ?? "") ? "Router" : null,
    device_name: name,
    ip: value(r["IP ADDRESS"]),
    location,
    note,
  };
}

const text = (await readFile(file, "utf8")).replace(/^﻿/, "");
const lines = text.split(/\r?\n/).filter((l) => l.trim());
const head = parseLine(lines[0]).map((h) => h.trim());
if (!head.includes("SERIAL NUMBER") || !head.includes("MAC ADDRESS")) {
  console.error("This doesn't look like an Omada device export (no SERIAL NUMBER / MAC ADDRESS columns).");
  process.exit(1);
}
const devices = lines.slice(1).map((l) => toDevice(Object.fromEntries(parseLine(l).map((v, i) => [head[i], v]))));

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
await db.query("BEGIN");
try {
  const [site] = (
    await db.query(
      `INSERT INTO sites (name) VALUES ($1)
       ON CONFLICT ((lower(btrim(name)))) DO UPDATE SET name = sites.name RETURNING id`,
      [siteName]
    )
  ).rows;
  let [job] = (await db.query(`SELECT id FROM jobs WHERE site_id = $1 AND name = $2 LIMIT 1`, [site.id, jobName])).rows;
  job ??= (
    await db.query(`INSERT INTO jobs (site_id, name, note) VALUES ($1, $2, $3) RETURNING id`, [
      site.id,
      jobName,
      `นำเข้าจาก Omada Controller (${file.split(/[\\/]/).pop()})`,
    ])
  ).rows[0];

  const stats = { added: 0, enriched: 0, unchanged: 0 };
  for (const d of devices) {
    const [existing] = (
      await db.query(
        `SELECT id FROM devices
          WHERE ($1::text IS NOT NULL AND lower(btrim(serial)) = lower(btrim($1)))
             OR ($2 <> '' AND regexp_replace(lower(coalesce(mac, '')), '[^a-z0-9]', '', 'g') = $2)
          ORDER BY id LIMIT 1`,
        [d.serial, d.macKey]
      )
    ).rows;
    if (existing) {
      // Fill only what is missing; append the Omada note if it isn't there yet
      const res = await db.query(
        `UPDATE devices SET
           device_type = COALESCE(device_type, $2), device_name = COALESCE(device_name, $3),
           ip = COALESCE(ip, $4), location = COALESCE(location, $5), mac = COALESCE(mac, $6),
           brand = COALESCE(brand, $7), model = COALESCE(model, $8),
           note = CASE WHEN $9::text IS NULL OR coalesce(note, '') LIKE '%' || $9 || '%' THEN note
                       WHEN note IS NULL THEN $9 ELSE note || E'\\n' || $9 END
         WHERE id = $1
           AND (device_type IS NULL OR device_name IS NULL OR ip IS NULL OR location IS NULL OR mac IS NULL
                OR brand IS NULL OR model IS NULL OR ($9::text IS NOT NULL AND coalesce(note, '') NOT LIKE '%' || $9 || '%'))`,
        [existing.id, d.device_type, d.device_name, d.ip, d.location, d.mac, d.brand, d.model, d.note]
      );
      stats[res.rowCount ? "enriched" : "unchanged"] += 1;
    } else {
      await db.query(
        `INSERT INTO devices (job_id, device_type, brand, model, serial, mac, device_name, ip, location, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [job.id, d.device_type, d.brand, d.model, d.serial, d.mac, d.device_name, d.ip, d.location, d.note]
      );
      stats.added += 1;
    }
  }

  await db.query(dryRun ? "ROLLBACK" : "COMMIT");
  console.log(
    `${dryRun ? "[dry run, nothing saved] " : ""}${devices.length} devices: ${stats.added} added to "${siteName} · ${jobName}", ` +
      `${stats.enriched} existing filled in, ${stats.unchanged} existing unchanged`
  );
} catch (err) {
  await db.query("ROLLBACK");
  console.error("Import failed, nothing saved:", err.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
