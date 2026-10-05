import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import UploadFileOutlined from "@mui/icons-material/UploadFileOutlined";
import { getRecentJobs, getStats } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { LinkButton, TextLink } from "@/components/Links";
import { Pill } from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import SearchHome from "./SearchHome";

export const metadata = { title: "ค้นหา" };

export default async function HomePage({ searchParams }) {
  const q = String((await searchParams).q ?? "");
  const [stats, recentJobs] = await Promise.all([getStats(), getRecentJobs(6)]);

  if (stats.devices === 0) {
    return (
      <Box sx={{ maxWidth: 640, mx: "auto", pt: 6 }}>
        <EmptyState
          icon={<UploadFileOutlined />}
          title="ยังไม่มีข้อมูลอุปกรณ์"
          description="เริ่มจาก Import ไฟล์รายงาน Inventory ของงานที่ส่งแล้ว ระบบจะสร้างสถานที่และงานให้"
          action={<LinkButton href="/import" variant="contained">Import รายงานแรก</LinkButton>}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <SearchHome stats={stats} initialQuery={q} key={q} />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
        <Card sx={{ p: 2.25 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="h2">งานล่าสุด</Typography>
            <TextLink href="/sites" sx={{ fontSize: 13 }}>ดูสถานที่ทั้งหมด</TextLink>
          </Box>
          {recentJobs.map((j) => (
            <Box
              key={j.id}
              sx={{ display: "flex", alignItems: "center", gap: 2, py: 1.25, borderTop: 1, borderColor: "divider", "&:first-of-type": { borderTop: 0 } }}
            >
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <TextLink href={`/jobs/${j.id}`} color="text.primary">{j.name}</TextLink>
                <Typography noWrap sx={{ fontSize: 13, color: "text.secondary" }}>
                  {j.site_name} · {j.device_count} อุปกรณ์
                </Typography>
              </Box>
              {j.open_claims > 0 && <Pill color="warning">เคลม {j.open_claims}</Pill>}
              <Typography sx={{ fontSize: 13, color: "text.secondary", whiteSpace: "nowrap" }}>{formatDate(j.delivered_on)}</Typography>
            </Box>
          ))}
        </Card>

        <Card sx={{ p: 2.25, display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Typography variant="h2">ภาพรวม</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.5 }}>
            {[
              ["สถานที่", stats.sites],
              ["งาน", stats.jobs],
              ["อุปกรณ์", stats.devices],
              ["กำลังเคลม", stats.open_claims],
            ].map(([label, value]) => (
              <Box key={label} sx={{ p: 1.75, borderRadius: 2, bgcolor: "action.hover" }}>
                <Typography sx={{ fontSize: 13, color: "text.secondary" }}>{label}</Typography>
                <Typography sx={{ fontSize: 24, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {value.toLocaleString("th-TH")}
                </Typography>
              </Box>
            ))}
          </Box>
          <LinkButton href="/import" variant="outlined" startIcon={<UploadFileOutlined />} sx={{ alignSelf: "flex-start", mt: "auto" }}>
            Import งานใหม่
          </LinkButton>
        </Card>
      </Box>
    </Box>
  );
}
