import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import { getDashboard } from "@/lib/stats";
import { brandGroup } from "@/lib/catalog";
import { formatDate } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import { TextLink } from "@/components/Links";
import { Pill } from "@/components/StatusBadge";
import { BarList, ColumnChart, Meter } from "@/components/Charts";

export const metadata = { title: "ภาพรวม" };

const fmt = (n) => Number(n).toLocaleString("th-TH");

function Panel({ title, subtitle, children, span }) {
  return (
    <Card sx={{ p: 2.25, display: "flex", flexDirection: "column", gap: 1.75, gridColumn: span ? { md: `span ${span}` } : undefined, minWidth: 0 }}>
      <Box>
        <Typography variant="h2">{title}</Typography>
        {subtitle && <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>{subtitle}</Typography>}
      </Box>
      {children}
    </Card>
  );
}

function Tile({ label, value, children }) {
  return (
    <Card sx={{ p: 2.25 }}>
      <Typography sx={{ fontSize: 13, color: "text.secondary" }}>{label}</Typography>
      <Typography sx={{ fontSize: 30, fontWeight: 600, lineHeight: 1.25, fontVariantNumeric: "tabular-nums" }}>{fmt(value)}</Typography>
      {children}
    </Card>
  );
}

// A plain list row: title + detail on the left, a value on the right
function Row({ href, title, detail, right }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1, borderTop: 1, borderColor: "divider", "&:first-of-type": { borderTop: 0, pt: 0 } }}>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        {href ? (
          <TextLink href={href} color="text.primary" sx={{ fontSize: 14 }}>
            {title}
          </TextLink>
        ) : (
          <Typography sx={{ fontSize: 14 }}>{title}</Typography>
        )}
        {detail && <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>{detail}</Typography>}
      </Box>
      {right}
    </Box>
  );
}

function Empty({ children }) {
  return <Typography sx={{ fontSize: 13, color: "text.secondary", py: 1 }}>{children}</Typography>;
}

