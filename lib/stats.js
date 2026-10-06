// Numbers for the dashboard and the Excel report
import { query } from "./db";
import { brandGroup, typeGroup } from "./catalog";

// [{ label, n }] -> grouped counts, largest first; the long tail becomes "อื่นๆ"
function topGroups(rows, groupOf, limit) {
  const totals = new Map();
  for (const r of rows) {
    const g = groupOf(r);
    totals.set(g, (totals.get(g) ?? 0) + r.n);
  }
  const sorted = [...totals.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n);
  const unknown = sorted.filter((x) => x.label.startsWith("ไม่ระบุ"));
  const known = sorted.filter((x) => !x.label.startsWith("ไม่ระบุ"));
  const head = known.slice(0, limit);
  const rest = known.slice(limit).reduce((s, x) => s + x.n, 0);
  return [...head, ...(rest ? [{ label: "อื่นๆ", n: rest }] : []), ...unknown];
}

export async function getDashboard() {
  const [[kpi], byYear, brandRows, typeRows, topSites, repeatSites, stale, claimsOpen, warranty, quality, claimRate] =
    await Promise.all([
      query(
        `SELECT (SELECT count(*) FROM sites)::int AS sites,
                (SELECT count(*) FROM jobs)::int AS jobs,
                (SELECT count(*) FROM devices)::int AS devices,
                (SELECT count(*) FROM claims)::int AS claims,
                (SELECT count(*) FROM claims WHERE returned_on IS NULL)::int AS open_claims,
                (SELECT count(*) FROM claims WHERE returned_on IS NULL AND current_date - sent_on > 30)::int AS late_claims`
      ),
      query(
        `SELECT extract(year FROM j.delivered_on)::int AS year, count(DISTINCT j.id)::int AS jobs, count(d.id)::int AS devices
           FROM jobs j LEFT JOIN devices d ON d.job_id = j.id
          WHERE j.delivered_on IS NOT NULL
          GROUP BY 1 ORDER BY 1`
      ),
      query(`SELECT brand, count(*)::int AS n FROM devices GROUP BY brand`),
      query(`SELECT device_type AS type, count(*)::int AS n FROM devices GROUP BY device_type`),
      query(
        `SELECT s.id, s.name, count(DISTINCT j.id)::int AS jobs, count(d.id)::int AS devices
           FROM sites s JOIN jobs j ON j.site_id = s.id LEFT JOIN devices d ON d.job_id = j.id
          GROUP BY s.id ORDER BY 4 DESC, s.name LIMIT 8`
      ),
      query(
        `SELECT s.id, s.name, count(DISTINCT j.id)::int AS jobs, count(d.id)::int AS devices,
                min(j.delivered_on) AS first_on, max(j.delivered_on) AS last_on
           FROM sites s JOIN jobs j ON j.site_id = s.id LEFT JOIN devices d ON d.job_id = j.id
          WHERE s.name NOT LIKE 'ไม่ระบุสถานที่%'
          GROUP BY s.id HAVING count(DISTINCT j.id) >= 2
          ORDER BY 3 DESC, 4 DESC LIMIT 10`
      ),
      // Sites whose latest dated job is over 2 years old: time for a check-up or upgrade offer
      query(
        `WITH last_job AS (
           SELECT s.id, s.name, max(j.delivered_on) AS last_on, count(DISTINCT j.id)::int AS jobs
             FROM sites s JOIN jobs j ON j.site_id = s.id
            WHERE s.name NOT LIKE 'ไม่ระบุสถานที่%'
            GROUP BY s.id HAVING max(j.delivered_on) IS NOT NULL
         )
         SELECT l.id, l.name, l.last_on, l.jobs, count(d.id)::int AS devices,
                (SELECT d2.brand FROM devices d2 JOIN jobs j2 ON j2.id = d2.job_id
                  WHERE j2.site_id = l.id AND d2.brand IS NOT NULL GROUP BY d2.brand ORDER BY count(*) DESC LIMIT 1) AS top_brand
           FROM last_job l
           JOIN jobs j ON j.site_id = l.id
           LEFT JOIN devices d ON d.job_id = j.id
          WHERE l.last_on < current_date - interval '2 years'
          GROUP BY l.id, l.name, l.last_on, l.jobs
          ORDER BY l.last_on, devices DESC
          LIMIT 12`
      ),
      query(
        `SELECT c.id, c.device_id, c.sent_on, (current_date - c.sent_on)::int AS days, c.vendor, c.symptom,
                d.serial, d.brand, d.model, d.place
           FROM claims c JOIN device_overview d ON d.id = c.device_id
          WHERE c.returned_on IS NULL ORDER BY c.sent_on LIMIT 8`
      ),
      query(
        `SELECT count(*) FILTER (WHERE warranty_until IS NOT NULL OR warranty_lifetime)::int AS with_date,
                count(*) FILTER (WHERE warranty_until < current_date)::int AS expired,
                count(*) FILTER (WHERE warranty_until >= current_date AND warranty_until <= current_date + 90)::int AS soon,
                count(*)::int AS total
           FROM devices`
      ),
      query(
        `SELECT round(100.0 * count(mac) / count(*))::int AS mac,
                round(100.0 * count(location) / count(*))::int AS location,
                round(100.0 * count(device_type) / count(*))::int AS device_type,
                round(100.0 * count(ip) / count(*))::int AS ip,
                round(100.0 * count(*) FILTER (WHERE warranty_until IS NOT NULL OR warranty_lifetime) / count(*))::int AS warranty
           FROM devices`
      ),
      query(
        `SELECT d.brand, count(DISTINCT d.id)::int AS devices, count(DISTINCT c.device_id)::int AS claimed, count(c.id)::int AS claims
           FROM devices d LEFT JOIN claims c ON c.device_id = d.id
          GROUP BY d.brand`
      ),
    ]);

  const expiring = await query(
    `SELECT id, serial, brand, model, warranty_until, (warranty_until - current_date)::int AS days, place
       FROM device_overview
      WHERE warranty_until >= current_date AND warranty_until <= current_date + 90
      ORDER BY warranty_until LIMIT 8`
  );

  // What the quotations on file add up to (before VAT): per job the largest single document
  const quotedJobs = await query(
    `SELECT j.id, s.name AS site, extract(year FROM j.delivered_on)::int AS year, x.total
       FROM jobs j JOIN sites s ON s.id = j.site_id
       JOIN (SELECT job_id, max(t) AS total
               FROM (SELECT q.job_id, sum(i.amount)::float8 AS t FROM quotes q JOIN quote_items i ON i.quote_id = q.id GROUP BY q.id) y
              GROUP BY job_id) x ON x.job_id = j.id
      WHERE x.total IS NOT NULL`
  );
  const quoted = { total: 0, jobs: quotedJobs.length, byYear: [], topSites: [] };
  const years = new Map();
  const sitesMap = new Map();
  for (const q of quotedJobs) {
    quoted.total += q.total;
    const y = years.get(q.year) ?? { year: q.year, total: 0, jobs: 0 };
    y.total += q.total;
    y.jobs += 1;
    years.set(q.year, y);
    const s = sitesMap.get(q.site) ?? { name: q.site, total: 0, jobs: 0 };
    s.total += q.total;
    s.jobs += 1;
    sitesMap.set(q.site, s);
  }
  quoted.byYear = [...years.values()].filter((y) => y.year).sort((a, b) => a.year - b.year);
  quoted.topSites = [...sitesMap.values()].sort((a, b) => b.total - a.total).slice(0, 8);

  // Failure rate per manufacturer group, from devices that were ever claimed
  const rate = new Map();
  for (const r of claimRate) {
    const g = brandGroup(r.brand);
    const cur = rate.get(g) ?? { label: g, devices: 0, claimed: 0, claims: 0 };
    cur.devices += r.devices;
    cur.claimed += r.claimed;
    cur.claims += r.claims;
    rate.set(g, cur);
  }

  return {
    kpi,
    byYear,
    brands: topGroups(brandRows, (r) => brandGroup(r.brand), 8),
    types: topGroups(typeRows, (r) => typeGroup(r.type), 8),
    topSites,
    repeatSites,
    stale,
    claimsOpen,
    warranty: warranty[0],
    expiring,
    quoted,
    quality: quality[0],
    claimRates: [...rate.values()].filter((r) => r.devices >= 10).sort((a, b) => b.claimed / b.devices - a.claimed / a.devices),
  };
}

