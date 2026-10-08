import pg from "pg";

// DATE columns come back as "YYYY-MM-DD" strings, not Date objects at local midnight,
// so they don't shift by a day when the server runs in another timezone.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

// One pool per process: shared across hot reloads in dev, and between proxy.js
// and the app (they are bundled separately) so the DB sees at most `max` connections
const globalForPg = globalThis;
export const pool =
  globalForPg.__netdoiPool ?? new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
globalForPg.__netdoiPool = pool;

export async function query(text, params) {
  const { rows } = await pool.query(text, params);
  return rows;
}

// Runs fn(client) inside BEGIN/COMMIT; rolls back if it throws
export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
