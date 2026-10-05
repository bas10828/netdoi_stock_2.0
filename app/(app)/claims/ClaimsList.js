"use client";
import { useMemo, useState } from "react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import InputAdornment from "@mui/material/InputAdornment";
import Link from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import FilterListIcon from "@mui/icons-material/FilterList";
import BuildCircleOutlined from "@mui/icons-material/BuildCircleOutlined";
import { Pill } from "@/components/StatusBadge";
import ReceiveClaimDialog from "@/components/ReceiveClaimDialog";
import EmptyState from "@/components/EmptyState";
import { LinkButton } from "@/components/Links";
import { useToast } from "@/components/Toast";
import { CLAIM_RESULT, formatDate, searchKey } from "@/lib/format";
import { fontMono } from "@/lib/fonts";

const LATE_DAYS = 30;
const mono = { fontFamily: fontMono, fontSize: 13 };

function DaysPill({ claim }) {
  if (claim.returned_on) {
    const color = claim.result === "replaced" ? "primary" : claim.result === "rejected" ? "neutral" : "success";
    return <Pill color={color}>{CLAIM_RESULT[claim.result]}</Pill>;
  }
  return <Pill color={claim.days_out > LATE_DAYS ? "error" : "warning"}>ค้าง {claim.days_out} วัน</Pill>;
}

function CancelButton({ claim }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const cancel = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/claims/${claim.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOpen(false);
      toast(`ยกเลิกเคลม ${claim.serial || ""} แล้ว`);
      router.refresh();
    } catch (err) {
      toast(err.message || "ไม่สำเร็จ", { error: true });
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button size="small" color="inherit" onClick={() => setOpen(true)} sx={{ color: "text.secondary" }}>
        ยกเลิก
      </Button>
      <Dialog open={open} onClose={() => !busy && setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>ยกเลิกเคลมนี้?</DialogTitle>
        <DialogContent>
          <Typography>ใช้เมื่อส่งเคลมผิดตัว · รายการนี้จะถูกลบ และอุปกรณ์กลับเป็น “ใช้งานอยู่”</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="outlined" onClick={() => setOpen(false)} disabled={busy}>ไม่ยกเลิก</Button>
          <Button variant="contained" color="error" onClick={cancel} disabled={busy}>ยกเลิกเคลม</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function ClaimRow({ c }) {
  const device = [c.brand, c.model].filter(Boolean).join(" ") || c.device_type || "อุปกรณ์";
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.3fr) minmax(0, 1.2fr) minmax(0, 1.3fr) minmax(0, 0.9fr) auto" },
        gap: { xs: 0.5, md: 2 },
        alignItems: "center",
        px: 2,
        py: 1.5,
        borderTop: 1,
        borderColor: "divider",
        "&:first-of-type": { borderTop: 0 },
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 500 }}>{device}</Typography>
        <Link component={NextLink} href={`/devices/${c.device_id}`} sx={mono}>
          {c.serial || "ไม่มี serial"}
        </Link>
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 13, color: c.job_id ? "text.primary" : "text.secondary" }}>
          {c.job_id ? (
            <Link component={NextLink} href={`/jobs/${c.job_id}`} color="inherit">
              {c.place}
            </Link>
          ) : (
            c.place
          )}
        </Typography>
        {c.location && <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{c.location}</Typography>}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 13 }}>{c.symptom || "—"}</Typography>
        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
          {[c.vendor, c.ticket_no && `เลขเคลม ${c.ticket_no}`].filter(Boolean).join(" · ")}
        </Typography>
        {c.replacement_serial && (
          <Typography sx={{ fontSize: 12 }}>
            ตัวใหม่{" "}
            <Link component={NextLink} href={`/devices/${c.replacement_device_id}`} sx={mono}>
              {c.replacement_serial}
            </Link>
          </Typography>
        )}
      </Box>
      <Box>
        <Typography sx={{ fontSize: 13, color: "text.secondary", whiteSpace: "nowrap" }}>
          ส่ง {formatDate(c.sent_on)}
          {c.returned_on && <><br />กลับ {formatDate(c.returned_on)}</>}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, justifyContent: { md: "flex-end" }, flexWrap: "wrap" }}>
        <DaysPill claim={c} />
        {!c.returned_on && (
          <>
            <CancelButton claim={c} />
            <ReceiveClaimDialog claim={c} size="small" />
          </>
        )}
      </Box>
    </Box>
  );
}

export default function ClaimsList({ tab, openCount, claims }) {
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const [vendor, setVendor] = useState("");

  const vendors = useMemo(() => [...new Set(claims.map((c) => c.vendor).filter(Boolean))].sort(), [claims]);
  const shown = useMemo(() => {
    const text = filter.trim().toLowerCase();
    const key = searchKey(filter);
    return claims.filter((c) => {
      if (vendor && c.vendor !== vendor) return false;
      if (!text) return true;
      return (
        (key && searchKey(c.serial).includes(key)) ||
        [c.brand, c.model, c.place, c.symptom, c.ticket_no, c.vendor].some((v) => v?.toLowerCase().includes(text))
      );
    });
  }, [claims, filter, vendor]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Tabs
        value={tab}
        onChange={(_, v) => router.push(v === "open" ? "/claims" : "/claims?tab=closed")}
        sx={{ borderBottom: 1, borderColor: "divider", minHeight: 40, "& .MuiTab-root": { minHeight: 40, textTransform: "none", fontWeight: 500 } }}
      >
        <Tab value="open" label={`ยังไม่กลับ (${openCount})`} />
        <Tab value="closed" label="ปิดแล้ว" />
      </Tabs>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
        <TextField
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="ค้นหา serial, รุ่น, สถานที่, อาการ, เลขเคลม"
          size="small"
          sx={{ flex: "1 1 260px", maxWidth: { sm: 380 } }}
          slotProps={{
            htmlInput: { "aria-label": "ค้นหาเคลม" },
            input: { startAdornment: <InputAdornment position="start"><FilterListIcon fontSize="small" /></InputAdornment> },
          }}
        />
        {vendors.length > 1 && (
          <TextField select size="small" label="ศูนย์ที่ส่ง" value={vendor} onChange={(e) => setVendor(e.target.value)} sx={{ minWidth: 200 }}>
            <MenuItem value="">ทั้งหมด</MenuItem>
            {vendors.map((v) => (
              <MenuItem key={v} value={v}>{v}</MenuItem>
            ))}
          </TextField>
        )}
      </Box>

      {claims.length === 0 ? (
        <EmptyState
          icon={<BuildCircleOutlined />}
          title={tab === "open" ? "ไม่มีเคลมค้าง" : "ยังไม่มีเคลมที่ปิดแล้ว"}
          description={tab === "open" ? "ส่งเคลมได้จากหน้าอุปกรณ์ หรือส่งหลายตัวพร้อมกันจากปุ่ม “ส่งเคลม”" : undefined}
          action={tab === "open" && <LinkButton href="/claims/new" variant="contained">ส่งเคลม</LinkButton>}
        />
      ) : shown.length === 0 ? (
        <Typography sx={{ textAlign: "center", color: "text.secondary", py: 4 }}>ไม่พบเคลมที่ตรงกับตัวกรอง</Typography>
      ) : (
        <Card>
          {shown.map((c) => (
            <ClaimRow key={c.id} c={c} />
          ))}
        </Card>
      )}
    </Box>
  );
}
