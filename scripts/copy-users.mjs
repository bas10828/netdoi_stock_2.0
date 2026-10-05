// Copies users (with their bcrypt password hashes) from the v1 database.
// Only reads from v1. Existing usernames are left untouched, so it is safe to re-run.
// The v1 URL is passed on the command line and never stored in .env:
//   LEGACY_DATABASE_URL=postgresql://...@host:5432/netdoi npm run db:copy-users
import pg from "pg";

if (!process.env.LEGACY_DATABASE_URL) {
  console.error("Set LEGACY_DATABASE_URL (v1 database) to run this script.");
  process.exit(1);
}

const legacy = new pg.Client({ connectionString: process.env.LEGACY_DATABASE_URL });
const target = new pg.Client({ connectionString: process.env.DATABASE_URL });
await legacy.connect();
await target.connect();

// Read-only session on v1: any accidental write fails
await legacy.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY");
const { rows } = await legacy.query("SELECT username, email, password, priority FROM users");

let copied = 0;
for (const u of rows) {
  const role = u.priority === "admin" ? "admin" : "user";
  const res = await target.query(
    `INSERT INTO users (username, email, password, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (username) DO NOTHING`,
    [u.username, u.email, u.password, role]
  );
  copied += res.rowCount;
}

await legacy.end();
await target.end();
console.log(`Copied ${copied} of ${rows.length} users`);
