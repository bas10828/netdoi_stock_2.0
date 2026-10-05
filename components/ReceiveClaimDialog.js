"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useToast } from "./Toast";
import ScanButton from "./ScanButton";
import { CLAIM_RESULT, formatDate } from "@/lib/format";
import { fontMono } from "@/lib/fonts";

const HINT = {
  repaired: "ได้ตัวเดิมกลับมา ใช้งานต่อ",
  replaced: "ตัวใหม่เข้างานและตำแหน่งเดิม · ตัวเก่าเป็น “ถูกแทนแล้ว”",
  rejected: "ได้ตัวเดิมกลับมาโดยไม่ได้ซ่อม",
};

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// claim: { id, serial, brand, model, sent_on }
export default function ReceiveClaimDialog({ claim, size = "medium", variant = "contained" }) {
  const router = useRouter();
  const toast = useToast();
  const phone = useMediaQuery(useTheme().breakpoints.down("sm"));
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const start = () => {
    setForm({ returned_on: today(), result: "repaired", note: "", serial: "", mac: "", model: claim.model ?? "" });
    setError("");
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/claims/${claim.id}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returned_on: form.returned_on,
          result: form.result,
          note: form.note,
          replacement: form.result === "replaced" ? { serial: form.serial, mac: form.mac, model: form.model } : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOpen(false);
      toast(`รับคืน ${claim.serial || "อุปกรณ์"} แล้ว · ${CLAIM_RESULT[form.result]}`);
      router.refresh();
    } catch (err) {
      setError(err.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button variant={variant} size={size} onClick={start}>
        รับคืน
      </Button>
      <Dialog open={open} onClose={() => !saving && setOpen(false)} fullWidth maxWidth="sm" fullScreen={phone}>
        {form && (
          <Box component="form" onSubmit={save}>
            <DialogTitle sx={{ fontWeight: 600 }}>
              รับคืนจากเคลม
              <Typography sx={{ color: "text.secondary", fontSize: 14 }}>
                {[claim.brand, claim.model].filter(Boolean).join(" ")} ·{" "}
                <Box component="span" sx={{ fontFamily: fontMono }}>{claim.serial}</Box> · ส่ง {formatDate(claim.sent_on)}
              </Typography>
            </DialogTitle>
            <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField
                label="วันที่รับคืน"
                type="date"
                required
                value={form.returned_on}
                onChange={set("returned_on")}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: claim.sent_on } }}
                sx={{ maxWidth: 240 }}
              />
              <Box role="radiogroup" aria-label="ผลการเคลม" sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {Object.entries(CLAIM_RESULT).map(([value, label]) => {
                  const on = form.result === value;
                  return (
                    <Box
                      key={value}
                      component="button"
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setForm((f) => ({ ...f, result: value }))}
                      sx={{
                        textAlign: "left",
                        p: 1.5,
                        borderRadius: 2,
                        border: 1,
                        borderColor: on ? "primary.main" : "divider",
                        bgcolor: on ? "rgba(var(--mui-palette-primary-mainChannel) / 0.08)" : "background.paper",
                        color: "text.primary",
                        font: "inherit",
                        cursor: "pointer",
                      }}
                    >
                      <Typography sx={{ fontWeight: 600 }}>{label}</Typography>
                      <Typography sx={{ fontSize: 13, color: "text.secondary" }}>{HINT[value]}</Typography>
                    </Box>
                  );
                })}
              </Box>
              {form.result === "replaced" && (
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
                  <TextField
                    label="Serial ตัวใหม่"
                    required
                    value={form.serial}
                    onChange={set("serial")}
                    slotProps={{
                      htmlInput: { style: { fontFamily: fontMono } },
                      input: {
                        endAdornment: (
                          <ScanButton
                            onScan={(v, l) => setForm((f) => ({ ...f, serial: l?.serial || v, mac: l?.mac || f.mac, model: l?.model || f.model }))}
                          />
                        ),
                      },
                    }}
                  />
                  <TextField label="MAC ตัวใหม่" value={form.mac} onChange={set("mac")} slotProps={{ htmlInput: { style: { fontFamily: fontMono } } }} helperText="ไม่มีเว้นว่างได้" />
                  <TextField label="Model ตัวใหม่" value={form.model} onChange={set("model")} helperText="เปลี่ยนเฉพาะถ้าได้รุ่นอื่นมา" sx={{ gridColumn: "1 / -1" }} />
                </Box>
              )}
              <TextField label="หมายเหตุ" value={form.note} onChange={set("note")} multiline minRows={2} />
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5 }}>
              <Button variant="outlined" onClick={() => setOpen(false)} disabled={saving}>
                ยกเลิก
              </Button>
              <Button type="submit" variant="contained" disabled={saving}>
                {saving ? "กำลังบันทึก…" : "บันทึกรับคืน"}
              </Button>
            </DialogActions>
          </Box>
        )}
      </Dialog>
    </>
  );
}
