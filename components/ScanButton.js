"use client";
import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import QrCodeScannerOutlined from "@mui/icons-material/QrCodeScannerOutlined";
import PhotoCameraOutlined from "@mui/icons-material/PhotoCameraOutlined";
import PhotoLibraryOutlined from "@mui/icons-material/PhotoLibraryOutlined";
import FlashlightOnOutlined from "@mui/icons-material/FlashlightOnOutlined";
import FlashlightOffOutlined from "@mui/icons-material/FlashlightOffOutlined";
import { parseLabel } from "@/lib/labelParser";
import { fontMono } from "@/lib/fonts";

// ---------------------------------------------------------------------------
// Decoding. Uses the browser's own BarcodeDetector when it has one (Chrome on
// Android), otherwise zxing-wasm (ZXing C++), which reads small 1D barcodes on
// equipment labels far better than the pure-JS ZXing port. Loaded on demand.

// Different binarizers suit different labels (laser-etched, glossy, printed);
// on real label photos, trying all three found ~40% more codes than one.
const BINARIZERS = ["LocalAverage", "GlobalHistogram", "FixedThreshold"];
const COLLECT_MS = 1200; // keep reading after the first hit to catch the label's other codes

let enginePromise = null;
function getEngine() {
  enginePromise ??= (async () => {
    if (typeof window !== "undefined" && "BarcodeDetector" in window) {
      try {
        const formats = await window.BarcodeDetector.getSupportedFormats();
        if (formats.includes("code_128") && formats.includes("qr_code")) {
          const detector = new window.BarcodeDetector({ formats });
          return {
            passes: 1,
            detect: async (canvas) => (await detector.detect(canvas)).map((b) => b.rawValue),
          };
        }
      } catch {
        // fall through to zxing-wasm
      }
    }
    const { prepareZXingModule, readBarcodes } = await import("zxing-wasm/reader");
    // The .wasm file is copied to public/ by scripts/copy-wasm.mjs
    prepareZXingModule({
      overrides: { locateFile: (path, prefix) => (path.endsWith(".wasm") ? `/${path}` : prefix + path) },
    });
    const options = { tryHarder: true, tryRotate: true, tryInvert: true, tryDownscale: true, maxNumberOfSymbols: 12 };
    return {
      passes: BINARIZERS.length,
      detect: async (canvas, pass = 0) => {
        const image = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
        const results = await readBarcodes(image, { ...options, binarizer: BINARIZERS[pass % BINARIZERS.length] });
        return results.filter((r) => r.isValid).map((r) => r.text);
      },
    };
  })();
  return enginePromise;
}

// Photo -> every code on it. All binarizers are tried and merged (a label's S/N and
// MAC barcodes may each need a different one); full size only if nothing was found.
async function decodePhoto(file) {
  const engine = await getEngine();
  const bitmap = await createImageBitmap(file);
  try {
    for (const max of [2000, Infinity]) {
      const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d", { willReadFrequently: true }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const found = new Set();
      for (let pass = 0; pass < engine.passes; pass++) {
        for (const t of await engine.detect(canvas, pass)) if (t?.trim()) found.add(t.trim());
      }
      if (found.size > 0 || scale === 1) return [...found];
    }
    return [];
  } finally {
    bitmap.close?.();
  }
}

function cameraError(err) {
  if (typeof window !== "undefined" && !window.isSecureContext) return "browser ไม่ให้เปิดกล้องสดบนลิงก์นี้ (ต้องเป็น https)";
  if (err?.name === "NotAllowedError") return "browser ไม่ให้ใช้กล้องสดบนลิงก์นี้";
  if (err?.name === "NotFoundError" || err?.name === "OverconstrainedError") return "ไม่พบกล้องบนอุปกรณ์นี้";
  if (err?.name === "NotReadableError") return "กล้องถูกแอปอื่นใช้อยู่";
  return "เปิดกล้องสดไม่สำเร็จ";
}

// ---------------------------------------------------------------------------

const whiteBtn = { bgcolor: "#fff", color: "#000", "&:hover": { bgcolor: "#eee" } };
const BRAND_LABEL = {
  unifi: "Ubiquiti UniFi", reyee: "Reyee", "tp-link": "TP-Link", injector: "TP-Link Injector", hikvision: "Hikvision",
  yealink: "Yealink", mikrotik: "MikroTik", dahua: "Dahua", cleanline: "Cleanline", cisco: "Cisco",
};

