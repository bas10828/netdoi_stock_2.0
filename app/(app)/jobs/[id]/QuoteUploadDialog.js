"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import UploadFileOutlined from "@mui/icons-material/UploadFileOutlined";
import { useToast } from "@/components/Toast";
import { formatDate } from "@/lib/format";
import { TERMS, needsStartDate, termToGroup } from "@/lib/warrantyTerms";

const baht = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });

// "3Years" found in a quote line -> the select value used by the warranty dialog
const termOf = (w) => (w?.lifetime ? "life" : w?.years ? String(w.years) : "");
const termLabel = (v) => TERMS.find((t) => t.value === v)?.label ?? `${v} ปี`;

// Attach a quotation (.xlsx) to the job: stores its lines and prices, and sets warranty from the
// warranty text on each line for the devices whose model the line names. Everything is shown first.
export default function QuoteUploadDialog({ jobId, deliveredOn }) {
  const router = useRouter();
  const toast = useToast();
  const input = useRef(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [terms, setTerms] = useState({});
  const [start, setStart] = useState(deliveredOn ?? "");
  const [saveQuote, setSaveQuote] = useState(true);
  const [onlyEmpty, setOnlyEmpty] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setFile(null);
    setPreview(null);
    setTerms({});
    setStart(deliveredOn ?? "");
    setSaveQuote(true);
    setOnlyEmpty(true);
    setError("");
  };

  const send = async (f, mode, extra = {}) => {
    const body = new FormData();
    body.set("file", f);
    body.set("mode", mode);
    for (const [k, v] of Object.entries(extra)) body.set(k, v);
    const res = await fetch(`/api/jobs/${jobId}/quote`, { method: "POST", body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "ไม่สำเร็จ");
    return data;
  };

  const pick = async (f) => {
    if (!f) return;
    setBusy(true);
    setError("");
    try {
      const data = await send(f, "preview");
      setFile(f);
      setPreview(data);
      // Suggest the warranty written on the matched line; the user can change every one
      setTerms(Object.fromEntries(data.groups.map((g) => [g.key, termOf(g.match?.warranty)])));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const chosen = preview ? preview.groups.filter((g) => terms[g.key]) : [];
  const needsStart = needsStartDate(chosen.map((g) => terms[g.key]));

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const groups = chosen.map((g) => termToGroup(terms[g.key], g.ids));
      const data = await send(file, "save", { start, only_empty: String(onlyEmpty), save_quote: String(saveQuote), groups: JSON.stringify(groups) });
      setOpen(false);
      toast([data.quote && "เก็บใบเสนอราคาแล้ว", groups.length > 0 && `ตั้งประกัน ${data.updated} อุปกรณ์`].filter(Boolean).join(" · "));
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<UploadFileOutlined />}
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        แนบใบเสนอราคา
      </Button>
      <Dialog open={open} onClose={() => !busy && setOpen(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 600 }}>แนบใบเสนอราคา / ประมาณการ</DialogTitle>
        <DialogContent
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!busy) pick(e.dataTransfer.files?.[0]);
          }}
          sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}
        >
          {error && <Alert severity="error">{error}</Alert>}
          <input ref={input} type="file" accept=".xlsx,.xls" hidden onChange={(e) => pick(e.target.files?.[0])} />

          {!preview && (
            <Box
              sx={{
                border: 2,
                borderStyle: "dashed",
                borderColor: dragging ? "primary.main" : "divider",
                bgcolor: dragging ? "action.hover" : "transparent",
                borderRadius: 2,
                p: 4,
                textAlign: "center",
              }}
            >
              {busy ? (
                <CircularProgress size={28} />
              ) : (
                <>
                  <Typography sx={{ mb: 1.5, color: "text.secondary" }}>
                    ลากไฟล์มาวางตรงนี้ หรือกดเลือกไฟล์ · Excel (.xlsx, .xls) ที่มีหัวคอลัมน์ “จำนวน” · ราคาไม่มีก็ได้ · อ่านประกันจากวงเล็บท้ายชื่อรายการ เช่น (3Years. Waranty)
                  </Typography>
                  <Button variant="contained" onClick={() => input.current?.click()}>
                    เลือกไฟล์
                  </Button>
                </>
              )}
            </Box>
          )}

          {preview && (
            <>
              <Alert severity="info" icon={false}>
                <b>{[preview.kind, preview.doc_no].filter(Boolean).join(" ")}</b> · {preview.file}
                <br />
                {[preview.doc_date && formatDate(preview.doc_date), preview.customer && `ถึง ${preview.customer}`].filter(Boolean).join(" · ")}
                {(preview.doc_date || preview.customer) && <br />}
                {preview.items.length} บรรทัด · มีราคา {preview.items.filter((i) => i.amount !== null).length} · รวม {baht.format(preview.items_total)} บาท
                {preview.stated_total !== null && Math.abs(preview.stated_total - preview.items_total) > 0.5 && (
                  <Box component="span" sx={{ color: "warning.main" }}> · ใบเขียนยอดรวม {baht.format(preview.stated_total)} ไม่ตรง ตรวจสอบก่อน</Box>
                )}
                {preview.mismatched > 0 && <Box component="span" sx={{ color: "warning.main" }}> · {preview.mismatched} บรรทัดจำนวน × ราคา ไม่ตรงกับยอด</Box>}
              </Alert>

              <FormControlLabel
                control={<Checkbox checked={saveQuote} onChange={(e) => setSaveQuote(e.target.checked)} />}
                label="เก็บรายการและราคาไว้ในงานนี้ (ถ้าเคยแนบไฟล์ชื่อเดียวกัน จะแทนที่)"
              />

              <Typography sx={{ fontWeight: 600 }}>ประกันของอุปกรณ์ในงานนี้</Typography>
              <Typography sx={{ fontSize: 13, color: "text.secondary", mt: -1 }}>
                จับคู่จากชื่อรุ่นในใบ · เลือก “ไม่เปลี่ยน” ถ้าใบไม่ได้เขียนประกัน หรือจับคู่ไม่เจอ แก้เองได้ทุกแถว
              </Typography>
              <TextField
                label="วันเริ่มประกัน"
                type="date"
                size="small"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                helperText={deliveredOn && start === deliveredOn ? "ใช้วันส่งงาน · แก้ได้" : undefined}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ maxWidth: 240 }}
              />
              {preview.groups.map((g) => {
                const suggested = termOf(g.match?.warranty);
                const options = suggested && !TERMS.some((t) => t.value === suggested) ? [...TERMS, { value: suggested, label: termLabel(suggested) }] : TERMS;
                return (
                  <Box key={g.key} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 1fr) 150px" }, gap: 1.5, alignItems: "center" }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 500, overflowWrap: "anywhere" }}>
                        {g.label} <Box component="span" sx={{ fontWeight: 400, color: "text.secondary", fontSize: 13 }}>· {g.ids.length} ตัว{g.have > 0 ? ` · มีประกันแล้ว ${g.have}` : ""}</Box>
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: g.match ? "text.secondary" : "warning.main", overflowWrap: "anywhere" }}>
                        {g.match ? `ในใบ: ${g.match.description}` : "ไม่พบรุ่นนี้ในใบ"}
                      </Typography>
                    </Box>
                    <TextField
                      select
                      size="small"
                      value={terms[g.key] ?? ""}
                      onChange={(e) => setTerms((p) => ({ ...p, [g.key]: e.target.value }))}
                      slotProps={{ select: { displayEmpty: true } }}
                    >
                      {options.map((t) => (
                        <MenuItem key={t.value} value={t.value}>
                          {t.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Box>
                );
              })}
              <FormControlLabel
                control={<Checkbox checked={onlyEmpty} onChange={(e) => setOnlyEmpty(e.target.checked)} />}
                label="ข้ามตัวที่มีประกันอยู่แล้ว (ไม่ทับ)"
              />
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          {preview && (
            <Button onClick={reset} disabled={busy} sx={{ mr: "auto" }}>
              เลือกไฟล์อื่น
            </Button>
          )}
          <Button variant="outlined" onClick={() => setOpen(false)} disabled={busy}>
            ยกเลิก
          </Button>
          {preview && (
            <Button variant="contained" onClick={save} disabled={busy || (!saveQuote && chosen.length === 0) || (needsStart && !start)}>
              {busy ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
