"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import InputBase from "@mui/material/InputBase";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import SearchIcon from "@mui/icons-material/Search";
import StatusBadge, { Pill } from "./StatusBadge";
import useDeviceSearch from "./useDeviceSearch";
import ScanButton from "./ScanButton";
import findScanned from "./findScanned";
import { fontMono } from "@/lib/fonts";

// Search-as-you-type dialog for serial/MAC. Opened with Ctrl+K / ⌘K or the top bar button.
export default function CommandPalette({ open, onClose }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-label="ค้นหาอุปกรณ์"
      sx={{ "& .MuiDialog-container": { alignItems: "flex-start", pt: { xs: 2, sm: "12vh" } } }}
      slotProps={{ paper: { sx: { m: 2, width: "calc(100% - 32px)", overflow: "hidden" } } }}
    >
      <PaletteBody onClose={onClose} />
    </Dialog>
  );
}

function PaletteBody({ onClose }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef(null);
  const { text, results: found, loading } = useDeviceSearch(q, { limit: 8, delay: 150 });
  // One keyboard-navigable list: sites, then jobs, then devices
  const results = found
    ? [
        ...found.sites.map((x) => ({ key: `s${x.id}`, href: `/sites/${x.id}`, kind: "สถานที่", title: x.name, sub: `${x.job_count} งาน · ${x.device_count} อุปกรณ์` })),
        ...found.jobs.map((j) => ({ key: `j${j.id}`, href: `/jobs/${j.id}`, kind: "งาน", title: j.name, sub: j.site_name })),
        ...found.devices.map((d) => ({
          key: `d${d.id}`,
          href: `/devices/${d.id}`,
          title: d.serial || "—",
          mono: true,
          sub: `${[d.brand, d.model].filter(Boolean).join(" ")} · ${d.place}`,
          status: d.status,
        })),
      ]
    : [];

  const go = (item) => {
    onClose();
    router.push(item.href);
  };

  const move = (i) => {
    setActive(i);
    listRef.current?.querySelector(`[data-index="${i}"]`)?.scrollIntoView({ block: "nearest" });
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(Math.min(active + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(Math.max(active - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active]);
    }
  };

  return (
    <>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, px: 2, borderBottom: 1, borderColor: "divider" }}>
        <SearchIcon sx={{ color: "text.secondary" }} />
        <InputBase
          autoFocus
          fullWidth
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="serial, MAC, รุ่น หรือชื่อสถานที่/งาน"
          slotProps={{ input: { "aria-label": "ค้นหา serial หรือ MAC" } }}
          sx={{ minHeight: 56, fontSize: 16, fontFamily: fontMono }}
        />
        {loading && <CircularProgress size={18} />}
        <ScanButton
          edge={false}
          onScan={async (value, label) => {
            try {
              const { devices } = await findScanned(value, label);
              if (devices.length === 1) return go({ href: `/devices/${devices[0].id}` });
              setQ(devices[0]?.serial || label?.serial || label?.mac || value);
            } catch {
              setQ(label?.serial || value);
            }
            setActive(0);
          }}
        />
        <Box component="kbd" sx={kbdSx}>Esc</Box>
      </Box>

      <Box ref={listRef} role="listbox" sx={{ maxHeight: 380, overflowY: "auto" }}>
        {results.map((d, i) => (
          <Box
            key={d.key}
            component="button"
            type="button"
            role="option"
            aria-selected={i === active}
            data-index={i}
            onClick={() => go(d)}
            onMouseMove={() => setActive(i)}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              width: "100%",
              px: 2,
              py: 1.25,
              border: 0,
              borderBottom: 1,
              borderColor: "divider",
              bgcolor: i === active ? "action.hover" : "transparent",
              color: "text.primary",
              font: "inherit",
              textAlign: "left",
              cursor: "pointer",
              "&:last-child": { borderBottom: 0 },
            }}
          >
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography noWrap sx={{ fontSize: 14, fontWeight: 500, ...(d.mono && { fontFamily: fontMono }) }}>{d.title}</Typography>
              <Typography noWrap sx={{ fontSize: 13, color: "text.secondary" }}>{d.sub}</Typography>
            </Box>
            {d.status ? <StatusBadge status={d.status} /> : <Pill color="neutral">{d.kind}</Pill>}
          </Box>
        ))}
        {text && !loading && results.length === 0 && (
          <Typography sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
            ไม่พบอะไรที่ตรงกับ “{text}”
          </Typography>
        )}
        {!text && (
          <Typography sx={{ p: 3, textAlign: "center", color: "text.secondary", fontSize: 13 }}>
            ใช้ ↑ ↓ เลือก, Enter เปิด · ไม่ต้องพิมพ์ “:” ใน MAC
          </Typography>
        )}
      </Box>
    </>
  );
}

export const kbdSx = {
  fontFamily: fontMono,
  fontSize: 11,
  px: 0.75,
  py: 0.1,
  border: 1,
  borderColor: "divider",
  borderRadius: 1,
  color: "text.secondary",
  bgcolor: "action.hover",
  whiteSpace: "nowrap",
};
