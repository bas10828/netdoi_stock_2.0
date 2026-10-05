// Reads an Inventory report (.xlsx/.xls) into { siteName, rows }.
// Finds the header row by its column names instead of fixed positions, so
// files with extra title rows or reordered columns still work.
import * as XLSX from "xlsx";

export const FIELDS = ["device_type", "brand", "model", "serial", "mac", "device_name", "ip", "location", "note"];

// Tested in this order; the first match wins for each header cell
const HEADER_PATTERNS = [
  ["mac", /\bmac\b/],
  ["serial", /serial|^s\/?n\b|^sn$/],
  ["ip", /^ip\b|ip\s*address/],
  ["device_name", /device\s*name|host\s*name|^name$|ชื่ออุปกรณ์/],
  ["device_type", /device\s*type|^type$|ประเภท/],
  ["brand", /brand|ยี่ห้อ/],
  ["model", /model|รุ่น/],
  ["location", /location|ตำแหน่ง|จุดติดตั้ง/],
  ["note", /remark|note|หมายเหตุ/],
  ["no", /^no\.?$|^#$|ลำดับ/],
];

// Column layout of the old v1 template, used when no header row is found
const LEGACY_LAYOUT = { headerRow: 2, map: { no: 0, device_type: 1, brand: 2, model: 3, serial: 4, mac: 5, device_name: 6, ip: 7, location: 8, note: 9 } };

function text(v) {
  return v === undefined || v === null ? "" : String(v).trim();
}

// Excel shows long numbers like 2261589000459 as "2.26159E+12" in General format.
// Use the cell's real number in that case, otherwise the text Excel displays.
function cellText(shown, value) {
  if (typeof value === "number" && /e[+-]?\d/i.test(String(shown))) {
    return Number.isSafeInteger(value) ? String(value) : value.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 20 });
  }
  return text(shown);
}

// Serial that Excel already turned into scientific notation inside the file
export function looksLikeExponent(serial) {
  return /^\d(\.\d+)?e[+-]?\d+$/i.test(String(serial ?? "").trim());
}

function mapHeader(row) {
  const map = {};
  row.forEach((cell, i) => {
    const h = text(cell).toLowerCase();
    if (!h) return;
    for (const [field, re] of HEADER_PATTERNS) {
      if (map[field] === undefined && re.test(h)) {
        map[field] = i;
        break;
      }
    }
  });
  return map;
}

export async function parseInventory(file) {
  const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = book.Sheets[book.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
  const values = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });

  let headerRow = -1;
  let map = null;
  for (let r = 0; r < Math.min(raw.length, 30); r++) {
    const m = mapHeader(raw[r]);
    if (m.serial !== undefined && (m.model !== undefined || m.mac !== undefined)) {
      headerRow = r;
      map = m;
      break;
    }
  }
  if (!map) ({ headerRow, map } = LEGACY_LAYOUT);

  // Site name: first text above the header that isn't the "INVENTORY" title
  let siteName = "";
  for (let r = 0; r < headerRow && !siteName; r++) {
    const cell = raw[r].map(text).find((c) => c && !/^inventory$/i.test(c));
    if (cell) siteName = cell;
  }

  const rows = [];
  for (let r = headerRow + 1; r < raw.length; r++) {
    const line = raw[r];
    const row = {};
    for (const f of FIELDS) row[f] = map[f] === undefined ? "" : cellText(line[map[f]], values[r]?.[map[f]]);
    if (FIELDS.every((f) => !row[f])) continue; // blank line
    rows.push({ ...row, no: map.no === undefined ? "" : text(line[map.no]) });
  }
  return { siteName, rows };
}
