import * as XLSX from "xlsx";
import { HttpError, handler, json } from "@/lib/api";
import { query, transaction } from "@/lib/db";
import { clean, toId } from "@/lib/format";
import { lineMatchesModel, parseQuote } from "@/lib/quoteParser";
import { applyWarranty, checkWarrantyGroups } from "@/lib/warranty";

const MAX_BYTES = 5 * 1024 * 1024;

// Attach a quotation file (.xlsx) to a job: read prices and warranty from it.
//   multipart: file, mode = "preview" | "save"
//   preview -> the lines found, and for each brand+model group of the job's devices the quote line that names it
//   save    -> also start, only_empty, save_quote ("true"/"false") and groups (JSON, same shape as /warranty)
export const POST = handler(async (request, { params }) => {
  const jobId = toId((await params).id);
  if (!jobId) throw new HttpError("ไม่พบงาน", 404);
  const [job] = await query("SELECT id FROM jobs WHERE id = $1", [jobId]);
  if (!job) throw new HttpError("ไม่พบงาน", 404);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") throw new HttpError("เลือกไฟล์ใบเสนอราคา");
  if (!/\.(xlsx|xls)$/i.test(file.name)) throw new HttpError("รองรับเฉพาะไฟล์ Excel (.xlsx, .xls)");
  if (file.size > MAX_BYTES) throw new HttpError("ไฟล์ใหญ่เกิน 5 MB");

  const { quote, sheetName } = readQuote(Buffer.from(await file.arrayBuffer()));
  const kind = /ต้นทุน/.test(sheetName) ? "ประมาณการต้นทุน" : quote.doc_no ? "ใบเสนอราคา" : "ประมาณการ";

  if (form.get("mode") === "save") {
    const saveQuote = form.get("save_quote") === "true";
    const groups = JSON.parse(String(form.get("groups") || "[]"));
    const start = clean(form.get("start"));
    if (!saveQuote && groups.length === 0) throw new HttpError("ไม่มีอะไรให้บันทึก");
    if (groups.length > 0) checkWarrantyGroups(groups, start);

    const updated = await transaction(async (db) => {
      if (saveQuote) {
        const { rows } = await db.query(
          `INSERT INTO quotes (job_id, doc_no, doc_date, kind, customer, source_file)
           VALUES ($1, $2::text, $3::date, $4::text, $5::text, $6::text)
           ON CONFLICT (job_id, source_file) DO UPDATE
             SET doc_no = EXCLUDED.doc_no, doc_date = EXCLUDED.doc_date, kind = EXCLUDED.kind, customer = EXCLUDED.customer
           RETURNING id`,
          [jobId, quote.doc_no, quote.doc_date, kind, quote.customer, file.name]
        );
        const id = rows[0].id;
        await db.query("DELETE FROM quote_items WHERE quote_id = $1", [id]);
        for (const i of quote.items) {
          await db.query(
            `INSERT INTO quote_items (quote_id, line_no, section, description, qty, unit, unit_price, amount, note)
             VALUES ($1, $2, $3::text, $4::text, $5::numeric, $6::text, $7::numeric, $8::numeric, $9::text)`,
            [id, i.line_no, i.section, i.description, i.qty, i.unit, i.unit_price, i.amount, i.note]
          );
        }
      }
      return groups.length > 0 ? applyWarranty(db, jobId, groups, start, form.get("only_empty") !== "false") : 0;
    });
    return json({ quote: saveQuote, updated });
  }

  // preview: which quote line belongs to which model group of this job
  const devices = await query(
    `SELECT id, brand, model, (warranty_until IS NOT NULL OR warranty_lifetime) AS has FROM devices WHERE job_id = $1 ORDER BY id`,
    [jobId]
  );
  const map = new Map();
  for (const d of devices) {
    const key = `${d.brand ?? ""}\u0000${d.model ?? ""}`;
    const g = map.get(key) ?? { key, label: [d.brand, d.model].filter(Boolean).join(" ") || "ไม่ระบุรุ่น", model: d.model, ids: [], have: 0 };
    g.ids.push(d.id);
    if (d.has) g.have += 1;
    map.set(key, g);
  }
  const groups = [...map.values()]
    .map(({ model, ...g }) => {
      let best = null;
      for (const i of quote.items) {
        const score = model ? lineMatchesModel(i.description, model) : 0;
        // the longest model name wins; between equals, a line that states a warranty
        if (score > 0 && (!best || score > best.score || (score === best.score && i.warranty && !best.item.warranty))) best = { score, item: i };
      }
      return { ...g, match: best && { line_no: best.item.line_no, description: best.item.description, warranty: best.item.warranty } };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  return json({
    file: file.name,
    kind,
    doc_no: quote.doc_no,
    doc_date: quote.doc_date,
    customer: quote.customer,
    stated_total: quote.stated_total,
    items_total: quote.items_total,
    mismatched: quote.mismatched.length,
    items: quote.items,
    groups,
  });
});

// First sheet that has a quantity header and at least one line
function readQuote(buffer) {
  let book;
  try {
    book = XLSX.read(buffer);
  } catch {
    throw new HttpError("อ่านไฟล์ Excel ไม่ได้");
  }
  for (const sheetName of book.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(book.Sheets[sheetName], { header: 1, defval: "" });
    try {
      const quote = parseQuote(rows);
      if (quote.items.length > 0) return { quote, sheetName };
    } catch {
      // try the next sheet
    }
  }
  throw new HttpError("ไม่พบตารางรายการ (ต้องมีหัวคอลัมน์ “จำนวน”)");
}
