"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import AddOutlined from "@mui/icons-material/AddOutlined";
import PageHeader from "@/components/PageHeader";
import ScanButton from "@/components/ScanButton";
import StatusBadge, { Pill } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { fontMono } from "@/lib/fonts";
import SitePicker from "@/components/SitePicker";
import { BRAND_NAMES, guessBrand, macDigits } from "@/lib/labelParser";

const UNRECORDED_JOB = "อุปกรณ์เดิม (ไม่มีรายงาน)";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const norm = (s) => String(s ?? "").trim().toLowerCase();

// One item in the batch: a known device, or one that isn't in the system yet
// "Looks like TP-Link — yes / no", from the S/N format or the MAC vendor prefix
function BrandGuess({ item, onChange }) {
  const guess = guessBrand(item.serial, item.mac);
  if (!guess || item.brand?.trim() || item.guessDismissed === guess) return null;
  return (
    <Box sx={{ gridColumn: "1 / -1", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, px: 1.25, py: 0.75, borderRadius: 2, bgcolor: "rgba(var(--mui-palette-primary-mainChannel) / 0.08)" }}>
      <Typography sx={{ fontSize: 13 }}>
        น่าจะเป็น <strong>{guess}</strong>
      </Typography>
      <Button size="small" variant="contained" onClick={() => onChange({ brand: guess })} sx={{ minHeight: 28 }}>
        ใช่
      </Button>
      <Button size="small" onClick={() => onChange({ guessDismissed: guess })} sx={{ minHeight: 28 }}>
        ไม่ใช่
      </Button>
    </Box>
  );
}

function ItemRow({ item, onChange, onRemove }) {
  const d = item.device;
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr auto", md: "minmax(0, 1.2fr) minmax(0, 1.4fr) auto" }, gap: 1.5, alignItems: "start", px: 2, py: 1.5, borderTop: 1, borderColor: "divider", "&:first-of-type": { borderTop: 0 } }}>
      <Box sx={{ minWidth: 0 }}>
        {d ? (
          <>
            <Typography sx={{ fontWeight: 500 }}>{[d.brand, d.model].filter(Boolean).join(" ") || d.device_type || "อุปกรณ์"}</Typography>
            <Typography sx={{ fontFamily: fontMono, fontSize: 13 }}>{d.serial}</Typography>
            <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
              {[d.place, d.location].filter(Boolean).join(" · ")}
            </Typography>
          </>
        ) : (
          <>
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, mb: 0.75 }}>
              <Typography sx={{ fontFamily: fontMono, fontSize: 13, fontWeight: 500 }}>{item.serial}</Typography>
              <Pill color="neutral">{item.site_name?.trim() ? "ไม่มีในระบบ · จะเพิ่มเข้าสถานที่นี้" : "ไม่มีในระบบ · ไม่สังกัดงาน"}</Pill>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1 }}>
              <BrandGuess item={item} onChange={onChange} />
              <TextField size="small" label="Brand" value={item.brand} onChange={(e) => onChange({ brand: e.target.value })} />
              <TextField size="small" label="Model" value={item.model} onChange={(e) => onChange({ model: e.target.value })} />
              <TextField
                size="small"
                label="MAC"
                value={item.mac}
                onChange={(e) => onChange({ mac: e.target.value })}
                placeholder="ไม่มีเว้นว่างได้"
                sx={{ gridColumn: "1 / -1" }}
                slotProps={{ htmlInput: { style: { fontFamily: fontMono } } }}
              />
              <Box sx={{ gridColumn: "1 / -1" }}>
                <SitePicker
                  size="small"
                  label="ติดตั้งที่ (สถานที่)"
                  value={item.site_name}
                  onChange={({ site_id, site_name }) => onChange({ site_id, site_name })}
                  helperText="ไม่บังคับ · ใส่ไว้จะได้รู้ว่าติดตั้งที่ไหน"
                />
              </Box>
              {item.site_name?.trim() && (
                <>
                  <TextField size="small" label="ตำแหน่ง" value={item.location} onChange={(e) => onChange({ location: e.target.value })} placeholder="เช่น ตึก 7 ชั้น 2" />
                  <TextField size="small" label="งาน" value={item.job_name} onChange={(e) => onChange({ job_name: e.target.value })} placeholder={UNRECORDED_JOB} />
                </>
              )}
            </Box>
          </>
        )}
      </Box>
      <TextField
        size="small"
        label="อาการเสีย"
        value={item.symptom}
        onChange={(e) => onChange({ symptom: e.target.value })}
        multiline
        maxRows={3}
        sx={{ gridColumn: { xs: "1 / -1", md: "auto" }, gridRow: { xs: 2, md: "auto" } }}
      />
      <IconButton aria-label={`เอา ${item.serial} ออกจากรายการ`} onClick={onRemove} sx={{ gridColumn: { xs: 2, md: "auto" }, gridRow: { xs: 1, md: "auto" } }}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

