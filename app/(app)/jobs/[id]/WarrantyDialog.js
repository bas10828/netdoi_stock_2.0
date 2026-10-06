"use client";
import { useMemo, useState } from "react";
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
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import VerifiedUserOutlined from "@mui/icons-material/VerifiedUserOutlined";
import { useToast } from "@/components/Toast";
import { TERMS, needsStartDate, termToGroup } from "@/lib/warrantyTerms";

// Sets warranty for the job's devices, one brand + model at a time.
// `devices`: the job's own devices (not the ones it only lists), each { id, brand, model, warranty_until, warranty_lifetime }.
export default function WarrantyDialog({ jobId, deliveredOn, devices }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(deliveredOn ?? "");
  const [onlyEmpty, setOnlyEmpty] = useState(true);
  const [terms, setTerms] = useState({}); // group key -> "" | "1".."5" | "life"
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const groups = useMemo(() => {
    const map = new Map();
    for (const d of devices) {
      const key = `${d.brand ?? ""}\u0000${d.model ?? ""}`;
      const g = map.get(key) ?? { key, label: [d.brand, d.model].filter(Boolean).join(" ") || "ไม่ระบุรุ่น", ids: [], have: 0 };
      g.ids.push(d.id);
      if (d.warranty_until || d.warranty_lifetime) g.have += 1;
      map.set(key, g);
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [devices]);

  const chosen = groups.filter((g) => terms[g.key]);
  const needsStart = needsStartDate(chosen.map((g) => terms[g.key]));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/jobs/${jobId}/warranty`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start,
          only_empty: onlyEmpty,
          groups: chosen.map((g) => termToGroup(terms[g.key], g.ids)),
        }),
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
      <Button
        variant="outlined"
        startIcon={<VerifiedUserOutlined />}
        onClick={() => {
          setStart(deliveredOn ?? "");
          setTerms({});
          setError("");
          setOpen(true);
        }}
      >
        ตั้งประกัน
      </Button>
      <Dialog open={open} onClose={() => !saving && setOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={save}>
          <DialogTitle sx={{ fontWeight: 600 }}>ตั้งประกันตามรุ่น</DialogTitle>
          <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="วันเริ่มประกัน"
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              helperText={deliveredOn && start === deliveredOn ? "ใช้วันส่งงาน · แก้ได้" : "ประกันหมด = วันเริ่ม + จำนวนปี"}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
              เลือกประกันของแต่ละรุ่นตามใบเสนอราคา · รุ่นที่เลือก “ไม่เปลี่ยน” จะไม่ถูกแตะ
            </Typography>
            {groups.map((g) => (
              <Box key={g.key} sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 140px", gap: 1.5, alignItems: "center" }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 500, overflowWrap: "anywhere" }}>{g.label}</Typography>
                  <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                    {g.ids.length} ตัว{g.have > 0 ? ` · มีประกันแล้ว ${g.have}` : ""}
                  </Typography>
                </Box>
                <TextField select size="small" value={terms[g.key] ?? ""} slotProps={{ select: { displayEmpty: true } }} onChange={(e) => setTerms((p) => ({ ...p, [g.key]: e.target.value }))}>
                  {TERMS.map((t) => (
                    <MenuItem key={t.value} value={t.value}>
                      {t.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
            ))}
            <FormControlLabel
              control={<Checkbox checked={onlyEmpty} onChange={(e) => setOnlyEmpty(e.target.checked)} />}
              label="ข้ามตัวที่มีประกันอยู่แล้ว (ไม่ทับ)"
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button variant="outlined" onClick={() => setOpen(false)} disabled={saving}>
              ยกเลิก
            </Button>
            <Button type="submit" variant="contained" disabled={saving || chosen.length === 0 || (needsStart && !start)}>
              {saving ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
}
