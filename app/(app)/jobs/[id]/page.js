import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import { getJob, getMovedOut } from "@/lib/queries";
import { formatDate, toId } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import EditDialog from "@/components/EditDialog";
import { TextLink } from "@/components/Links";
import { fontMono } from "@/lib/fonts";
import DevicesTable from "./DevicesTable";
import WarrantyDialog from "./WarrantyDialog";

export async function generateMetadata({ params }) {
  const id = toId((await params).id);
  const job = id && (await getJob(id));
  return { title: job ? `${job.name} · ${job.site_name}` : "ไม่พบงาน" };
}

export default async function JobPage({ params }) {
  const id = toId((await params).id);
  const job = id && (await getJob(id));
  if (!job) notFound();
  const movedOut = await getMovedOut(job.id);

  const subtitle = [
    `ส่งงาน ${formatDate(job.delivered_on)}`,
    `${job.device_count} อุปกรณ์`,
    job.refs.length > 0 && `+ อุปกรณ์เดิม ${job.refs.length}`,
    movedOut.length > 0 && `ย้ายออก ${movedOut.length}`,
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
                { name: "name", label: "ชื่องาน", type: "long", required: true },
                { name: "delivered_on", label: "วันส่งงาน", type: "date", half: true },
                { name: "po_number", label: "เลข PO", half: true },
                { name: "note", label: "หมายเหตุ", type: "multiline" },
              ]}
            />
            <WarrantyDialog jobId={job.id} deliveredOn={job.delivered_on} deviceCount={job.device_count} />
            <Button variant="outlined" href={`/api/jobs/${job.id}/export`} startIcon={<FileDownloadOutlined />}>
              Export Excel
            </Button>
          </>
        }
      />
      <DevicesTable devices={job.devices} refs={job.refs} jobId={job.id} />

      {movedOut.length > 0 && (
        <Box component="section" sx={{ mt: 4 }}>
          <Typography variant="h2">ย้ายออกไปแล้ว ({movedOut.length})</Typography>
          <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 1.5 }}>
            เคยอยู่ในงานนี้ แล้วถูกย้ายไปติดตั้งที่อื่น · กดเพื่อดูที่อยู่ปัจจุบัน
          </Typography>
          <Card>
            {movedOut.map((m) => (
              <Box
                key={m.device_id}
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1.6fr) auto" },
                  gap: { xs: 0.25, md: 2 },
                  alignItems: "baseline",
                  px: 2,
                  py: 1.25,
                  borderTop: 1,
                  borderColor: "divider",
                  "&:first-of-type": { borderTop: 0 },
                }}
              >
                <Typography sx={{ fontWeight: 500 }}>{[m.brand, m.model].filter(Boolean).join(" ") || "—"}</Typography>
                <TextLink href={`/devices/${m.device_id}`} sx={{ fontFamily: fontMono, fontSize: 13 }}>
                  {m.serial || "ไม่มี serial"}
                </TextLink>
                <Typography sx={{ fontSize: 13 }}>
                  {m.from_location || "—"} →{" "}
                  {m.now_job_id ? (
                    <TextLink href={`/jobs/${m.now_job_id}`}>{m.now_site_name} · {m.now_job_name}</TextLink>
                  ) : (
                    "—"
                  )}
                  {m.now_location ? ` (${m.now_location})` : ""}
                </Typography>
                <Typography sx={{ fontSize: 13, color: "text.secondary", whiteSpace: "nowrap" }}>{formatDate(m.moved_on)}</Typography>
              </Box>
            ))}
          </Card>
        </Box>
      )}
    </>
  );
}
