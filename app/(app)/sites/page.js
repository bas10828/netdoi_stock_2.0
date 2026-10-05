import PlaceOutlined from "@mui/icons-material/PlaceOutlined";
import UploadFileOutlined from "@mui/icons-material/UploadFileOutlined";
import { getSites } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { LinkButton } from "@/components/Links";
import SitesGrid from "./SitesGrid";

export const metadata = { title: "สถานที่" };

export default async function SitesPage() {
  const sites = await getSites();
  const jobs = sites.reduce((n, s) => n + s.job_count, 0);
  const devices = sites.reduce((n, s) => n + s.device_count, 0);

  return (
    <>
      <PageHeader
        title="สถานที่"
        subtitle={`${sites.length} สถานที่ · ${jobs} งาน · ${devices.toLocaleString("th-TH")} อุปกรณ์`}
        actions={
          <LinkButton href="/import" variant="contained" startIcon={<UploadFileOutlined />}>
            Import งานใหม่
          </LinkButton>
        }
      />
      {sites.length === 0 ? (
        <EmptyState
          icon={<PlaceOutlined />}
          title="ยังไม่มีสถานที่"
          description="สถานที่จะถูกสร้างตอน Import รายงาน Inventory"
          action={<LinkButton href="/import" variant="contained">Import รายงานแรก</LinkButton>}
        />
      ) : (
        <SitesGrid sites={sites.map((s) => ({ ...s, last_text: formatDate(s.last_delivered_on) }))} />
      )}
    </>
  );
}
