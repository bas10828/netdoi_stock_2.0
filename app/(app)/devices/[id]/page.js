import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import { getDevice } from "@/lib/queries";
import { CLAIM_RESULT, formatDate, toId } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import EditDialog from "@/components/EditDialog";
import MoveDialog from "./MoveDialog";
import { TextLink } from "@/components/Links";
import { fontMono } from "@/lib/fonts";

export async function generateMetadata({ params }) {
  const id = toId((await params).id);
  const device = id && (await getDevice(id));
  return { title: device ? device.serial || device.model || "อุปกรณ์" : "ไม่พบอุปกรณ์" };
}

// Install, move and claim events for the history timeline, oldest first
function buildTimeline(device) {
  // After a move the original install is the first move's source job
  const first = device.moves[0];
  const events = [
    first
      ? { key: "install", date: first.from_delivered_on, tone: "success", title: "ติดตั้ง", detail: first.from_label, sortFirst: true }
      : { key: "install", date: device.job_delivered_on, tone: "success", title: "ติดตั้ง", detail: `${device.site_name} · ${device.job_name}` },
  ];
  for (const m of device.moves) {
    const where = m.from_location !== m.to_location ? `ตำแหน่ง: ${m.from_location || "—"} → ${m.to_location || "—"}` : null;
    events.push({
      key: `move-${m.id}`, date: m.moved_on, tone: "primary", title: `ย้ายไป ${m.to_label}`,
      detail: [where, m.note, m.created_by && `โดย ${m.created_by}`].filter(Boolean).join("\n"),
      link: m.from_job_id && { href: `/jobs/${m.from_job_id}`, label: `จากงาน ${m.from_label}` },
    });
  }
  for (const c of device.claims) {
    if (c.replacement_device_id === device.id) {
      events.push({
        key: `in-${c.id}`, date: c.returned_on, tone: "success", title: "มาแทนตัวที่ส่งเคลม",
        detail: c.symptom, link: { href: `/devices/${c.device_id}`, label: `ตัวเก่า ${c.old_serial ?? ""}`, mono: true },
      });
      continue;
    }
    events.push({
      key: `sent-${c.id}`, date: c.sent_on, tone: "warning", title: "ส่งเคลม",
      detail: [c.symptom, c.vendor, c.ticket_no && `เลขเคลม ${c.ticket_no}`].filter(Boolean).join(" · "),
    });
    if (c.returned_on) {
      events.push({
        key: `ret-${c.id}`, date: c.returned_on, tone: c.result === "replaced" ? "neutral" : "success",
        title: `รับคืน: ${CLAIM_RESULT[c.result]}`, detail: c.note,
        link: c.replacement_device_id && { href: `/devices/${c.replacement_device_id}`, label: `ตัวใหม่ ${c.replacement_serial ?? ""}`, mono: true },
      });
    }
  }
  return events.sort((a, b) => (b.sortFirst ? 1 : 0) - (a.sortFirst ? 1 : 0) || String(a.date ?? "").localeCompare(String(b.date ?? "")));
}

export default async function DevicePage({ params }) {
  const id = toId((await params).id);
  const device = id && (await getDevice(id));
  if (!device) notFound();

  const title = [device.brand, device.model].filter(Boolean).join(" ") || device.device_type || "อุปกรณ์";
  const fields = [
    ["ประเภท", device.device_type],
    ["Serial", device.serial, true],
    ["MAC", device.mac, true],
    ["ชื่ออุปกรณ์", device.device_name],
    ["IP", device.ip, true],
    ["ตำแหน่ง", device.location],
    ["หมายเหตุ", device.note],
  ];
  const timeline = buildTimeline(device);

  return (
    <>
      <PageHeader
        crumbs={[
          { label: "สถานที่", href: "/sites" },
          { label: device.site_name, href: `/sites/${device.site_id}` },
          { label: device.job_name, href: `/jobs/${device.job_id}` },
          { label: device.serial || title },
        ]}
        eyebrow={<StatusBadge status={device.status} sx={{ alignSelf: "flex-start" }} />}
        title={title}
        subtitle={`${device.site_name} · ${device.job_name}`}
        actions={
          <>
          <MoveDialog deviceId={device.id} currentJobId={device.job_id} location={device.location ?? ""} />
          <EditDialog
            title="แก้ไขอุปกรณ์"
            url={`/api/devices/${device.id}`}
            values={Object.fromEntries(
              ["device_type", "brand", "model", "serial", "mac", "device_name", "ip", "location", "note"].map((k) => [k, device[k] ?? ""])
            )}
            fields={[
              { name: "brand", label: "Brand", half: true },
              { name: "model", label: "Model", half: true },
              { name: "serial", label: "Serial", type: "mono", half: true },
              { name: "mac", label: "MAC", type: "mono", half: true },
              { name: "device_type", label: "ประเภท", half: true },
              { name: "device_name", label: "ชื่ออุปกรณ์", half: true },
              { name: "ip", label: "IP", type: "mono", half: true },
              { name: "location", label: "ตำแหน่ง", half: true },
              { name: "note", label: "หมายเหตุ", type: "multiline" },
            ]}
          />
          </>
        }
      />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.2fr) minmax(0, 1fr)" }, gap: 2, alignItems: "start" }}>
        <Card sx={{ px: 2.25, py: 0.5 }}>
          {fields.map(([label, value, isMono]) => (
            <Box key={label} sx={{ display: "flex", gap: 2, py: 1.4, borderTop: 1, borderColor: "divider", "&:first-of-type": { borderTop: 0 } }}>
              <Typography sx={{ width: 110, flex: "none", color: "text.secondary" }}>{label}</Typography>
              <Typography sx={{ minWidth: 0, overflowWrap: "anywhere", whiteSpace: "pre-line", ...(isMono && value ? { fontFamily: fontMono, fontSize: 13.5 } : {}), color: value ? "text.primary" : "text.secondary" }}>
                {value || "—"}
              </Typography>
            </Box>
          ))}
        </Card>

        <Card sx={{ p: 2.25 }}>
          <Typography variant="h2" sx={{ mb: 2 }}>ประวัติ</Typography>
          <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0 }}>
            {timeline.map((e, i) => (
              <Box component="li" key={e.key} sx={{ display: "flex", gap: 1.5, position: "relative", pb: i < timeline.length - 1 ? 2.25 : 0 }}>
                {i < timeline.length - 1 && (
                  <Box sx={{ position: "absolute", left: 4.5, top: 18, bottom: 0, width: "1px", bgcolor: "divider" }} />
                )}
                <Box sx={{ width: 10, height: 10, mt: 0.75, borderRadius: "50%", flex: "none", bgcolor: `${e.tone}.main` }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 500 }}>{e.title}</Typography>
                  <Typography sx={{ fontSize: 13, color: "text.secondary" }}>{formatDate(e.date)}</Typography>
                  {e.detail && <Typography sx={{ fontSize: 13, mt: 0.25, whiteSpace: "pre-line" }}>{e.detail}</Typography>}
                  {e.link && (
                    <TextLink href={e.link.href} sx={{ fontSize: 13, ...(e.link.mono && { fontFamily: fontMono }) }}>
                      {e.link.label}
                    </TextLink>
                  )}
                </Box>
              </Box>
            ))}
          </Box>
          {device.claims.length === 0 && (
            <Typography sx={{ fontSize: 13, color: "text.secondary", mt: 2 }}>ยังไม่เคยส่งเคลม</Typography>
          )}
        </Card>
      </Box>
    </>
  );
}