export default function NewClaimForm() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const inputRef = useRef(null);

  const [items, setItems] = useState([]);
  const [code, setCode] = useState("");
  const [looking, setLooking] = useState(false);
  const [notice, setNotice] = useState(null); // { severity, text }
  const [choices, setChoices] = useState(null); // several devices share a serial: pick one
  const [vendors, setVendors] = useState([]);
  const [form, setForm] = useState({ sent_on: today(), vendor: "", ticket_no: "", note: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const addDevice = (d) => {
    setChoices(null);
    if (d.status === "claim") return setNotice({ severity: "warning", text: `${d.serial} มีเคลมที่ยังไม่กลับอยู่แล้ว` });
    if (d.status === "replaced") return setNotice({ severity: "warning", text: `${d.serial} ถูกแทนด้วยตัวใหม่แล้ว ส่งเคลมตัวใหม่แทน` });
    setItems((prev) => {
      if (prev.some((i) => i.device?.id === d.id)) {
        setNotice({ severity: "info", text: `${d.serial} อยู่ในรายการแล้ว` });
        return prev;
      }
      setNotice({ severity: "success", text: `เพิ่ม ${d.serial} แล้ว` });
      return [...prev, { key: `d${d.id}`, device: d, serial: d.serial, symptom: "" }];
    });
  };

  // Look up an exact serial/MAC and add it (or ask which one if several match)
  // raw: typed text or the scanned value; label: the scanner's { serial, mac } if scanned
  const addCode = async (raw, label) => {
    const value = (label?.serial || raw || "").trim();
    if (!value && !label?.mac) return;
    setCode("");
    setLooking(true);
    setNotice(null);
    try {
      let devices = [];
      for (const v of [value, label?.mac].filter(Boolean)) {
        const res = await fetch(`/api/devices/lookup?serial=${encodeURIComponent(v)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        devices = data.devices ?? [];
        if (devices.length > 0) break;
      }
      if (devices.length === 1) addDevice(devices[0]);
      else if (devices.length > 1) setChoices(devices);
      else {
        setItems((prev) => {
          if (prev.some((i) => !i.device && norm(i.serial) === norm(value))) return prev;
          const last = [...prev].reverse().find((i) => !i.device);
          return [
            ...prev,
            {
              key: `n${Date.now()}`,
              device: null,
              serial: macDigits(value) ?? (value || label.mac),
              mac: label?.mac || (macDigits(value) ? macDigits(value).match(/.{2}/g).join(":") : ""),
              brand: BRAND_NAMES[label?.brand] ?? "",
              model: label?.model ?? "",
              symptom: "",
              // Claims sent together usually come from the same place
              site_id: last?.site_id ?? null,
              site_name: last?.site_name ?? "",
              job_name: last?.job_name ?? "",
              location: "",
            },
          ];
        });
        setNotice({ severity: "info", text: `${value || label.mac} ไม่มีในระบบ · เพิ่มในรายการแล้ว ใส่สถานที่ที่ติดตั้งได้` });
      }
    } catch (err) {
      setNotice({ severity: "error", text: err.message || "ค้นหาไม่สำเร็จ" });
    } finally {
      setLooking(false);
      inputRef.current?.focus();
    }
  };

  // ?device=ID from a device page's "ส่งเคลม" button; vendor suggestions
  useEffect(() => {
    const id = params.get("device");
    if (id) {
      fetch(`/api/devices/lookup?id=${encodeURIComponent(id)}`)
        .then((r) => r.json())
        .then(({ devices }) => devices?.[0] && addDevice(devices[0]))
        .catch(() => {});
    }
    fetch("/api/claims/vendors")
      .then((r) => r.json())
      .then(({ vendors }) => setVendors(vendors ?? []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on open
  }, []);

  const update = (key, patch) => setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const remove = (key) => setItems((prev) => prev.filter((i) => i.key !== key));

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          items: items.map((i) =>
            i.device
              ? { device_id: i.device.id, symptom: i.symptom }
              : {
                  serial: i.serial, mac: i.mac, brand: i.brand, model: i.model, symptom: i.symptom,
                  site_id: i.site_id, site_name: i.site_name, job_name: i.job_name, location: i.location,
                }
          ),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(`ส่งเคลม ${data.count} รายการแล้ว`);
      router.push("/claims");
      router.refresh();
    } catch (err) {
      setError(err.message || "บันทึกไม่สำเร็จ");
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: "เคลม", href: "/claims" }, { label: "ส่งเคลม" }]}
        title="ส่งเคลม"
        subtitle="เพิ่มอุปกรณ์ทีละตัวด้วย serial หรือสแกน · ข้อมูลศูนย์/วันที่ใช้ร่วมกันทั้งรายการ"
      />

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
        <Card sx={{ p: 2.25, display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Box
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              addCode(code);
            }}
            sx={{ display: "flex", gap: 1 }}
          >
            <TextField
              inputRef={inputRef}
              autoFocus
              fullWidth
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="พิมพ์ serial หรือ MAC แล้วกด Enter"
              slotProps={{
                htmlInput: { "aria-label": "serial หรือ MAC", style: { fontFamily: fontMono }, autoCapitalize: "characters", autoCorrect: "off", spellCheck: false },
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      {looking ? <CircularProgress size={20} /> : <ScanButton onScan={addCode} />}
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Button type="submit" variant="outlined" startIcon={<AddOutlined />} disabled={!code.trim() || looking} sx={{ flexShrink: 0 }}>
              เพิ่ม
            </Button>
          </Box>
          {notice && (
            <Alert severity={notice.severity} onClose={() => setNotice(null)} sx={{ py: 0 }}>
              {notice.text}
            </Alert>
          )}
        </Card>

        {items.length > 0 && (
          <Card>
            <Box sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: "divider", display: "flex", alignItems: "center" }}>
              <Typography variant="h2">รายการ ({items.length})</Typography>
            </Box>
            {items.map((i) => (
              <ItemRow key={i.key} item={i} onChange={(patch) => update(i.key, patch)} onRemove={() => remove(i.key)} />
            ))}
          </Card>
        )}

        <Card sx={{ p: 2.25, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "160px minmax(0, 1.4fr) minmax(0, 1fr)" }, gap: 2 }}>
          <TextField
            label="วันที่ส่ง"
            type="date"
            required
            value={form.sent_on}
            onChange={(e) => setForm((f) => ({ ...f, sent_on: e.target.value }))}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <Autocomplete
            freeSolo
            options={vendors}
            inputValue={form.vendor}
            onInputChange={(_, v) => setForm((f) => ({ ...f, vendor: v }))}
            renderInput={(p) => <TextField {...p} label="ศูนย์ที่ส่ง" placeholder="เช่น ศูนย์ Hikvision เชียงใหม่" />}
          />
          <TextField label="เลขใบเคลม / RMA" value={form.ticket_no} onChange={(e) => setForm((f) => ({ ...f, ticket_no: e.target.value }))} />
          <TextField
            label="หมายเหตุ"
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            multiline
            minRows={1}
            sx={{ gridColumn: "1 / -1" }}
          />
        </Card>

        {error && <Alert severity="error">{error}</Alert>}

        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5 }}>
          <Button variant="outlined" onClick={() => router.push("/claims")} disabled={saving}>
            ยกเลิก
          </Button>
          <Button variant="contained" onClick={save} disabled={saving || items.length === 0 || !form.sent_on} sx={{ minWidth: 170 }}>
            {saving ? "กำลังบันทึก…" : `ส่งเคลม ${items.length} รายการ`}
          </Button>
        </Box>
      </Box>

      {/* Several devices share this serial/MAC (old data): let the user pick */}
      <Dialog open={!!choices} onClose={() => setChoices(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 600 }}>พบหลายตัวที่ตรงกัน เลือกตัวที่จะส่งเคลม</DialogTitle>
        {choices?.map((d) => (
          <Box
            key={d.id}
            component="button"
            type="button"
            onClick={() => addDevice(d)}
            sx={{ display: "flex", alignItems: "center", gap: 2, px: 3, py: 1.5, border: 0, borderTop: 1, borderColor: "divider", bgcolor: "transparent", color: "text.primary", font: "inherit", textAlign: "left", cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontFamily: fontMono, fontSize: 13 }}>{d.serial}</Typography>
              <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
                {[d.place, d.location].filter(Boolean).join(" · ")}
              </Typography>
            </Box>
            <StatusBadge status={d.status} />
          </Box>
        ))}
      </Dialog>
    </>
  );
}
