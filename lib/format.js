// Thai date display, e.g. "5 ต.ค. 2569". Input is a "YYYY-MM-DD" string from the DB.
const thaiDate = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function formatDate(value) {
  if (!value) return "—";
  return thaiDate.format(new Date(`${value}T00:00:00Z`));
}

export const STATUS = {
  ok: { label: "ใช้งานอยู่", color: "success" },
  claim: { label: "กำลังเคลม", color: "warning" },
  replaced: { label: "ถูกแทนแล้ว", color: "neutral" },
};

export const CLAIM_RESULT = {
  repaired: "ซ่อมแล้ว",
  replaced: "ได้ตัวใหม่",
  rejected: "ไม่รับเคลม",
};

// Trimmed string, or null when empty
export function clean(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

// Serial/MAC search key: lower case, separators removed ("24:0F:9B" -> "240f9b")
export function searchKey(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Route param -> positive integer id, or null (so "abc" becomes a 404, not a DB error)
export function toId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n < 2 ** 31 ? n : null;
}

// Whole days from today until a "YYYY-MM-DD" date (negative = already passed); null if none
export function daysUntil(value) {
  if (!value) return null;
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.parse(`${value}T00:00:00Z`) - today) / 86400000);
}

// "5 ต.ค. 2569 · เหลือ 45 วัน" / "· หมดแล้ว 12 วัน"; "" when no date
export function warrantyText(value) {
  const d = daysUntil(value);
  if (d === null) return "";
  const when = formatDate(value);
  if (d < 0) return `${when} · หมดแล้ว ${-d} วัน`;
  if (d === 0) return `${when} · หมดวันนี้`;
  return `${when} · เหลือ ${d} วัน`;
}
