import * as XLSX from "xlsx";
import { error, handler } from "@/lib/api";
import { getJob } from "@/lib/queries";
import { STATUS, toId } from "@/lib/format";

// Download a job's devices as .xlsx, laid out like the Inventory report
export const GET = handler(async (request, { params }) => {
  const id = toId((await params).id);
  const job = id && (await getJob(id));
  if (!job) return error("ไม่พบงาน", 404);

  const header = ["NO.", "Device Type", "Brand", "Model", "Serial Number", "MAC Address", "Device Name", "IP Address", "Location", "Remark", "Warranty until", "Status"];
  // The job's own devices, then those it lists but that stayed in another job
  const rows = [...job.devices, ...job.refs].map((d, i) => [
    i + 1, d.device_type, d.brand, d.model, d.serial, d.mac, d.device_name, d.ip, d.location, d.note, d.warranty_lifetime ? "Lifetime" : d.warranty_until,
    d.job_id === job.id ? STATUS[d.status]?.label : `อุปกรณ์เดิม (${d.site_name} · ${d.job_name})`,
  ]);
  const sheet = XLSX.utils.aoa_to_sheet([
    ["INVENTORY"],
    [job.site_name],
    [`${job.name}${job.delivered_on ? ` · ส่งงาน ${job.delivered_on}` : ""}`],
    header,
    ...rows,
  ]);
  sheet["!cols"] = [6, 14, 14, 22, 20, 20, 18, 16, 28, 24, 14, 30].map((wch) => ({ wch }));

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Inventory");
  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });

  const filename = `${job.site_name}_${job.name}.xlsx`.replace(/[\\/:*?"<>|]/g, "_");
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="inventory.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
});
