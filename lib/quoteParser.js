// Reads a quotation / estimate sheet (rows as arrays, e.g. from SheetJS sheet_to_json with header: 1)
// into lines. Prices are optional: a line with a quantity but no price keeps unit_price/amount null.
//
// cols: zero-based column numbers: { section, desc: [preferred, fallback...], qty, unit, price, amount, note }.
// Layouts differ per file (some have a short label column next to the description), so the caller says which.

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const text = (v) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : v === undefined || v === null ? "" : String(v).trim());

// "04/09/2026" -> "2026-09-04"; anything else -> null
function isoDate(value) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text(value));
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

export function parseQuote(rows, cols) {
  const header = rows.findIndex((r) => r.some((c) => /จำนวน/.test(text(c))));
  if (header < 0) throw new Error("ไม่พบแถวหัวตาราง (จำนวน)");

  // Document header above the table (only real quotations have it)
  const meta = { doc_no: null, doc_date: null, customer: null };
  for (const r of rows.slice(0, header)) {
    const key = text(r[0]);
    if (key === "เลขที่") meta.doc_no = text(r[1]) || null;
    else if (key === "วันที่") meta.doc_date = isoDate(r[1]);
    else if (key === "ลูกค้า") meta.customer = text(r[1]) || null;
  }

  const items = [];
  let section = null;
  let stated = null;
  for (const r of rows.slice(header + 1)) {
    const cells = r.map(text).filter(Boolean);
    if (cells.length === 0) continue;
    if (/^(รวมค่าใช้จ่ายทั้งโครงการ|รวมเป็นเงิน)/.test(cells[0])) {
      stated = r.map(num).find((n) => n !== null) ?? null;
      break;
    }
    const qty = num(r[cols.qty]);
    const description = cols.desc.map((c) => text(r[c])).filter(Boolean).sort((a, b) => b.length - a.length)[0] ?? "";
    // A numbered row with no quantity names a building / room: it groups the lines below it
    if (!(qty > 0)) {
      if (typeof r[cols.section] === "number" && description) section = description;
      continue;
    }
    if (!description) continue;
    const price = num(r[cols.price]);
    const amount = num(r[cols.amount]) ?? (price !== null ? price * qty : null);
    items.push({
      line_no: items.length + 1,
      section,
      description,
      qty,
      unit: text(r[cols.unit]) || null,
      unit_price: price,
      amount,
      note: cols.note === undefined ? null : text(r[cols.note]) || null,
    });
  }
  const total = items.reduce((s, i) => s + (i.amount ?? 0), 0);
  const mismatched = items.filter((i) => i.unit_price !== null && i.amount !== null && Math.abs(i.unit_price * i.qty - i.amount) > 0.5);
  return { ...meta, items, stated_total: stated, items_total: total, mismatched };
}
