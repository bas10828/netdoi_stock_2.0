import { error, handler, json } from "@/lib/api";
import { query } from "@/lib/db";

// Which of these serials already exist? Used to warn before importing.
export const POST = handler(async (request) => {
  const body = await request.json().catch(() => ({}));
  if (!Array.isArray(body.serials)) return error("serials ต้องเป็น array");
  const keys = [...new Set(body.serials.map((s) => String(s ?? "").trim().toLowerCase()).filter(Boolean))].slice(0, 10000);
  if (keys.length === 0) return json({ existing: [] });

  const existing = await query(
    `SELECT id, serial, site_name, job_name
       FROM device_overview
      WHERE lower(btrim(serial)) = ANY($1::text[])
      ORDER BY id`,
    [keys]
  );
  return json({ existing });
});
