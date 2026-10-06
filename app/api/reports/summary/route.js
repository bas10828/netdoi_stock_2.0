import * as XLSX from "xlsx";
import { handler } from "@/lib/api";
import { getReportData } from "@/lib/stats";
import { STATUS, CLAIM_RESULT } from "@/lib/format";
import { brandGroup } from "@/lib/catalog";

// Excel workbook for analysis (pivot tables, charts): one flat sheet per subject
export const GET = handler(async () => {
  const { sites, devices, claims } = await getReportData();
  const today = new Date().toISOString().slice(0, 10);

  const sheet = (header, rows, widths) => {
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws["!cols"] = widths.map((wch) => ({ wch }));
    ws["!autofilter"] = { ref: ws["!ref"] };
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };
    return ws;
  };

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    book,
    sheet(
      ["สถานที่", "จำนวนงาน", "จำนวนอุปกรณ์", "งานแรก", "งานล่าสุด", "เคลมที่ยังไม่กลับ"],
      sites.map((s) => [s.site, s.jobs, s.devices, s.first_on, s.last_on, s.open_claims]),
      [44, 10, 14, 12, 12, 16]
    ),
    "สถานที่"
  );
  XLSX.utils.book_append_sheet(
    book,
    sheet(
      ["สถานที่", "งาน", "วันส่งงาน", "ปีส่งงาน (พ.ศ.)", "ประเภท", "ยี่ห้อ", "กลุ่มยี่ห้อ", "รุ่น", "Serial", "MAC", "ชื่ออุปกรณ์", "IP", "ตำแหน่ง", "ประกันถึง", "สถานะ"],
      devices.map((d) => [
        d.site_name ?? "ไม่สังกัดงาน", d.job_name, d.job_delivered_on, d.job_delivered_on ? Number(d.job_delivered_on.slice(0, 4)) + 543 : null,
        d.device_type, d.brand, brandGroup(d.brand), d.model, d.serial, d.mac, d.device_name, d.ip, d.location, d.warranty_lifetime ? "Lifetime" : d.warranty_until, STATUS[d.status]?.label,
      ]),
      [34, 34, 12, 14, 16, 14, 16, 22, 20, 18, 24, 14, 24, 12, 12]
    ),
    "อุปกรณ์"
  );
  XLSX.utils.book_append_sheet(
    book,
    sheet(
      ["สถานที่", "งาน", "ยี่ห้อ", "รุ่น", "Serial", "วันส่งเคลม", "วันรับคืน", "ผล", "อาการ", "ศูนย์ที่ส่ง", "เลขเคลม"],
      claims.map((c) => [c.site_name ?? "ไม่สังกัดงาน", c.job_name, c.brand, c.model, c.serial, c.sent_on, c.returned_on, CLAIM_RESULT[c.result], c.symptom, c.vendor, c.ticket_no]),
      [34, 34, 14, 22, 20, 12, 12, 12, 30, 24, 14]
    ),
    "เคลม"
  );

  return new Response(XLSX.write(book, { type: "buffer", bookType: "xlsx" }), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="netdoi-summary-${today}.xlsx"`,
    },
  });
});
