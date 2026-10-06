// Reads a quotation / estimate sheet (rows as arrays, e.g. from SheetJS sheet_to_json with header: 1)
// into lines. Prices are optional: a line with a quantity but no price keeps unit_price/amount null.
//
// cols: zero-based column numbers: { section, desc: [preferred, fallback...], qty, unit, price, amount, note }.
// Layouts differ per file (some have a short label column next to the description), so the caller says which.

const cell = (r, c) => (c >= 0 ? r[c] : undefined);
// A number, or text that is only a number (some sheets store quantities as text: "1", "1,500")
const num = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && /^\s*-?[\d,]+(\.\d+)?\s*$/.test(v)) return Number(v.replace(/,/g, ""));
  return null;
};
const text = (v) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : v === undefined || v === null ? "" : String(v).trim());

// "04/09/2026" -> "2026-09-04"; anything else -> null
function isoDate(value) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text(value));
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

// Finds the columns from the header row (the row that says จำนวน). The description may sit in an unlabeled
// merged column, so every column between the item number and the quantity counts as a description column.
export function detectCols(rows) {
  const header = rows.findIndex((r) => r.some((c) => /จำนวน/.test(text(c))));
  if (header < 0) return null;
  const labels = rows[header].map(text);
  const at = (re) => labels.findIndex((l) => re.test(l));
  const qty = at(/จำนวน/);
  const desc = [];
  for (let c = 1; c < qty; c++) desc.push(c);
  const note = at(/หมายเหตุ/);
  return {
    section: 0,
    desc: desc.length ? desc : [1],
    qty,
    unit: labels.findIndex((l) => l === "หน่วย"),
    price: at(/ราคาต่อหน่วย/),
    amount: at(/ราคารวม|ยอดรวม/),
    note: note >= 0 ? note : undefined,
  };
}

// Warranty written at the end of an item name: "(3Years. Waranty)", "(2 Year Warranty)", "(Limited Lifetime. Waranty)"
export function warrantyOf(description) {
  const d = text(description);
  if (/lifetime/i.test(d)) return { lifetime: true };
  const m = /(\d+)\s*Years?[.\s]*War/i.exec(d);
  return m ? { years: Number(m[1]) } : null;
}

// Does this quote line name the device model? "CL-800ICT" matches "CL800-ICT"; "U6-Mesh" does not match "U6-Mesh-Pro".
export function lineMatchesModel(description, model) {
  const d = text(description);
  const variants = [text(model), text(model).replace(/^(RG|TL|DHU|DH)-/i, "")].filter((v) => v.length >= 3);
  for (const v of variants) {
    // Any separator (or none) may sit between two characters of the model
    const body = [...v]
      .filter((ch) => !/[\s\-_.]/.test(ch))
      .map((ch) => ch.replace(/[+*?^${}()|[\]\\]/g, "\\$&"))
      .join("[\\s\\-_.]*");
    if (new RegExp("(?<![a-z0-9])" + body + "(?![a-z0-9]|-[a-z0-9])", "i").test(d)) return v.length;
  }
  return 0;
}

export function parseQuote(rows, cols = detectCols(rows)) {
  const header = rows.findIndex((r) => r.some((c) => /จำนวน/.test(text(c))));
  if (!cols || header < 0) throw new Error("ไม่พบแถวหัวตาราง (จำนวน)");

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
      if (num(r[cols.section]) !== null && description) section = description;
      continue;
    }
    if (!description) continue;
    const price = num(cell(r, cols.price));
    const amount = num(cell(r, cols.amount)) ?? (price !== null ? price * qty : null);
    items.push({
      line_no: items.length + 1,
      section,
      description,
      qty,
      unit: text(cell(r, cols.unit)) || null,
      unit_price: price,
      amount,
      note: cols.note === undefined ? null : text(r[cols.note]) || null,
      warranty: warrantyOf(description),
    });
  }
  const total = items.reduce((s, i) => s + (i.amount ?? 0), 0);
  const mismatched = items.filter((i) => i.unit_price !== null && i.amount !== null && Math.abs(i.unit_price * i.qty - i.amount) > 0.5);
  return { ...meta, items, stated_total: stated, items_total: total, mismatched };
}
