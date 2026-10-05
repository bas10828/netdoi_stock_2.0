"use client";
import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import QrCodeScannerOutlined from "@mui/icons-material/QrCodeScannerOutlined";

// Why the camera could not start, in words the user can act on
function cameraError(err) {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "เปิดกล้องได้เฉพาะเว็บที่เป็น HTTPS · เปิดผ่านลิงก์ https:// ของระบบ แล้วลองใหม่";
  }
  if (err?.name === "NotAllowedError") return "ไม่ได้รับอนุญาตให้ใช้กล้อง · อนุญาตกล้องในการตั้งค่าของ browser แล้วลองใหม่";
  if (err?.name === "NotFoundError" || err?.name === "OverconstrainedError") return "ไม่พบกล้องบนอุปกรณ์นี้";
  if (err?.name === "NotReadableError") return "กล้องถูกแอปอื่นใช้อยู่ · ปิดแอปนั้นแล้วลองใหม่";
  return "เปิดกล้องไม่สำเร็จ";
}

// Live camera view; calls onResult once with the first code it reads
function Scanner({ onResult, onClose }) {
  const videoRef = useRef(null);
  const doneRef = useRef(false);
  const resultRef = useRef(onResult);
  const [error, setError] = useState("");
  useEffect(() => {
    resultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    let controls = null;
    let cancelled = false;
    (async () => {
      try {
        // Loaded on demand so pages without scanning don't pay for it
        const [{ BrowserMultiFormatReader }, { DecodeHintType }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        const hints = new Map([[DecodeHintType.TRY_HARDER, true]]);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });
        const c = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
          videoRef.current,
          (result) => {
            if (!result || doneRef.current) return;
            doneRef.current = true;
            navigator.vibrate?.(60);
            resultRef.current(result.getText().trim());
          }
        );
        if (cancelled) c.stop();
        else controls = c;
      } catch (err) {
        if (!cancelled) setError(cameraError(err));
      }
    })();
    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, []); // start the camera once per opening

  return (
    <Box sx={{ position: "relative", bgcolor: "#000", aspectRatio: { xs: "3 / 4", sm: "4 / 3" }, maxHeight: "75vh" }}>
      <Box component="video" ref={videoRef} muted playsInline sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      {/* Aiming frame */}
      {!error && (
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            inset: "22% 10%",
            border: "2px solid rgba(255,255,255,0.9)",
            borderRadius: 2,
            boxShadow: "0 0 0 100vmax rgba(0,0,0,0.35)",
          }}
        />
      )}
      <Box sx={{ position: "absolute", left: 0, right: 0, bottom: 0, p: 2, display: "flex", flexDirection: "column", gap: 1.5, alignItems: "center" }}>
        <Typography role="status" sx={{ color: "#fff", textAlign: "center", fontSize: 14, textShadow: "0 1px 3px rgba(0,0,0,.8)" }}>
          {error || "เล็ง QR หรือ barcode ให้อยู่ในกรอบ"}
        </Typography>
        <Button variant="contained" onClick={onClose} sx={{ bgcolor: "#fff", color: "#000", "&:hover": { bgcolor: "#eee" } }}>
          ปิด
        </Button>
      </Box>
    </Box>
  );
}

// Camera button for any field: opens the scanner and hands the read text to onScan
export default function ScanButton({ onScan, label = "สแกน QR / barcode", edge = "end" }) {
  const [open, setOpen] = useState(false);
  const handle = useRef(onScan);
  useEffect(() => {
    handle.current = onScan;
  }, [onScan]);

  return (
    <>
      <Tooltip title={label}>
        <IconButton aria-label={label} onClick={() => setOpen(true)} edge={edge}>
          <QrCodeScannerOutlined />
        </IconButton>
      </Tooltip>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" slotProps={{ paper: { sx: { overflow: "hidden", m: 1.5 } } }}>
        {open && (
          <Scanner
            onClose={() => setOpen(false)}
            onResult={(text) => {
              setOpen(false);
              handle.current(text);
            }}
          />
        )}
      </Dialog>
    </>
  );
}
