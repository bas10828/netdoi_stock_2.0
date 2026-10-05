// One-time setup, run with a superuser connection. Creates:
//   - database netdoi_v2 (if missing)
//   - login role netdoi_stock: no superuser, no createdb, no createrole
//   - schema "stock" owned by netdoi_stock; the role can only work inside it
// The superuser URL is passed on the command line and never stored in .env:
//   ADMIN_DATABASE_URL=postgresql://postgres:...@host:5432/postgres npm run db:setup
// Prints the DATABASE_URL to put in .env.
import crypto from "node:crypto";
import pg from "pg";

const DB = "netdoi_v2";
const ROLE = "netdoi_stock";
const SCHEMA = "stock";

const adminUrl = process.env.ADMIN_DATABASE_URL;
if (!adminUrl) {
  console.error("Set ADMIN_DATABASE_URL (superuser) to run this script.");
  process.exit(1);
}

const password = crypto.randomBytes(24).toString("base64url");

const admin = new pg.Client({ connectionString: adminUrl });
await admin.connect();

const dbExists = (await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [DB])).rowCount > 0;
if (!dbExists) await admin.query(`CREATE DATABASE ${DB}`);

const roleExists = (await admin.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [ROLE])).rowCount > 0;
const roleVerb = roleExists ? "ALTER" : "CREATE";
// Password is base64url, so it is safe inside a quoted literal
await admin.query(
  `${roleVerb} ROLE ${ROLE} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${password}'`
);
await admin.end();

// Inside netdoi_v2: lock down public, give the role its own schema
const dbUrl = new URL(adminUrl);
dbUrl.pathname = `/${DB}`;
const db = new pg.Client({ connectionString: dbUrl.toString() });
await db.connect();
await db.query(`
  REVOKE CONNECT, TEMPORARY ON DATABASE ${DB} FROM PUBLIC;
  GRANT CONNECT ON DATABASE ${DB} TO ${ROLE};
  REVOKE ALL ON SCHEMA public FROM PUBLIC;
  CREATE SCHEMA IF NOT EXISTS ${SCHEMA} AUTHORIZATION ${ROLE};
  ALTER ROLE ${ROLE} IN DATABASE ${DB} SET search_path = ${SCHEMA};
`);
await db.end();

const appUrl = new URL(dbUrl);
appUrl.username = ROLE;
appUrl.password = password;
console.log(`Role ${ROLE} ready${roleExists ? " (password reset)" : ""}. Put this in .env:`);
console.log(`DATABASE_URL=${appUrl.toString()}`);
