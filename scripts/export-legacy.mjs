// Dumps the v1 tables needed for migration to db/legacy/*.json.
// Read-only: the session is set READ ONLY, so any write would fail.
// The v1 URL is passed on the command line and never stored:
//   LEGACY_DATABASE_URL=postgresql://...@host:5432/netdoi npm run db:export-legacy
import { mkdir, writeFile } from "node:fs/promises";
import pg from "pg";

if (!process.env.LEGACY_DATABASE_URL) {
  console.error("Set LEGACY_DATABASE_URL (v1 database) to run this script.");
  process.exit(1);
}

const db = new pg.Client({ connectionString: process.env.LEGACY_DATABASE_URL });
await db.connect();
await db.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY");
await db.query("BEGIN READ ONLY");

const equipment = (await db.query("SELECT * FROM equipment ORDER BY id")).rows;
const comments = (await db.query("SELECT * FROM comment ORDER BY 1")).rows;

await db.query("COMMIT");
await db.end();

const dir = new URL("../db/legacy/", import.meta.url);
await mkdir(dir, { recursive: true });
await writeFile(new URL("equipment.json", dir), JSON.stringify(equipment, null, 1));
await writeFile(new URL("comments.json", dir), JSON.stringify(comments, null, 1));
console.log(`Exported ${equipment.length} equipment rows, ${comments.length} comments to db/legacy/`);
