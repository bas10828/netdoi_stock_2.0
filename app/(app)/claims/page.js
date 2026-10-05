import Button from "@mui/material/Button";
import AddOutlined from "@mui/icons-material/AddOutlined";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import { getClaims, getOpenClaimCount } from "@/lib/queries";
import PageHeader from "@/components/PageHeader";
import { LinkButton } from "@/components/Links";
import ClaimsList from "./ClaimsList";

export const metadata = { title: "เคลม" };

export default async function ClaimsPage({ searchParams }) {
  const tab = (await searchParams).tab === "closed" ? "closed" : "open";
  const [claims, openCount] = await Promise.all([getClaims(tab === "open"), getOpenClaimCount()]);

  return (
    <>
      <PageHeader
        title="เคลม"
        subtitle={openCount > 0 ? `ยังไม่กลับ ${openCount} รายการ · ค้างเกิน 30 วันขึ้นสีแดง` : "ไม่มีเคลมค้าง"}
        actions={
          <>
            <Button variant="outlined" href={`/api/claims/export?tab=${tab}`} startIcon={<FileDownloadOutlined />}>
              Export Excel
            </Button>
            <LinkButton href="/claims/new" variant="contained" startIcon={<AddOutlined />}>
              ส่งเคลม
            </LinkButton>
          </>
        }
      />
      <ClaimsList
        tab={tab}
        openCount={openCount}
        claims={claims.map((c) => ({ ...c, created_at: undefined }))}
      />
    </>
  );
}
