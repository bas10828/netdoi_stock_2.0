"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import EditOutlined from "@mui/icons-material/EditOutlined";
import { useToast } from "./Toast";
import { fontMono } from "@/lib/fonts";

// Button + dialog that PATCHes `url` with the edited fields, then refreshes the page.
// fields: [{ name, label, type?: "text"|"date"|"mono"|"multiline", required?, half? }]
export default function EditDialog({ title, url, fields, values, buttonLabel = "แก้ไข" }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(values);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const phone = useMediaQuery(useTheme().breakpoints.down("sm"));

  const start = () => {
    setForm(values);
    setError("");
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOpen(false);
      toast("บันทึกแล้ว");
      router.refresh();
    } catch (err) {
      setError(err.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button variant="outlined" startIcon={<EditOutlined />} onClick={start}>
        {buttonLabel}
      </Button>
      <Dialog open={open} onClose={() => !saving && setOpen(false)} fullWidth maxWidth="sm" fullScreen={phone}>
        <Box component="form" onSubmit={save}>
          <DialogTitle sx={{ fontWeight: 600 }}>{title}</DialogTitle>
          <DialogContent sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 2, pt: "8px !important" }}>
            {error && <Alert severity="error" sx={{ gridColumn: "1 / -1" }}>{error}</Alert>}
            {fields.map((f) => (
              <TextField
                key={f.name}
                label={f.label}
                value={form[f.name] ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, [f.name]: e.target.value }))}
                required={f.required}
                type={f.type === "date" ? "date" : "text"}
                multiline={f.type === "multiline"}
                minRows={f.type === "multiline" ? 2 : undefined}
                fullWidth
                sx={{ gridColumn: { xs: "1 / -1", sm: f.half ? "auto" : "1 / -1" } }}
                slotProps={{
                  inputLabel: f.type === "date" ? { shrink: true } : undefined,
                  htmlInput: f.type === "mono" ? { style: { fontFamily: fontMono } } : undefined,
                }}
              />
            ))}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={() => setOpen(false)} disabled={saving} variant="outlined">
              ยกเลิก
            </Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
}
