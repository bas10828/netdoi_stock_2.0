import { error, handler, json } from "@/lib/api";
import { query } from "@/lib/db";

// Which of these serials already exist? Used to warn before importing.
export const POST = handler(async (request) => {
  const body = await request.json().catch(() => ({}));
  if (!Array.isArray(body.serials)) return error("serials ต้องเป็น array");
  const keys = [...new Set(body.serials.map((s) => String(s ?? "").trim().toLowerCase()).filter(Boolean))].slice(0, 10000);
  if (keys.length === 0) return json({ existing: [] });

  const existing = await query(
    `SELECT d.id, d.serial, d.site_id, d.site_name, d.job_name, d.place, d.location,
            -- other jobs whose report already lists this device ("site · job")
            coalesce((SELECT json_agg(s.name || ' · ' || j.name ORDER BY j.id)
                        FROM job_device_refs r JOIN jobs j ON j.id = r.job_id JOIN sites s ON s.id = j.site_id
                       WHERE r.device_id = d.id), '[]') AS shared_in
       FROM device_overview d
      WHERE lower(btrim(d.serial)) = ANY($1::text[])
      ORDER BY d.id`,
    [keys]
  );
  return json({ existing });
});
