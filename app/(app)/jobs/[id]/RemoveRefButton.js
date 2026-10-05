"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import LinkOffOutlined from "@mui/icons-material/LinkOffOutlined";
import { useToast } from "@/components/Toast";

// Takes a stayed-put device out of this job's report (asks first)
export default function RemoveRefButton({ jobId, deviceId, serial }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/refs/${deviceId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOpen(false);
      toast(`เอา ${serial || "อุปกรณ์"} ออกจากรายงานงานนี้แล้ว`);
      router.refresh();
    } catch (err) {
      toast(err.message || "ไม่สำเร็จ", { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Tooltip title="เอาออกจากรายงานงานนี้">
        <IconButton size="small" aria-label={`เอา ${serial || "อุปกรณ์"} ออกจากรายงานงานนี้`} onClick={() => setOpen(true)}>
          <LinkOffOutlined fontSize="small" />
        </IconButton>
      </Tooltip>
      <Dialog open={open} onClose={() => !busy && setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>เอาออกจากรายงานงานนี้?</DialogTitle>
        <DialogContent>
          <Typography>
            <strong>{serial || "อุปกรณ์"}</strong> จะไม่แสดงในงานนี้และใน Export อีก · ตัวอุปกรณ์และงานที่ติดตั้งไม่เปลี่ยน
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="outlined" onClick={() => setOpen(false)} disabled={busy}>
            ยกเลิก
          </Button>
          <Button variant="contained" color="error" onClick={remove} disabled={busy}>
            เอาออก
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
