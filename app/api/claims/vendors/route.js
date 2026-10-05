import { handler, json } from "@/lib/api";
import { query } from "@/lib/db";

// Service centres used before, most used first (for the vendor field)
export const GET = handler(async () => {
  const rows = await query(
    `SELECT vendor FROM claims WHERE vendor IS NOT NULL GROUP BY vendor ORDER BY count(*) DESC, vendor LIMIT 50`
  );
  return json({ vendors: rows.map((r) => r.vendor) });
});
