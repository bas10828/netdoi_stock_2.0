import { notFound } from "next/navigation";
import UploadFileOutlined from "@mui/icons-material/UploadFileOutlined";
import { getSite } from "@/lib/queries";
import { formatDate, toId } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import { LinkButton } from "@/components/Links";
import EditDialog from "@/components/EditDialog";
import EmptyState from "@/components/EmptyState";
import JobsTable from "./JobsTable";

export async function generateMetadata({ params }) {
  const id = toId((await params).id);
  const site = id && (await getSite(id));
  return { title: site ? site.name : "ไม่พบสถานที่" };
}

export default async function SitePage({ params }) {
  const id = toId((await params).id);
  const site = id && (await getSite(id));
  if (!site) notFound();

  const devices = site.jobs.reduce((n, j) => n + j.device_count, 0);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "สถานที่", href: "/sites" }, { label: site.name }]}
        title={site.name}
        subtitle={`${site.jobs.length} งาน · ${devices.toLocaleString("th-TH")} อุปกรณ์${site.note ? ` · ${site.note}` : ""}`}
        actions={
          <>
            <EditDialog
              title="แก้ไขสถานที่"
              url={`/api/sites/${site.id}`}
              values={{ name: site.name, note: site.note ?? "" }}
              fields={[
                { name: "name", label: "ชื่อสถานที่", required: true },
                { name: "note", label: "หมายเหตุ", type: "multiline" },
              ]}
            />
            <LinkButton href={`/import?site=${site.id}`} variant="contained" startIcon={<UploadFileOutlined />}>
              Import งานใหม่
            </LinkButton>
          </>
        }
      />

      {site.jobs.length === 0 ? (
        <EmptyState title="ยังไม่มีงานที่สถานที่นี้" action={<LinkButton href={`/import?site=${site.id}`} variant="contained">Import งานแรก</LinkButton>} />
      ) : (
        <JobsTable
          jobs={site.jobs.map((j) => ({
            id: j.id,
            name: j.name,
            delivered_on: j.delivered_on,
            date_text: formatDate(j.delivered_on),
            po_number: j.po_number,
            note: j.note,
            device_count: j.device_count,
            open_claims: j.open_claims,
          }))}
        />
      )}
    </>
  );
}
