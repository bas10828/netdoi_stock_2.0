import { handler, json } from "@/lib/api";
import { query } from "@/lib/db";

// Job picker: search by job or site name, newest first
export const GET = handler(async (request) => {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  const jobs = await query(
    `SELECT j.id, j.name, j.delivered_on, s.id AS site_id, s.name AS site_name
       FROM jobs j JOIN sites s ON s.id = j.site_id
      WHERE $1 = '' OR lower(j.name) LIKE '%' || $1 || '%' OR lower(s.name) LIKE '%' || $1 || '%'
      ORDER BY j.delivered_on DESC NULLS LAST, j.id DESC
      LIMIT 30`,
    [q]
  );
  return json({ jobs });
});
