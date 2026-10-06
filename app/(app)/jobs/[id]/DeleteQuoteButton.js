"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@mui/material/Button";
import { useToast } from "@/components/Toast";

// Two clicks to remove a quotation from the job (the second asks to confirm). Warranty set from it stays.
export default function DeleteQuoteButton({ quoteId }) {
  const router = useRouter();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/quotes/${quoteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "ลบไม่สำเร็จ");
      toast("ลบใบเสนอราคาแล้ว");
      router.refresh();
    } catch (err) {
      toast(err.message);
      setBusy(false);
      setConfirming(false);
    }
  };

  return confirming ? (
    <Button size="small" color="error" variant="contained" disabled={busy} onClick={remove} onBlur={() => setConfirming(false)} autoFocus>
      ยืนยันลบ
    </Button>
  ) : (
    <Button size="small" color="inherit" sx={{ color: "text.secondary" }} onClick={() => setConfirming(true)}>
      ลบ
    </Button>
  );
}