// Everything the Excel report needs, flat: one row per device / claim / site
export async function getReportData() {
  const [sites, devices, claims] = await Promise.all([
    query(
      `SELECT s.name AS site, count(DISTINCT j.id)::int AS jobs, count(d.id)::int AS devices,
              min(j.delivered_on) AS first_on, max(j.delivered_on) AS last_on,
              count(*) FILTER (WHERE d.status = 'claim')::int AS open_claims
         FROM sites s LEFT JOIN jobs j ON j.site_id = s.id LEFT JOIN device_overview d ON d.job_id = j.id
        GROUP BY s.id ORDER BY max(j.delivered_on) DESC NULLS LAST, s.name`
    ),
    query(
      `SELECT site_name, job_name, job_delivered_on, device_type, brand, model, serial, mac, device_name, ip,
              location, warranty_until, warranty_lifetime, status
         FROM device_overview ORDER BY site_name NULLS LAST, job_name, id`
    ),
    query(
      `SELECT d.site_name, d.job_name, d.brand, d.model, d.serial, c.sent_on, c.returned_on, c.result, c.symptom, c.vendor, c.ticket_no
         FROM claims c JOIN device_overview d ON d.id = c.device_id ORDER BY c.sent_on DESC`
    ),
  ]);
  return { sites, devices, claims };
}
