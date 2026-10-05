"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import SwapHorizOutlined from "@mui/icons-material/SwapHorizOutlined";
import { useToast } from "@/components/Toast";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Job search for the picker (debounced); excludes the device's current job
function useJobOptions(input, excludeId, enabled) {
  const [state, setState] = useState({ input: null, jobs: [] });
  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/jobs?q=${encodeURIComponent(input.trim())}`, { signal: ctrl.signal });
        const { jobs = [] } = await res.json();
        setState({ input, jobs: jobs.filter((j) => j.id !== excludeId) });
      } catch {
        // aborted or offline: keep the previous list
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [input, excludeId, enabled]);
  return { jobs: state.jobs, loading: enabled && state.input !== input };
}

export default function MoveDialog({ deviceId, currentJobId, location }) {
  const router = useRouter();
  const toast = useToast();
  const phone = useMediaQuery(useTheme().breakpoints.down("sm"));
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [job, setJob] = useState(null);
  const [form, setForm] = useState({ location, moved_on: today(), note: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { jobs, loading } = useJobOptions(input, currentJobId, open);

  const start = () => {
    setJob(null);
    setInput("");
    setForm({ location, moved_on: today(), note: "" });
    setError("");
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!job) {
      setError("เลือกงานปลายทาง");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/devices/${deviceId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: job.id, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOpen(false);
      toast(`ย้ายไป ${job.site_name} · ${job.name} แล้ว`);
      router.refresh();
    } catch (err) {
      setError(err.message || "ย้ายไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button variant="outlined" startIcon={<SwapHorizOutlined />} onClick={start}>
        ย้ายไปงานอื่น
      </Button>
      <Dialog open={open} onClose={() => !saving && setOpen(false)} fullWidth maxWidth="sm" fullScreen={phone}>
        <Box component="form" onSubmit={save}>
          <DialogTitle sx={{ fontWeight: 600 }}>ย้ายอุปกรณ์ไปงานอื่น</DialogTitle>
          <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
            <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
              ใช้เมื่อย้ายตัวเดิมไปติดตั้งที่อื่น · งานเดิมจะยังเห็นว่าตัวนี้ย้ายออกไปแล้ว
            </Typography>
            {error && <Alert severity="error">{error}</Alert>}
            <Autocomplete
              options={jobs}
              loading={loading}
              value={job}
              onChange={(_, v) => setJob(v)}
              inputValue={input}
              onInputChange={(_, v) => setInput(v)}
              filterOptions={(x) => x}
              getOptionLabel={(j) => `${j.site_name} · ${j.name}`}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              noOptionsText={loading ? "กำลังค้นหา…" : "ไม่พบงาน"}
              renderOption={(props, j) => {
                const { key, ...rest } = props;
                return (
                  <li key={key} {...rest}>
                    <Box>
                      <Typography>{j.name}</Typography>
                      <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                        {j.site_name}
                        {j.delivered_on ? ` · ${j.delivered_on}` : ""}
                      </Typography>
                    </Box>
                  </li>
                );
              }}
              renderInput={(p) => <TextField {...p} label="งานปลายทาง" required placeholder="พิมพ์ชื่องานหรือสถานที่" autoFocus />}
            />
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 2fr) minmax(0, 1fr)" }, gap: 2 }}>
              <TextField
                label="ตำแหน่งใหม่"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                helperText="เว้นว่างเพื่อใช้ตำแหน่งเดิม"
              />
              <TextField
                label="วันที่ย้าย"
                type="date"
                required
                value={form.moved_on}
                onChange={(e) => setForm((f) => ({ ...f, moved_on: e.target.value }))}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Box>
            <TextField
              label="หมายเหตุการย้าย"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="เช่น ย้ายจากอาคาร 1 ไปอาคาร 3 ตามที่ลูกค้าขอ"
              multiline
              minRows={2}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={() => setOpen(false)} disabled={saving} variant="outlined">
              ยกเลิก
            </Button>
            <Button type="submit" variant="contained" disabled={saving || !job}>
              {saving ? "กำลังย้าย…" : "ย้าย"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
}
