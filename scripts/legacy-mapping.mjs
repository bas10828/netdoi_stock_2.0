// Builds db/legacy/mapping.xlsx: one row per v1 project with a suggested
// site / job / delivered date, for the user to review before migrating.
// Usage: npm run db:legacy-mapping   (needs db/legacy/equipment.json from db:export-legacy)
import { readFile, writeFile } from "node:fs/promises";
import * as XLSX from "xlsx";

const NO_PROJECT_SITE = "ไม่ระบุสถานที่ (ข้อมูลเดิม)";
const THAI_MONTHS = { มกรา: 1, กุมภา: 2, มีนา: 3, เมษา: 4, พฤษภา: 5, มิถุนา: 6, กรกฎา: 7, สิงหา: 8, กันยา: 9, ตุลา: 10, พฤศจิกา: 11, ธันวา: 12 };

const pad = (n) => String(n).padStart(2, "0");
// Buddhist-era years (25xx) become Gregorian
const toIso = (y, m, d) => {
  const year = y > 2400 ? y - 543 : y;
  return m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${year}-${pad(m)}-${pad(d)}` : "";
};

// Splits "Maesai Hospital._2569-3-9" -> { site: "Maesai Hospital", job: "", date: "2026-03-09" }
function splitProject(project) {
  let rest = project.trim();
  let date = "";
  let m;
  if ((m = rest.match(/[_\s-]*(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    date = toIso(+m[1], +m[2], +m[3]);
    rest = rest.slice(0, m.index);
  } else if ((m = rest.match(/[_\s-]*(\d{1,2})-(\d{1,2})-(\d{4})$/))) {
    date = toIso(+m[3], +m[2], +m[1]);
    rest = rest.slice(0, m.index);
  } else if ((m = rest.match(/[_\s-]*(มกรา|กุมภา|มีนา|เมษา|พฤษภา|มิถุนา|กรกฎา|สิงหา|กันยา|ตุลา|พฤศจิกา|ธันวา)[^-]*-(\d{4})$/))) {
    date = toIso(+m[2], THAI_MONTHS[m[1]], 1);
    rest = rest.slice(0, m.index);
  }
  // Trailing work type, e.g. "..._CCTV" or "...cctv"
  let job = "";
  if ((m = rest.match(/[_\s]*(cctv)$/i))) {
    job = "CCTV";
    rest = rest.slice(0, m.index);
  }
  const site = rest.replace(/[._\s]+$/, "").trim();
  return { site, job, date };
}

const equipment = JSON.parse(await readFile(new URL("../db/legacy/equipment.json", import.meta.url), "utf8"));
const groups = new Map();
for (const r of equipment) {
  const key = (r.project ?? "").trim();
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(r);
}

const rows = [...groups.entries()]
  .map(([project, items]) => {
    const withSerial = items.filter((r) => (r.serial ?? "").trim()).length;
    const outDates = items.map((r) => r.out_stock).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d ?? "")).sort();
    const s = project ? splitProject(project) : { site: NO_PROJECT_SITE, job: "", date: "" };
    const isTest = /^test$/i.test(project);
    return {
      "project เดิม": project || "(ว่าง)",
      "ทั้งหมด": items.length,
      "มี serial": withSerial,
      "สถานที่": s.site,
      "ชื่องาน": s.job || "ข้อมูลจากระบบเดิม",
      "วันส่งงาน": s.date || outDates.at(-1) || "",
      "นำเข้า (Y/N)": isTest || withSerial === 0 ? "N" : "Y",
    };
  })
  .sort((a, b) => a["สถานที่"].localeCompare(b["สถานที่"], "th"));

const sheet = XLSX.utils.json_to_sheet(rows);
sheet["!cols"] = [48, 8, 9, 44, 22, 12, 12].map((wch) => ({ wch }));
sheet["!autofilter"] = { ref: sheet["!ref"] };
const book = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(book, sheet, "mapping");
// The ESM build of SheetJS has no file access, so write the buffer ourselves
await writeFile(new URL("../db/legacy/mapping.xlsx", import.meta.url), XLSX.write(book, { type: "buffer", bookType: "xlsx" }));
console.log(`Wrote ${rows.length} projects to db/legacy/mapping.xlsx`);
