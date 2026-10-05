// Applies db/schema.sql as the app role (DATABASE_URL in .env).
// The database, role and schema are created once by scripts/setup-db.mjs.
// Usage: npm run db:migrate
import { readFile } from "node:fs/promises";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const sql = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
await client.query(sql);
await client.end();
console.log("Schema applied");
