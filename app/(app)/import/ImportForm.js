"use client";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Collapse from "@mui/material/Collapse";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import LinearProgress from "@mui/material/LinearProgress";
import CircularProgress from "@mui/material/CircularProgress";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import UploadFileOutlined from "@mui/icons-material/UploadFileOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutlineOutlined";
import ExpandMore from "@mui/icons-material/ExpandMore";
import InsertDriveFileOutlined from "@mui/icons-material/InsertDriveFileOutlined";
import PageHeader from "@/components/PageHeader";
import { Pill } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { oneLine } from "@/components/EditDialog";
import { FIELDS, looksLikeExponent, parseInventory } from "@/lib/parseInventory";
import { fontMono } from "@/lib/fonts";

const norm = (s) => String(s ?? "").trim().toLowerCase();
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Editable preview columns (the rest of FIELDS are kept and saved as-is)
const COLUMNS = [
  { field: "device_type", label: "ประเภท", width: 120 },
  { field: "brand", label: "Brand", width: 110 },
  { field: "model", label: "Model", width: 170, multiline: true },
  { field: "serial", label: "Serial", width: 170, mono: true },
  { field: "mac", label: "MAC", width: 160, mono: true },
  { field: "location", label: "ตำแหน่ง", width: 200, multiline: true },
  { field: "note", label: "หมายเหตุ", width: 200, multiline: true },
];

// What to do with a row whose serial already exists
const DUP_ACTIONS = {
  merge: "ย้ายเข้างานนี้และอัปเดต",
  ref: "อยู่ที่เดิม · รวมในรายงานนี้",
  skip: "ข้าม ไม่บันทึก",
  new: "เพิ่มเป็นตัวใหม่",
};

function DupSelect({ value, index, onEdit }) {
  return (
    <Box
      component="select"
      value={value}
      onChange={(e) => onEdit(index, "_dup", e.target.value)}
      aria-label={`แถว ${index + 1} ซ้ำกับของเดิม: เลือกวิธีจัดการ`}
      sx={{
        mt: 0.5,
        width: "100%",
        font: "inherit",
        fontSize: 12,
        py: 0.4,
        px: 0.5,
        borderRadius: 1,
        border: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        color: "text.primary",
      }}
    >
      {Object.entries(DUP_ACTIONS).map(([v, label]) => (
        <option key={v} value={v}>{label}</option>
      ))}
    </Box>
  );
}

function issueColor(level) {
  return level === "warn" ? "warning.main" : level ? "text.secondary" : "success.main";
}

function Cell({ value, field, mono, multiline, index, onEdit }) {
  return (
    <InputBase
      value={value}
      onChange={(e) => onEdit(index, field, e.target.value)}
      multiline={multiline}
      fullWidth
      slotProps={{ input: { "aria-label": `${field} แถว ${index + 1}` } }}
      sx={{
        fontSize: 13,
        fontFamily: mono ? fontMono : undefined,
        px: 0.75,
        py: 0.25,
        borderRadius: 1,
        "&:hover": { bgcolor: "action.hover" },
        "&.Mui-focused": { bgcolor: "background.paper", boxShadow: "0 0 0 2px rgba(var(--mui-palette-primary-mainChannel) / 0.5)" },
      }}
    />
  );
}

