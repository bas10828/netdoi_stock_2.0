import { error, handler, json } from "@/lib/api";
import { query } from "@/lib/db";
import { toId } from "@/lib/format";

const COLUMNS = `id, serial, mac, brand, model, device_type, location, job_id, job_name, site_name, place, status`;

// Exact lookup (not a substring search): ?serial=X matches serial or MAC ignoring
// case/separators; ?id=N fetches one device. Used when adding items to a claim.
export const GET = handler(async (request) => {
  const params = request.nextUrl.searchParams;
  const id = toId(params.get("id"));
  if (id) return json({ devices: await query(`SELECT ${COLUMNS} FROM device_overview WHERE id = $1`, [id]) });

  const raw = (params.get("serial") ?? "").trim();
  if (!raw) return error("ใส่ serial");
  const key = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  const devices = await query(
    `SELECT ${COLUMNS} FROM device_overview
      WHERE lower(btrim(serial)) = lower($1)
         OR ($2 <> '' AND regexp_replace(lower(coalesce(mac, '')), '[^a-z0-9]', '', 'g') = $2)
      ORDER BY id`,
    [raw, key]
  );
  return json({ devices });
});