export default async function DashboardPage() {
  const d = await getDashboard();
  const { kpi } = d;
  const datedJobs = d.byYear.reduce((n, y) => n + y.jobs, 0);
  const undated = kpi.jobs - datedJobs;
  const noWarranty = d.warranty.with_date === 0;

  return (
    <>
      <PageHeader
        title="ภาพรวม"
        subtitle="สรุปจากข้อมูลที่บันทึกไว้ในระบบ"
        actions={
          <Button variant="outlined" href="/api/reports/summary" startIcon={<FileDownloadOutlined />}>
            ดาวน์โหลดรายงาน Excel
          </Button>
        }
      />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: 2, mb: 2 }}>
        <Tile label="สถานที่" value={kpi.sites} />
        <Tile label="งาน" value={kpi.jobs} />
        <Tile label="อุปกรณ์" value={kpi.devices} />
        <Tile label="เคลมที่ยังไม่กลับ" value={kpi.open_claims}>
          {kpi.late_claims > 0 && <Pill color="error">ค้างเกิน 30 วัน {kpi.late_claims}</Pill>}
        </Tile>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
        <Panel title="ติดตั้งรายปี" subtitle={`จำนวนอุปกรณ์ที่ส่งมอบในแต่ละปี${undated > 0 ? ` · ไม่นับ ${undated} งานที่ไม่มีวันส่งงาน` : ""}`}>
          <ColumnChart
            unit="ตัว"
            items={d.byYear.map((y) => ({ label: `${y.year + 543}`, value: y.devices, sub: `${y.jobs} งาน` }))}
          />
        </Panel>

        <Panel title="ส่วนแบ่งยี่ห้อ" subtitle="จำนวนอุปกรณ์ที่ติดตั้ง รวมยี่ห้อย่อยของผู้ผลิตเดียวกัน (Reyee+Ruijie, UniFi+Ubiquiti)">
          <BarList
            unit="ตัว"
            items={d.brands.map((b) => ({
              label: b.label,
              value: b.n,
              text: `${fmt(b.n)} · ${Math.round((100 * b.n) / kpi.devices)}%`,
              muted: b.label.startsWith("ไม่ระบุ") || b.label === "อื่นๆ",
            }))}
          />
        </Panel>

        <Panel title="ประเภทอุปกรณ์" subtitle="ประเภทที่ยังไม่ได้ระบุมีจำนวนมาก จึงดูเป็นแนวโน้มเท่านั้น">
          <BarList
            unit="ตัว"
            items={d.types.map((t) => ({
              label: t.label,
              value: t.n,
              text: `${fmt(t.n)} · ${Math.round((100 * t.n) / kpi.devices)}%`,
              muted: t.label.startsWith("ไม่ระบุ") || t.label === "อื่นๆ",
            }))}
          />
        </Panel>

        <Panel title="สถานที่ที่มีอุปกรณ์มากสุด">
          <BarList
            unit="ตัว"
            items={d.topSites.map((s) => ({ label: s.name, value: s.devices, sub: `${s.jobs} งาน` }))}
          />
        </Panel>

        <Panel title="ลูกค้าที่กลับมาซ้ำ" subtitle={`สถานที่ที่มีมากกว่า 1 งาน · ${d.repeatSites.length} แห่ง`}>
          {d.repeatSites.length === 0 ? (
            <Empty>ยังไม่มีสถานที่ที่มีมากกว่า 1 งาน</Empty>
          ) : (
            <Box>
              {d.repeatSites.map((s) => (
                <Row
                  key={s.id}
                  href={`/sites/${s.id}`}
                  title={s.name}
                  detail={`${s.devices} อุปกรณ์${s.first_on ? ` · ${formatDate(s.first_on)} – ${formatDate(s.last_on)}` : ""}`}
                  right={<Pill color="primary">{s.jobs} งาน</Pill>}
                />
              ))}
            </Box>
          )}
        </Panel>

        <Panel title="โอกาสขาย: ติดตั้งนานเกิน 2 ปี" subtitle="สถานที่ที่งานล่าสุดส่งมอบเกิน 2 ปีแล้ว · เสนอตรวจเช็ค ขยาย หรืออัปเกรด">
          {d.stale.length === 0 ? (
            <Empty>ไม่มีสถานที่ที่ติดตั้งเกิน 2 ปี</Empty>
          ) : (
            <Box>
              {d.stale.map((s) => (
                <Row
                  key={s.id}
                  href={`/sites/${s.id}`}
                  title={s.name}
                  detail={`${s.devices} อุปกรณ์${s.top_brand ? ` · ส่วนใหญ่ ${brandGroup(s.top_brand)}` : ""}`}
                  right={<Typography sx={{ fontSize: 12.5, color: "text.secondary", whiteSpace: "nowrap" }}>ล่าสุด {formatDate(s.last_on)}</Typography>}
                />
              ))}
            </Box>
          )}
        </Panel>

        <Panel title="เคลมที่ยังไม่กลับ" subtitle="เรียงจากส่งไปนานที่สุด">
          {d.claimsOpen.length === 0 ? (
            <Empty>ไม่มีเคลมค้าง</Empty>
          ) : (
            <Box>
              {d.claimsOpen.map((c) => (
                <Row
                  key={c.id}
                  href={`/devices/${c.device_id}`}
                  title={[c.brand, c.model].filter(Boolean).join(" ") || c.serial}
                  detail={[c.place, c.vendor, c.symptom].filter(Boolean).join(" · ")}
                  right={<Pill color={c.days > 30 ? "error" : "warning"}>ค้าง {c.days} วัน</Pill>}
                />
              ))}
            </Box>
          )}
          <TextLink href="/claims" sx={{ fontSize: 13, alignSelf: "flex-start" }}>
            ดูเคลมทั้งหมด
          </TextLink>
        </Panel>

        <Panel title="ประกันใกล้หมด" subtitle="ภายใน 90 วัน">
          {noWarranty ? (
            <Empty>
              ยังไม่ได้ใส่วันหมดประกัน · ตั้งทั้งงานได้ที่ปุ่ม “ตั้งประกันทั้งงาน” ในหน้างาน หรือแก้ทีละตัวในหน้าอุปกรณ์ แล้วรายการนี้จะแสดงอุปกรณ์ที่ใกล้หมดประกัน
            </Empty>
          ) : (
            <>
              <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
                มีวันหมดประกัน {fmt(d.warranty.with_date)} จาก {fmt(d.warranty.total)} ตัว · หมดแล้ว {fmt(d.warranty.expired)} · ใกล้หมด {fmt(d.warranty.soon)}
              </Typography>
              {d.expiring.length === 0 ? (
                <Empty>ไม่มีอุปกรณ์ที่ประกันจะหมดใน 90 วัน</Empty>
              ) : (
                <Box>
                  {d.expiring.map((e) => (
                    <Row
                      key={e.id}
                      href={`/devices/${e.id}`}
                      title={[e.brand, e.model].filter(Boolean).join(" ") || e.serial}
                      detail={`${e.serial ?? ""} · ${e.place}`}
                      right={<Pill color={e.days <= 30 ? "error" : "warning"}>อีก {e.days} วัน</Pill>}
                    />
                  ))}
                </Box>
              )}
            </>
          )}
        </Panel>

        <Panel
          title="อัตราเคลมต่อยี่ห้อ"
          subtitle="สัดส่วนอุปกรณ์ที่เคยส่งเคลม จากอุปกรณ์ที่ติดตั้งทั้งหมดของยี่ห้อนั้น (เฉพาะยี่ห้อที่มี 10 ตัวขึ้นไป)"
        >
          {kpi.claims === 0 ? (
            <Empty>ยังไม่มีข้อมูลเคลม · เมื่อเริ่มบันทึกเคลมในระบบ กราฟนี้จะบอกว่ายี่ห้อไหนเสียบ่อยกว่า</Empty>
          ) : (
            <>
              {kpi.claims < 20 && (
                <Typography sx={{ fontSize: 12.5, color: "warning.main" }}>ข้อมูลเคลมยังน้อย ({kpi.claims} รายการ) ใช้ดูเป็นแนวโน้มเท่านั้น</Typography>
              )}
              <BarList
                max={Math.max(5, ...d.claimRates.map((r) => (100 * r.claimed) / r.devices))}
                items={d.claimRates.map((r) => {
                  const pct = (100 * r.claimed) / r.devices;
                  return {
                    label: r.label,
                    value: pct,
                    text: `${pct.toFixed(1)}% · ${r.claimed} จาก ${fmt(r.devices)}`,
                    sub: `เคลมทั้งหมด ${r.claims} ครั้ง`,
                  };
                })}
              />
            </>
          )}
        </Panel>

        <Panel title="ความครบถ้วนของข้อมูล" subtitle="อุปกรณ์ที่มีข้อมูลช่องนั้น · ยิ่งครบ สถิติยิ่งเชื่อถือได้">
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
            <Meter label="ประเภทอุปกรณ์" percent={d.quality.device_type} />
            <Meter label="MAC" percent={d.quality.mac} />
            <Meter label="ตำแหน่งติดตั้ง" percent={d.quality.location} />
            <Meter label="IP" percent={d.quality.ip} />
            <Meter label="วันหมดประกัน" percent={d.quality.warranty} />
          </Box>
        </Panel>
      </Box>
    </>
  );
}
