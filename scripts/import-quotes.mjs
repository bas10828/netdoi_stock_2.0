// Loads the quotation files in device/waranty/ into quotes + quote_items (prices optional).
// Re-runnable: a file's lines are replaced per (job, file).
//
//   node --env-file=.env scripts/import-quotes.mjs --dry-run   # parse + check totals, write nothing
//   node --env-file=.env scripts/import-quotes.mjs             # apply in one transaction
import { readFile } from "node:fs/promises";
import pg from "pg";
import * as XLSX from "xlsx";
import { parseQuote } from "../lib/quoteParser.js";

const dryRun = process.argv.includes("--dry-run");
const DIR = "device/waranty/";

// Column layouts seen in the files (zero-based). desc lists the columns to read the description from.
const LAYOUT_A = { section: 0, desc: [2, 1], qty: 3, unit: 4, price: 5, amount: 6, note: 7 }; // Chalerm: label col + description col
const LAYOUT_B = { section: 0, desc: [1], qty: 2, unit: 3, price: 4, amount: 5, note: 6 }; // plain estimate
const LAYOUT_QT = { section: 0, desc: [1], qty: 2, unit: 3, price: 4, amount: 5 }; // real QT (# / รายละเอียด)

const FILES = [
  { file: "IP Camera ประมาณการราคา รร.เฉลิมพระเกียรติ พะเยา CCTV.xlsx", job: 110, kind: "ประมาณการ", cols: LAYOUT_A, expect: 386090 },
  { file: "ประมาณการ ร.ร.เฉลิมพระเกียรติสมเด็จพระศรี_1wifi.xlsx", job: 104, kind: "ประมาณการต้นทุน", cols: LAYOUT_A, expect: 251250 },
  { file: "ประมาณการ ร.ร.เม็งรายมหาราชวิทยาคม CCTV 1-10-68.xlsx", job: 112, kind: "ประมาณการ", cols: LAYOUT_B },
  { file: "ประมาณการ เทคนิคพะเยา.xlsx", job: 137, kind: "ประมาณการ", cols: LAYOUT_B, expect: 123200 },
  { file: "ประมาณการ แม่จันวิทยาคม cctv อาคารเกษตร.xlsx", job: 144, kind: "ประมาณการ", cols: LAYOUT_B },
  { file: "สรุปรายการใบเสนอราคา_รพทุ่งช้าง.xlsx", job: 151, kind: "ใบเสนอราคา", cols: LAYOUT_QT, expect: 14700 },
  { file: "สรุปรายการใบเสนอราคา_รพนาหมื่น.xlsx", job: 150, kind: "ใบเสนอราคา", cols: LAYOUT_QT, expect: 59430 },
];

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const money = (n) => (n === null ? "—" : n.toLocaleString("en-US"));

const parsed = [];
for (const f of FILES) {
  const wb = XLSX.read(await readFile(DIR + f.file));
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
  const q = parseQuote(rows, f.cols);
  const [job] = (await db.query("SELECT j.id, s.name AS site, j.name FROM jobs j JOIN sites s ON s.id = j.site_id WHERE j.id = $1", [f.job])).rows;
  const priced = q.items.filter((i) => i.unit_price !== null).length;
  console.log(`\n${job.site} | ${job.name.slice(0, 50)}\n  ${f.file}\n  ${q.items.length} บรรทัด (มีราคา ${priced}) · รวม ${money(q.items_total)} · ในใบเขียน ${money(q.stated_total)}${q.doc_no ? ` · ${q.doc_no}` : ""}`);
  if (q.stated_total !== null && Math.abs(q.stated_total - q.items_total) > 0.5) console.log("  !! ยอดรวมไม่ตรงกับที่ใบเขียน");
  if (f.expect && q.items_total !== f.expect) console.log(`  !! คาดไว้ ${money(f.expect)}`);
  for (const m of q.mismatched) console.log(`  !! จำนวน×ราคา ไม่ตรง: ${m.description.slice(0, 50)} (${m.qty} × ${m.unit_price} ≠ ${m.amount})`);
  parsed.push({ f, q });
}

if (dryRun) {
  console.log("\n(dry run: ไม่ได้เขียนอะไร)");
  await db.end();
  process.exit(0);
}

await db.query("SET search_path TO stock");
await db.query("BEGIN");
try {
  for (const { f, q } of parsed) {
    const { rows } = await db.query(
      `INSERT INTO quotes (job_id, doc_no, doc_date, kind, customer, source_file)
       VALUES ($1, $2::text, $3::date, $4::text, $5::text, $6::text)
       ON CONFLICT (job_id, source_file) DO UPDATE SET doc_no = EXCLUDED.doc_no, doc_date = EXCLUDED.doc_date, kind = EXCLUDED.kind, customer = EXCLUDED.customer
       RETURNING id`,
      [f.job, q.doc_no, q.doc_date, f.kind, q.customer, f.file]
    );
    const id = rows[0].id;
    await db.query("DELETE FROM quote_items WHERE quote_id = $1", [id]);
    for (const i of q.items) {
      await db.query(
        `INSERT INTO quote_items (quote_id, line_no, section, description, qty, unit, unit_price, amount, note)
         VALUES ($1, $2, $3::text, $4::text, $5::numeric, $6::text, $7::numeric, $8::numeric, $9::text)`,
        [id, i.line_no, i.section, i.description, i.qty, i.unit, i.unit_price, i.amount, i.note]
      );
    }
  }
  await db.query("COMMIT");
  console.log("\nบันทึกแล้ว");
} catch (err) {
  await db.query("ROLLBACK");
  throw err;
} finally {
  await db.end();
}