// Live camera + photo options. Calls onResult(label) once, label = parseLabel(...) + codes.
function Scanner({ onResult, onClose, onRestart }) {
  const videoRef = useRef(null);
  const trackRef = useRef(null);
  const busyRef = useRef(false);
  const doneRef = useRef(false);
  const resultRef = useRef(onResult);
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const [status, setStatus] = useState("starting"); // starting | live | collecting | error | reading
  const [message, setMessage] = useState("");
  const [label, setLabel] = useState(null); // parsed result waiting for confirmation
  const [torch, setTorch] = useState(null); // null = not supported

  useEffect(() => {
    resultRef.current = onResult;
  }, [onResult]);

  const finish = (result) => {
    if (doneRef.current) return;
    doneRef.current = true;
    navigator.vibrate?.(60);
    resultRef.current(result);
  };

  // A single plain code needs no confirmation; anything richer is shown first
  const handleCodes = (codes) => {
    const parsed = { ...parseLabel(codes), codes };
    if (!parsed.serial && !parsed.mac) return false;
    if (codes.length === 1 && parsed.serial === codes[0].trim() && !parsed.mac) finish(parsed);
    else setLabel(parsed);
    return true;
  };

  // Live camera: read frames a few times a second; after the first hit keep
  // collecting briefly so the S/N and MAC barcodes are both caught.
  useEffect(() => {
    let stream = null;
    let timer = null;
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("no camera api"), { name: "NotAllowedError" });
        const engine = getEngine(); // load the decoder while the camera opens
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (cancelled) return;
        const track = stream.getVideoTracks()[0];
        trackRef.current = track;
        const caps = track.getCapabilities?.() ?? {};
        if (caps.focusMode?.includes("continuous")) track.applyConstraints({ advanced: [{ focusMode: "continuous" }] }).catch(() => {});
        if (caps.torch) setTorch(false);
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        const detector = await engine;
        if (cancelled) return;
        setStatus("live");
        const canvas = document.createElement("canvas");
        const found = new Set();
        let firstHit = 0;
        let pass = 0;
        timer = setInterval(async () => {
          if (busyRef.current || doneRef.current || !video.videoWidth) return;
          busyRef.current = true;
          try {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext("2d", { willReadFrequently: true }).drawImage(video, 0, 0);
            for (const t of await detector.detect(canvas, pass++)) if (t?.trim()) found.add(t.trim());
            if (found.size > 0 && !firstHit) {
              firstHit = Date.now();
              navigator.vibrate?.(20);
              setStatus("collecting");
            }
            if (firstHit && Date.now() - firstHit >= COLLECT_MS && !cancelled) {
              clearInterval(timer);
              handleCodes([...found]);
            }
          } catch {
            // a bad frame; try the next one
          } finally {
            busyRef.current = false;
          }
        }, 200);
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setMessage(cameraError(err));
        }
      }
    })();
    return () => {
      cancelled = true;
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start the camera once per opening
  }, []);

  const toggleTorch = async () => {
    const next = !torch;
    try {
      await trackRef.current?.applyConstraints({ advanced: [{ torch: next }] });
      setTorch(next);
    } catch {
      setTorch(null);
    }
  };

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const back = status === "live" || status === "collecting" ? "live" : "error";
    setStatus("reading");
    try {
      const codes = await decodePhoto(file);
      setStatus(back);
      if (!handleCodes(codes)) {
        setMessage(
          codes.length
            ? "อ่าน code ได้แต่ไม่ใช่ S/N หรือ MAC · ลองถ่ายป้ายอีกจุด"
            : "ไม่เจอ QR / barcode ในรูป · ถ่ายให้ใกล้ขึ้น ชัด ไม่สะท้อนแสง หรือครอปให้เหลือแต่ป้าย"
        );
      }
    } catch {
      setStatus(back);
      setMessage("อ่านรูปนี้ไม่ได้");
    }
  };

  const hint =
    status === "starting"
      ? "กำลังเปิดกล้อง…"
      : status === "reading"
        ? "กำลังอ่านจากรูป…"
        : status === "collecting"
          ? "เจอแล้ว · ถือค้างไว้อีกนิด กำลังอ่าน barcode อื่นบนป้าย…"
          : message || "เล็งป้ายให้เห็น barcode ทั้งหมด ถือนิ่งๆ";

  return (
    <Box sx={{ position: "relative", bgcolor: "#000", height: { xs: "78vh", sm: 520 }, maxHeight: "85vh", overflow: "hidden" }}>
      <Box component="video" ref={videoRef} muted playsInline sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />

      {(status === "live" || status === "collecting") && !label && (
        <Box
          aria-hidden
          sx={{
            position: "absolute", left: "6%", right: "6%", top: "24%", height: "40%", borderRadius: 2,
            border: "2px solid", borderColor: status === "collecting" ? "#5BD98A" : "rgba(255,255,255,0.9)",
            boxShadow: "0 0 0 100vmax rgba(0,0,0,0.35)", transition: "border-color .2s",
          }}
        />
      )}
      {(status === "starting" || status === "reading") && (
        <CircularProgress sx={{ position: "absolute", top: "40%", left: "calc(50% - 20px)", color: "#fff" }} />
      )}

      {torch !== null && !label && (
        <IconButton
          aria-label={torch ? "ปิดไฟฉาย" : "เปิดไฟฉาย"}
          onClick={toggleTorch}
          sx={{ position: "absolute", top: 12, right: 12, bgcolor: "rgba(0,0,0,0.45)", color: "#fff", "&:hover": { bgcolor: "rgba(0,0,0,0.6)" } }}
        >
          {torch ? <FlashlightOffOutlined /> : <FlashlightOnOutlined />}
        </IconButton>
      )}

      {/* Confirm what was read from the label */}
      {label && (
        <Box sx={{ position: "absolute", inset: 0, bgcolor: "rgba(0,0,0,0.88)", color: "#fff", p: 2.25, display: "flex", flexDirection: "column", gap: 1.5, overflowY: "auto" }}>
          <Typography sx={{ fontWeight: 600 }}>
            อ่านจากป้ายได้{label.brand ? ` · ${BRAND_LABEL[label.brand] ?? label.brand}` : ""}
          </Typography>
          {[
            ["S/N", label.serial],
            ["MAC", label.mac],
            ["Model", label.model],
          ].map(([k, v]) =>
            v || k !== "Model" ? (
              <Box key={k} sx={{ display: "flex", gap: 1.5, alignItems: "baseline" }}>
                <Typography sx={{ width: 52, flex: "none", opacity: 0.7, fontSize: 13 }}>{k}</Typography>
                <Typography sx={{ fontFamily: fontMono, fontSize: 16, overflowWrap: "anywhere", opacity: v ? 1 : 0.5 }}>{v || "ไม่พบ"}</Typography>
              </Box>
            ) : null
          )}
          <Button variant="contained" size="large" onClick={() => finish(label)} sx={{ mt: 0.5 }}>
            ใช้ค่านี้
          </Button>

          {label.codes.length > 1 && (
            <>
              <Typography sx={{ fontSize: 13, opacity: 0.7, mt: 1 }}>ไม่ถูก? เลือก code ที่อ่านได้เองเป็น S/N</Typography>
              {label.codes.map((c) => (
                <Box
                  key={c}
                  component="button"
                  type="button"
                  onClick={() => finish({ serial: c, mac: "", macRaw: "", brand: null, model: "", codes: label.codes })}
                  sx={{ textAlign: "left", p: 1.25, borderRadius: 2, border: "1px solid rgba(255,255,255,0.3)", bgcolor: "rgba(255,255,255,0.06)", color: "#fff", font: "inherit", cursor: "pointer", "&:hover": { bgcolor: "rgba(255,255,255,0.14)" } }}
                >
                  <Typography sx={{ fontFamily: fontMono, fontSize: 14, overflowWrap: "anywhere" }}>{c}</Typography>
                </Box>
              ))}
            </>
          )}
          <Box sx={{ display: "flex", gap: 1, justifyContent: "center", mt: 1 }}>
            <Button onClick={onRestart} sx={{ color: "#fff" }}>
              สแกนใหม่
            </Button>
            <Button onClick={onClose} sx={whiteBtn} variant="contained">ปิด</Button>
          </Box>
        </Box>
      )}

      {!label && (
        <Box sx={{ position: "absolute", left: 0, right: 0, bottom: 0, p: 2, display: "flex", flexDirection: "column", gap: 1.25, alignItems: "center", background: "linear-gradient(transparent, rgba(0,0,0,0.8))" }}>
          <Typography role="status" sx={{ color: "#fff", textAlign: "center", fontSize: 14 }}>
            {hint}
          </Typography>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "center" }}>
            <Button variant="contained" disabled={status === "reading"} onClick={() => cameraRef.current?.click()} startIcon={<PhotoCameraOutlined />}>
              ถ่ายรูป
            </Button>
            <Button variant="contained" disabled={status === "reading"} onClick={() => galleryRef.current?.click()} startIcon={<PhotoLibraryOutlined />}>
              เลือกจากคลังภาพ
            </Button>
            <Button variant="contained" onClick={onClose} sx={whiteBtn}>
              ปิด
            </Button>
          </Box>
          {status === "error" && (
            <Box component="a" href="/phone-setup" target="_blank" sx={{ color: "#fff", fontSize: 13, textDecoration: "underline" }}>
              ตั้งค่ามือถือให้ใช้กล้องสด
            </Box>
          )}
        </Box>
      )}

      {/* capture: opens the camera app; without it: the photo picker / gallery */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onPhoto} hidden />
      <input ref={galleryRef} type="file" accept="image/*" onChange={onPhoto} hidden />
    </Box>
  );
}

/**
 * Camera button for any field. onScan(value, label):
 *   value: the S/N, or the MAC when no S/N was found
 *   label: { serial, mac, macRaw, brand, model, codes } for callers that want both
 */
export default function ScanButton({ onScan, label = "สแกน QR / barcode", edge = "end" }) {
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0); // bumping it restarts the scanner
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
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" slotProps={{ paper: { sx: { overflow: "hidden", m: 1 } } }}>
        {open && (
          <Scanner
            key={round}
            onRestart={() => setRound((r) => r + 1)}
            onClose={() => setOpen(false)}
            onResult={(result) => {
              setOpen(false);
              handle.current(result.serial || result.mac, result);
            }}
          />
        )}
      </Dialog>
    </>
  );
}
