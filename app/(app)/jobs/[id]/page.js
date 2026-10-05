import { notFound } from "next/navigation";
import Button from "@mui/material/Button";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import { getJob } from "@/lib/queries";
import { formatDate, toId } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import EditDialog from "@/components/EditDialog";
import DevicesTable from "./DevicesTable";

export async function generateMetadata({ params }) {
  const id = toId((await params).id);
  const job = id && (await getJob(id));
  return { title: job ? `${job.name} · ${job.site_name}` : "ไม่พบงาน" };
}

export default async function JobPage({ params }) {
  const id = toId((await params).id);
  const job = id && (await getJob(id));
  if (!job) notFound();

  const subtitle = [
    `ส่งงาน ${formatDate(job.delivered_on)}`,
    `${job.device_count} อุปกรณ์`,
    job.po_number && `PO ${job.po_number}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <PageHeader
        crumbs={[
          { label: "สถานที่", href: "/sites" },
          { label: job.site_name, href: `/sites/${job.site_id}` },
          { label: job.name },
        ]}
        title={job.name}
        subtitle={job.note ? `${subtitle} · ${job.note}` : subtitle}
        actions={
          <>
            <EditDialog
              title="แก้ไขงาน"
              url={`/api/jobs/${job.id}`}
              buttonLabel="แก้ไขงาน"
              values={{
                name: job.name,
                delivered_on: job.delivered_on ?? "",
                po_number: job.po_number ?? "",
                note: job.note ?? "",
              }}
              fields={[
                { name: "name", label: "ชื่องาน", required: true },
                { name: "delivered_on", label: "วันส่งงาน", type: "date", half: true },
                { name: "po_number", label: "เลข PO", half: true },
                { name: "note", label: "หมายเหตุ", type: "multiline" },
              ]}
            />
            <Button variant="outlined" href={`/api/jobs/${job.id}/export`} startIcon={<FileDownloadOutlined />}>
              Export Excel
            </Button>
          </>
        }
      />
      <DevicesTable devices={job.devices} />
    </>
  );
}
