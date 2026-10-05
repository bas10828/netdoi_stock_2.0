// Rewrites devices.brand and devices.device_type to the canonical spelling in
// lib/catalog.js. Only changes spelling; never fills in empty values.
//
//   node --env-file=.env scripts/normalize-catalog.mjs --dry-run   # preview
//   node --env-file=.env scripts/normalize-catalog.mjs             # apply
//
// Applying first saves every changed row's old values to
// db/legacy/normalize-catalog-<time>.json so it can be undone.
import { mkdir, writeFile } from "node:fs/promises";
import pg from "pg";
import { fixDevice } from "../lib/catalog.js";

const dryRun = process.argv.includes("--dry-run");
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const { rows } = await db.query("SELECT id, brand, device_type FROM devices ORDER BY id");
const changes = [];
for (const r of rows) {
  const fixed = fixDevice(r);
  if ((fixed.brand ?? null) !== (r.brand ?? null) || (fixed.device_type ?? null) !== (r.device_type ?? null)) {
    changes.push({ id: r.id, from: { brand: r.brand, device_type: r.device_type }, to: fixed });
  }
}

// Summary: old spelling -> new, with counts
const summary = {};
for (const c of changes) {
  for (const f of ["brand", "device_type"]) {
    if ((c.from[f] ?? null) !== (c.to[f] ?? null)) {
      const k = `${f}: ${c.from[f] ?? "∅"} → ${c.to[f] ?? "∅"}`;
      summary[k] = (summary[k] ?? 0) + 1;
    }
  }
}
console.log(`${changes.length} of ${rows.length} devices change:`);
for (const [k, n] of Object.entries(summary).sort()) console.log(`  ${k}  (${n})`);

if (dryRun || changes.length === 0) {
  if (dryRun) console.log("[dry run, nothing saved]");
  await db.end();
  process.exit(0);
}

const dir = new URL("../db/legacy/", import.meta.url);
await mkdir(dir, { recursive: true });
const backup = new URL(`normalize-catalog-${new Date().toISOString().replace(/[:.]/g, "-")}.json`, dir);
await writeFile(backup, JSON.stringify(changes, null, 1));

await db.query("BEGIN");
try {
  await db.query(
    `UPDATE devices d SET brand = v.brand, device_type = v.device_type
       FROM unnest($1::int[], $2::text[], $3::text[]) AS v(id, brand, device_type)
      WHERE d.id = v.id`,
    [changes.map((c) => c.id), changes.map((c) => c.to.brand), changes.map((c) => c.to.device_type)]
  );
  await db.query("COMMIT");
  console.log(`Updated ${changes.length} devices. Old values saved to ${backup.pathname.split("/").pop()}`);
} catch (err) {
  await db.query("ROLLBACK");
  console.error("Failed, nothing changed:", err.message);
  process.exitCode = 1;
}
await db.end();