// Memoized so typing in one row doesn't re-render the others
// issueLevel/issueText are plain strings so unchanged rows compare equal
const PreviewRow = memo(function PreviewRow({ row, index, issueLevel, issueText, dupAction, onEdit, onDelete }) {
  return (
    <TableRow
      sx={{
        ...(issueLevel === "warn" && { bgcolor: "rgba(var(--mui-palette-warning-mainChannel) / 0.08)" }),
        ...(dupAction === "skip" && { "& td > .MuiInputBase-root": { opacity: 0.45 } }),
      }}
    >
      <TableCell sx={{ color: "text.secondary", fontSize: 12, verticalAlign: "top", pt: 1.5 }}>{index + 1}</TableCell>
      {COLUMNS.map((c) => (
        <TableCell key={c.field} sx={{ px: 0.75, py: 0.75, verticalAlign: "top" }}>
          <Cell value={row[c.field]} field={c.field} mono={c.mono} multiline={c.multiline} index={index} onEdit={onEdit} />
        </TableCell>
      ))}
      <TableCell sx={{ fontSize: 12, verticalAlign: "top", pt: 1.5, color: issueColor(issueLevel) }}>
        {issueText || "พร้อม"}
        {dupAction && <DupSelect value={dupAction} index={index} onEdit={onEdit} />}
      </TableCell>
      <TableCell sx={{ verticalAlign: "top", py: 0.5 }}>
        <Tooltip title="ลบแถวนี้">
          <IconButton size="small" aria-label={`ลบแถว ${index + 1}`} onClick={() => onDelete(index)}>
            <DeleteOutline fontSize="small" />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
});

// Phone version of a preview row: fields stacked in a card
const PreviewCard = memo(function PreviewCard({ row, index, issueLevel, issueText, dupAction, onEdit, onDelete }) {
  return (
    <Box
      sx={{
        p: 1.5,
        border: 1,
        borderColor: issueLevel === "warn" ? "warning.main" : "divider",
        borderRadius: 2.5,
        bgcolor: "background.paper",
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>#{index + 1}</Typography>
        <Typography sx={{ fontSize: 12, flex: 1, color: issueColor(issueLevel) }}>
          {issueText || "พร้อม"}
        </Typography>
        <IconButton size="small" aria-label={`ลบแถว ${index + 1}`} onClick={() => onDelete(index)}>
          <DeleteOutline fontSize="small" />
        </IconButton>
      </Box>
      {dupAction && <DupSelect value={dupAction} index={index} onEdit={onEdit} />}
      {COLUMNS.map((c) => (
        <Box key={c.field} sx={{ display: "grid", gridTemplateColumns: "72px minmax(0, 1fr)", alignItems: "center", gap: 1 }}>
          <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{c.label}</Typography>
          <Cell value={row[c.field]} field={c.field} mono={c.mono} multiline={c.multiline} index={index} onEdit={onEdit} />
        </Box>
      ))}
    </Box>
  );
});

export default function ImportForm() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const fileInput = useRef(null);

  const [sites, setSites] = useState([]);
  const [siteInput, setSiteInput] = useState("");
  const [siteId, setSiteId] = useState(null);
  const [jobName, setJobName] = useState("");
  const [deliveredOn, setDeliveredOn] = useState(today);
  const [poNumber, setPoNumber] = useState("");
  const [note, setNote] = useState("");
  const [showMore, setShowMore] = useState(false);

  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);
  const [existing, setExisting] = useState({});
  const [parsing, setParsing] = useState("");   // name of the file being read
  const [checkedKey, setCheckedKey] = useState(null); // serial list the duplicate check finished for
  const [dragging, setDragging] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Site list for the picker; preselect ?site=ID from a site page
  useEffect(() => {
    fetch("/api/sites")
      .then((r) => r.json())
      .then(({ sites }) => {
        setSites(sites ?? []);
        const pre = sites?.find((s) => String(s.id) === params.get("site"));
        if (pre) {
          setSiteId(pre.id);
          setSiteInput(pre.name);
        }
      })
      .catch(() => {});
  }, [params]);

  // Dropping a file outside the drop zone would make the browser open it
  useEffect(() => {
    const stop = (e) => e.preventDefault();
    window.addEventListener("dragover", stop);
    window.addEventListener("drop", stop);
    return () => {
      window.removeEventListener("dragover", stop);
      window.removeEventListener("drop", stop);
    };
  }, []);

  const matchedSite = useMemo(
    () => (siteId ? sites.find((s) => s.id === siteId) : sites.find((s) => norm(s.name) === norm(siteInput))),
    [sites, siteId, siteInput]
  );

  const loadFile = async (file) => {
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setError("รองรับเฉพาะไฟล์ Excel (.xlsx, .xls)");
      return;
    }
    setError("");
    setParsing(file.name);
    try {
      const { siteName, rows: parsed } = await parseInventory(file);
      if (parsed.length === 0) throw new Error("ไม่พบแถวข้อมูลในไฟล์นี้");
      setFileName(file.name);
      setRows(parsed.map((r, i) => ({ ...r, _key: i })));
      setExisting({});
      setPage(0);
      setOnlyIssues(false);
      if (!siteInput && !siteId && siteName) setSiteInput(siteName);
    } catch (err) {
      setError(err.message || "อ่านไฟล์ไม่สำเร็จ");
    } finally {
      setParsing("");
    }
  };

  // Check serials against the database (debounced, re-runs after serial edits)
  const serialList = useMemo(() => rows.map((r) => norm(r.serial)).filter(Boolean), [rows]);
  const serialKey = serialList.join("\n");
  useEffect(() => {
    if (!serialKey) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/import/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serials: serialKey.split("\n") }),
          signal: ctrl.signal,
        });
        const { existing: found = [] } = await res.json();
        const map = {};
        found.forEach((d) => {
          (map[norm(d.serial)] ??= []).push(d);
        });
        setExisting(map);
        setCheckedKey(serialKey);
      } catch (err) {
        // A failed check only hides the warnings; saving still works
        if (err.name !== "AbortError") setCheckedKey(serialKey);
      }
    }, 500);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [serialKey]);

  // Saving waits for the check, otherwise duplicates would be saved as new devices
  const checking = !!serialKey && checkedKey !== serialKey;

  // What saving does with a row whose serial exists. Unless chosen by hand: same site
  // and same location means it stayed put (ref), otherwise it was moved here (merge).
  const dupActionOf = useCallback(
    (r) => {
      const match = existing[norm(r.serial)];
      if (!match) return null;
      if (r._dup) return r._dup;
      const d = match[0];
      const sameSite = matchedSite ? d.site_id === matchedSite.id : norm(d.site_name) === norm(siteInput);
      return sameSite && norm(r.location) && norm(r.location) === norm(d.location) ? "ref" : "merge";
    },
    [existing, matchedSite, siteInput]
  );

  const issues = useMemo(() => {
    const counts = {};
    serialList.forEach((k) => (counts[k] = (counts[k] ?? 0) + 1));
    return rows.map((r) => {
      const k = norm(r.serial);
      if (!k) return { level: "warn", kind: "noSerial", text: "ไม่มี serial" };
      if (looksLikeExponent(r.serial)) return { level: "warn", kind: "badSerial", text: "serial ถูก Excel ย่อเป็นเลขยกกำลัง แก้ให้ถูกก่อน" };
      if (existing[k]) {
        const d = existing[k][0];
        const shared = d.shared_in?.length ? ` · ใช้ร่วมกับ ${d.shared_in.join(", ")}` : "";
        const where = `${d.place}${shared}${existing[k].length > 1 ? ` (มี ${existing[k].length} ตัว ใช้ตัวแรก)` : ""}`;
        const action = dupActionOf(r);
        if (counts[k] > 1 && action === "merge") return { level: "warn", kind: "dupDb", text: `serial ซ้ำในไฟล์ด้วย · ${where}` };
        if (action === "merge") return { level: "info", kind: "dupDb", text: `ย้ายจาก ${where}` };
        if (action === "ref") return { level: "info", kind: "dupDb", text: `ใช้ร่วมกัน · ติดตั้งที่ ${where}` };
        if (action === "skip") return { level: "info", kind: "dupDb", text: `ข้าม · มีอยู่ที่ ${where}` };
        return { level: "warn", kind: "dupDb", text: `ซ้ำกับ ${where} · จะเพิ่มเป็นตัวใหม่` };
      }
      if (counts[k] > 1) return { level: "warn", kind: "dupFile", text: "serial ซ้ำในไฟล์" };
      if (!r.mac) return { level: "info", kind: "noMac", text: "ไม่มี MAC (บันทึกได้)" };
      return null;
    });
  }, [rows, existing, serialList, dupActionOf]);

  const summary = useMemo(() => {
    // merge/skip/new: what saving will do with each row
    const s = { warn: 0, dupDb: 0, dupFile: 0, noSerial: 0, badSerial: 0, noMac: 0, merge: 0, ref: 0, skip: 0, new: 0, dupNew: 0 };
    issues.forEach((i, index) => {
      if (i) {
        s[i.kind] += 1;
        if (i.level === "warn") s.warn += 1;
      }
      const action = i?.kind === "dupDb" ? dupActionOf(rows[index]) : "new";
      s[action] += 1;
      if (i?.kind === "dupDb" && action === "new") s.dupNew += 1;
    });
    return s;
  }, [issues, rows, dupActionOf]);

  // Apply one action to every row that matches an existing device
  const setAllDup = (action) => {
    setRows((prev) => prev.map((r) => (existing[norm(r.serial)] ? { ...r, _dup: action } : r)));
  };
  const allDupAction =
    ["merge", "ref", "skip"].find((a) => summary[a] === summary.dupDb) ?? (summary.dupNew === summary.dupDb ? "new" : null);

  const onEdit = useCallback((index, field, value) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  const onDelete = useCallback((index) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const reset = () => {
    setRows([]);
    setFileName("");
    setExisting({});
    setError("");
    if (fileInput.current) fileInput.current.value = "";
  };

  // Rows to show: all, or only those with warnings; keeps each row's real index
  const visible = useMemo(() => {
    const all = rows.map((row, index) => ({ row, index }));
    return onlyIssues ? all.filter(({ index }) => issues[index]?.level === "warn") : all;
  }, [rows, issues, onlyIssues]);
  const pageCount = Math.max(1, Math.ceil(visible.length / rowsPerPage));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = visible.slice(safePage * rowsPerPage, (safePage + 1) * rowsPerPage);

  const toSave = rows.length - summary.skip;
  const canSave = toSave > 0 && jobName.trim() && (siteId || siteInput.trim()) && !saving && !checking;

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_id: matchedSite?.id ?? null,
          site_name: siteInput,
          job: { name: jobName, delivered_on: deliveredOn, po_number: poNumber, note },
          devices: rows.flatMap((r) => {
            const match = existing[norm(r.serial)];
            const action = match ? dupActionOf(r) : "new";
            if (action === "skip") return [];
            if (action === "ref") return [{ ref_device_id: match[0].id }];
            const device = Object.fromEntries(FIELDS.map((f) => [f, r[f]]));
            return [action === "merge" ? { ...device, merge_device_id: match[0].id } : device];
          }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(
        `บันทึกเข้า “${jobName.trim()}” แล้ว · เพิ่มใหม่ ${data.inserted}` +
          (data.merged ? ` · ย้ายและอัปเดต ${data.merged}` : "") +
          (data.moved ? ` (ย้ายจากงานอื่น ${data.moved} จดประวัติไว้แล้ว)` : "") +
          (data.referenced ? ` · อยู่ที่เดิมรวมในรายงาน ${data.referenced}` : "") +
          (data.removed_jobs ? ` · ลบงานเดิมที่ว่าง ${data.removed_jobs}` : "")
      );
      router.push(`/jobs/${data.job_id}`);
      router.refresh();
    } catch (err) {
      setError(err.message || "บันทึกไม่สำเร็จ");
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Import Inventory" subtitle="1 ไฟล์รายงาน = 1 งาน · เลือกสถานที่ ใส่ชื่องาน แล้ววางไฟล์" />

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
        <Card sx={{ p: 2.5 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "minmax(0, 1.4fr) minmax(0, 1.2fr) minmax(0, 0.8fr)" }, gap: 2 }}>
            <Box>
              <Autocomplete
                freeSolo
                options={sites}
                getOptionLabel={(o) => (typeof o === "string" ? o : o.name)}
                inputValue={siteInput}
                onInputChange={(_, value, reason) => {
                  if (reason === "reset" && !value) return;
                  setSiteInput(value);
                  setSiteId(null);
                }}
                onChange={(_, value) => {
                  if (value && typeof value === "object") {
                    setSiteId(value.id);
                    setSiteInput(value.name);
                  }
                }}
                renderOption={(props, o) => {
                  const { key, ...rest } = props;
                  return (
                    <li key={key} {...rest}>
                      <Box sx={{ display: "flex", width: "100%", gap: 1 }}>
                        <span>{o.name}</span>
                        <Typography component="span" sx={{ ml: "auto", fontSize: 12, color: "text.secondary" }}>
                          {o.job_count} งาน
                        </Typography>
                      </Box>
                    </li>
                  );
                }}
                renderInput={(p) => <TextField {...p} label="สถานที่" required placeholder="เลือกหรือพิมพ์ชื่อใหม่" />}
              />
              {siteInput.trim() && (
                <Typography sx={{ fontSize: 12, mt: 0.75, color: matchedSite ? "success.main" : "text.secondary" }}>
                  {matchedSite ? `สถานที่เดิม · มีอยู่ ${matchedSite.job_count} งาน` : "จะสร้างเป็นสถานที่ใหม่"}
                </Typography>
              )}
            </Box>
            <TextField
              label="ชื่องาน"
              required
              value={jobName}
              onChange={(e) => setJobName(oneLine(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              multiline
              maxRows={5}
              placeholder="เช่น กล้อง CCTV, AP WiFi"
            />
            <TextField label="วันส่งงาน" type="date" value={deliveredOn} onChange={(e) => setDeliveredOn(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          </Box>

          <Button size="small" onClick={() => setShowMore((v) => !v)} endIcon={<ExpandMore sx={{ transform: showMore ? "rotate(180deg)" : "none", transition: "transform .2s" }} />} sx={{ mt: 1.5, color: "text.secondary" }}>
            ข้อมูลเพิ่มเติม (ไม่บังคับ)
          </Button>
          <Collapse in={showMore}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 1fr) minmax(0, 2fr)" }, gap: 2, pt: 1.5 }}>
              <TextField label="เลข PO" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
              <TextField label="หมายเหตุงาน" value={note} onChange={(e) => setNote(e.target.value)} />
            </Box>
          </Collapse>
        </Card>

        {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}

        {rows.length === 0 ? (
          <Box
            component="label"
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
              loadFile(e.dataTransfer.files[0]);
            }}
            sx={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1,
              py: 7,
              px: 2,
              textAlign: "center",
              border: "1.5px dashed",
              borderColor: dragging ? "primary.main" : "divider",
              borderRadius: 3,
              bgcolor: dragging ? "rgba(var(--mui-palette-primary-mainChannel) / 0.06)" : "background.paper",
              cursor: "pointer",
              transition: "border-color .15s, background-color .15s",
              "&:hover": { borderColor: "primary.main" },
              "&:focus-within": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
            }}
          >
            {parsing ? (
              <>
                <CircularProgress size={34} />
                <Typography sx={{ fontWeight: 600 }} role="status">กำลังอ่านไฟล์…</Typography>
                <Typography sx={{ fontSize: 13, color: "text.secondary", overflowWrap: "anywhere" }}>{parsing}</Typography>
              </>
            ) : (
              <>
                <UploadFileOutlined sx={{ fontSize: 36, color: dragging ? "primary.main" : "text.secondary" }} />
                <Typography sx={{ fontWeight: 600 }}>{dragging ? "ปล่อยไฟล์ตรงนี้" : "ลากไฟล์ Excel มาวาง หรือกดเพื่อเลือกไฟล์"}</Typography>
                <Typography sx={{ fontSize: 13, color: "text.secondary" }}>.xlsx, .xls · ชื่อสถานที่ในไฟล์จะถูกเติมให้อัตโนมัติ</Typography>
              </>
            )}
            <input
              ref={fileInput}
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => loadFile(e.target.files[0])}
              disabled={!!parsing}
              style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden" }}
            />
            {parsing && <LinearProgress sx={{ position: "absolute", left: 0, right: 0, bottom: 0, borderRadius: "0 0 12px 12px" }} />}
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
              <InsertDriveFileOutlined fontSize="small" sx={{ color: "text.secondary" }} />
              <Typography sx={{ fontWeight: 600, mr: 0.5, overflowWrap: "anywhere" }}>{fileName}</Typography>
              <Pill color="primary">{rows.length} แถว</Pill>
              {summary.dupDb > 0 && <Pill color="primary">ซ้ำกับของเดิม {summary.dupDb}</Pill>}
              {summary.dupFile > 0 && <Pill color="warning">ซ้ำในไฟล์ {summary.dupFile}</Pill>}
              {summary.noSerial > 0 && <Pill color="warning">ไม่มี serial {summary.noSerial}</Pill>}
              {summary.badSerial > 0 && <Pill color="error">serial เสีย {summary.badSerial}</Pill>}
              {summary.noMac > 0 && <Pill color="neutral">ไม่มี MAC {summary.noMac}</Pill>}
              <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1 }}>
                {summary.warn > 0 && (
                  <FormControlLabel
                    control={<Switch size="small" checked={onlyIssues} onChange={(e) => { setOnlyIssues(e.target.checked); setPage(0); }} />}
                    label={<Typography sx={{ fontSize: 13 }}>เฉพาะแถวที่ควรตรวจ</Typography>}
                  />
                )}
                <Button size="small" onClick={reset}>เปลี่ยนไฟล์</Button>
              </Box>
            </Box>

            {(checking || saving) && (
              <Alert severity="info" icon={<CircularProgress size={18} />} role="status" sx={{ alignItems: "center" }}>
                {saving
                  ? `กำลังบันทึก ${toSave} รายการ… อย่าเพิ่งปิดหน้านี้`
                  : "กำลังตรวจ serial กับข้อมูลในระบบ… ผลแถวซ้ำจะขึ้นเมื่อเสร็จ"}
                <LinearProgress sx={{ mt: 1, borderRadius: 1 }} />
              </Alert>
            )}

            <Box sx={{ display: { xs: "flex", md: "none" }, flexDirection: "column", gap: 1 }}>
              {pageRows.map(({ row, index }) => (
                <PreviewCard key={row._key} row={row} index={index} issueLevel={issues[index]?.level} issueText={issues[index]?.text} dupAction={issues[index]?.kind === "dupDb" ? dupActionOf(row) : undefined} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </Box>

            {summary.dupDb > 0 && (
              <Alert severity="info" sx={{ alignItems: "center", "& .MuiAlert-message": { width: "100%" } }}>
                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
                  <Typography sx={{ fontSize: 14, mr: "auto" }}>
                    {summary.dupDb} แถวมี serial ตรงกับอุปกรณ์ที่มีอยู่แล้ว · เลือกทีละแถวในคอลัมน์ “ตรวจ” หรือใช้กับทั้งหมด
                  </Typography>
                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={allDupAction}
                    onChange={(_, v) => v && setAllDup(v)}
                    aria-label="จัดการแถวซ้ำทั้งหมด"
                    sx={{ flexWrap: "wrap", bgcolor: "background.paper", "& .MuiToggleButton-root": { textTransform: "none", px: 1.25, py: 0.4, fontSize: 13, borderColor: "divider" } }}
                  >
                    {Object.entries(DUP_ACTIONS).map(([v, label]) => (
                      <ToggleButton key={v} value={v}>{label}</ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </Box>
              </Alert>
            )}

            <Card sx={{ display: { xs: visible.length > 25 ? "block" : "none", md: "block" }, "& .MuiTableContainer-root": { display: { xs: "none", md: "block" } } }}>
              <TableContainer sx={{ maxHeight: "65vh" }}>
                <Table stickyHeader size="small" sx={{ tableLayout: "fixed", minWidth: 1380 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 44 }}>#</TableCell>
                      {COLUMNS.map((c) => (
                        <TableCell key={c.field} sx={{ width: c.width }}>{c.label}</TableCell>
                      ))}
                      <TableCell sx={{ width: 190 }}>ตรวจ</TableCell>
                      <TableCell sx={{ width: 52 }} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pageRows.map(({ row, index }) => (
                      <PreviewRow key={row._key} row={row} index={index} issueLevel={issues[index]?.level} issueText={issues[index]?.text} dupAction={issues[index]?.kind === "dupDb" ? dupActionOf(row) : undefined} onEdit={onEdit} onDelete={onDelete} />
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {visible.length > 25 && (
                <TablePagination
                  component="div"
                  count={visible.length}
                  page={safePage}
                  onPageChange={(_, p) => setPage(p)}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setPage(0);
                  }}
                  rowsPerPageOptions={[25, 50, 100]}
                  labelRowsPerPage="ต่อหน้า"
                  labelDisplayedRows={({ from, to, count }) => `${from}–${to} จาก ${count}`}
                  sx={{ borderTop: 1, borderColor: "divider" }}
                />
              )}
            </Card>

            <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
              แก้ข้อมูลในตารางได้เลย · หมายเหตุมาจากคอลัมน์ Remark ในไฟล์ · ชื่ออุปกรณ์และ IP จากไฟล์ถูกบันทึกด้วย
            </Typography>

            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: 1.5, mt: 1 }}>
              {summary.warn > 0 && (
                <Typography sx={{ fontSize: 13, color: "warning.main", mr: "auto" }}>
                  มี {summary.warn} แถวที่ควรตรวจ · บันทึกได้ แต่ตรวจก่อนดีกว่า
                </Typography>
              )}
              {!jobName.trim() && <Typography sx={{ fontSize: 13, color: "text.secondary" }}>ใส่ชื่องานก่อนบันทึก</Typography>}
              <Button variant="outlined" onClick={reset} disabled={saving}>ยกเลิก</Button>
              <Button variant="contained" onClick={save} disabled={!canSave} sx={{ minWidth: 160 }}>
                {saving
                  ? "กำลังบันทึก…"
                  : checking
                    ? "กำลังตรวจ…"
                  : summary.merge + summary.ref > 0
                    ? `บันทึก (ใหม่ ${summary.new}${summary.merge ? ` · ย้าย ${summary.merge}` : ""}${summary.ref ? ` · อยู่ที่เดิม ${summary.ref}` : ""})`
                    : `บันทึก ${toSave} รายการ`}
              </Button>
            </Box>
          </Box>
        )}
      </Box>
    </>
  );
}
