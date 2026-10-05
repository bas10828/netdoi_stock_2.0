import * as XLSX from "xlsx";
import { handler } from "@/lib/api";
import { getClaims } from "@/lib/queries";
import { CLAIM_RESULT } from "@/lib/format";

// Claims as .xlsx, e.g. to attach when sending a batch to the service centre
export const GET = handler(async (request) => {
  const open = request.nextUrl.searchParams.get("tab") !== "closed";
  const claims = await getClaims(open);

  const header = ["NO.", "Brand", "Model", "Serial Number", "MAC Address", "สถานที่", "งาน", "ตำแหน่ง", "อาการ", "ศูนย์ที่ส่ง", "เลขเคลม", "วันส่ง", open ? "ค้าง (วัน)" : "วันรับคืน", open ? "" : "ผล", open ? "" : "Serial ตัวใหม่"];
  const rows = claims.map((c, i) => [
    i + 1, c.brand, c.model, c.serial, c.mac, c.site_name ?? "ไม่สังกัดงาน", c.job_name, c.location, c.symptom, c.vendor, c.ticket_no, c.sent_on,
    open ? c.days_out : c.returned_on,
    open ? "" : CLAIM_RESULT[c.result],
    open ? "" : c.replacement_serial,
  ]);
  const sheet = XLSX.utils.aoa_to_sheet([[open ? "รายการเคลมที่ยังไม่กลับ" : "รายการเคลมที่ปิดแล้ว"], header, ...rows]);
  sheet["!cols"] = [6, 12, 20, 20, 20, 28, 28, 24, 30, 24, 14, 12, 12, 14, 20].map((wch) => ({ wch }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Claims");

  const filename = `claims_${open ? "open" : "closed"}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new Response(XLSX.write(book, { type: "buffer", bookType: "xlsx" }), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
