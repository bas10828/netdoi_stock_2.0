"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import VerifiedUserOutlined from "@mui/icons-material/VerifiedUserOutlined";
import { useToast } from "@/components/Toast";

// delivered + N years, as YYYY-MM-DD (Feb 29 rolls to Mar 1, which is fine for a warranty)
function addYears(date, years) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

// Sets the warranty end date on every device installed in the job
export default function WarrantyDialog({ jobId, deliveredOn, deviceCount }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [until, setUntil] = useState("");
  const [onlyEmpty, setOnlyEmpty] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/jobs/${jobId}/warranty`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warranty_until: until, only_empty: onlyEmpty }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOpen(false);
      toast(`ตั้งประกันให้ ${data.updated} อุปกรณ์แล้ว`);
      router.refresh();
    } catch (err) {
      setError(err.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button variant="outlined" startIcon={<VerifiedUserOutlined />} onClick={() => { setUntil(""); setError(""); setOpen(true); }}>
        ตั้งประกันทั้งงาน
      </Button>
      <Dialog open={open} onClose={() => !saving && setOpen(false)} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={save}>
          <DialogTitle sx={{ fontWeight: 600 }}>ตั้งวันหมดประกันทั้งงาน</DialogTitle>
          <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
            <Typography sx={{ fontSize: 13, color: "text.secondary" }}>ใช้กับอุปกรณ์ที่ติดตั้งในงานนี้ {deviceCount} ตัว</Typography>
            {error && <Alert severity="error">{error}</Alert>}
            {deliveredOn && (
              <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                <Typography sx={{ fontSize: 13, color: "text.secondary" }}>นับจากวันส่งงาน:</Typography>
                {[1, 2, 3, 5].map((y) => (
                  <Button key={y} size="small" variant="outlined" onClick={() => setUntil(addYears(deliveredOn, y))} sx={{ minHeight: 30 }}>
                    + {y} ปี
                  </Button>
                ))}
              </Box>
            )}
            <TextField
              label="ประกันถึงวันที่"
              type="date"
              required
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <FormControlLabel
              control={<Checkbox checked={onlyEmpty} onChange={(e) => setOnlyEmpty(e.target.checked)} />}
              label="ใส่เฉพาะตัวที่ยังว่าง (ไม่ทับวันที่ที่ใส่ไว้แล้ว)"
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button variant="outlined" onClick={() => setOpen(false)} disabled={saving}>
              ยกเลิก
            </Button>
            <Button type="submit" variant="contained" disabled={saving || !until}>
              {saving ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
}
