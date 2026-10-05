import { handler, json } from "@/lib/api";
import { query } from "@/lib/db";

// Site names for the Import page's site picker
export const GET = handler(async () => {
  const sites = await query(
    `SELECT s.id, s.name, count(j.id)::int AS job_count
       FROM sites s LEFT JOIN jobs j ON j.site_id = s.id
      GROUP BY s.id
      ORDER BY s.name`
  );
  return json({ sites });
});
