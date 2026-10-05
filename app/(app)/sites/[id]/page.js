import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableContainer from "@mui/material/TableContainer";
import Typography from "@mui/material/Typography";
import UploadFileOutlined from "@mui/icons-material/UploadFileOutlined";
import { getSite } from "@/lib/queries";
import { formatDate, toId } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import { LinkButton, TextLink } from "@/components/Links";
import { Pill } from "@/components/StatusBadge";
import EditDialog from "@/components/EditDialog";
import EmptyState from "@/components/EmptyState";

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
        <>
        {/* Phones: one card per job */}
        <Box sx={{ display: { xs: "flex", sm: "none" }, flexDirection: "column", gap: 1 }}>
          {site.jobs.map((j) => (
            <Card key={j.id} sx={{ p: 1.75, display: "flex", flexDirection: "column", gap: 0.5 }}>
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                <TextLink href={`/jobs/${j.id}`} sx={{ flex: 1, minWidth: 0 }}>{j.name}</TextLink>
                {j.open_claims > 0 ? <Pill color="warning">เคลม {j.open_claims}</Pill> : <Pill color="success">ปกติ</Pill>}
              </Box>
              <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
                ส่งงาน {formatDate(j.delivered_on)} · {j.device_count} อุปกรณ์{j.po_number ? ` · PO ${j.po_number}` : ""}
              </Typography>
            </Card>
          ))}
        </Box>
        <Card sx={{ display: { xs: "none", sm: "block" } }}>
          <TableContainer>
            <Table sx={{ minWidth: 560 }}>
              <TableHead>
                <TableRow>
                  <TableCell>งาน</TableCell>
                  <TableCell>วันส่งงาน</TableCell>
                  <TableCell align="right">อุปกรณ์</TableCell>
                  <TableCell>สถานะ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {site.jobs.map((j) => (
                  <TableRow key={j.id} hover>
                    <TableCell>
                      <TextLink href={`/jobs/${j.id}`}>{j.name}</TextLink>
                      {j.po_number && (
                        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>PO {j.po_number}</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>{formatDate(j.delivered_on)}</TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>{j.device_count}</TableCell>
                    <TableCell>
                      {j.open_claims > 0 ? <Pill color="warning">กำลังเคลม {j.open_claims}</Pill> : <Pill color="success">ปกติ</Pill>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
        </>
      )}
    </>
  );
}
