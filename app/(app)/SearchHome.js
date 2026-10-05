"use client";
import { useState } from "react";
import NextLink from "next/link";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import InputBase from "@mui/material/InputBase";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import SearchIcon from "@mui/icons-material/Search";
import StatusBadge from "@/components/StatusBadge";
import useDeviceSearch from "@/components/useDeviceSearch";
import ScanButton from "@/components/ScanButton";
import ScanResult from "@/components/ScanResult";
import findScanned from "@/components/findScanned";
import { fontMono } from "@/lib/fonts";
import PlaceOutlined from "@mui/icons-material/PlaceOutlined";
import WorkOutlineOutlined from "@mui/icons-material/WorkOutlineOutlined";

const rowSx = {
  display: "flex",
  alignItems: "center",
  gap: 2,
  px: 2,
  py: 1.25,
  borderTop: 1,
  borderColor: "divider",
  color: "text.primary",
  textDecoration: "none",
  "&:first-of-type": { borderTop: 0 },
  "&:hover": { bgcolor: "action.hover" },
};

// Sites and jobs whose name matches, e.g. "เชียงแสนวิท"
function PlaceResults({ sites, jobs }) {
  if (sites.length === 0 && jobs.length === 0) return null;
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: sites.length && jobs.length ? "repeat(2, minmax(0, 1fr))" : "1fr" }, gap: 1.5 }}>
      {sites.length > 0 && (
        <Box>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: "text.secondary", mb: 0.5 }}>สถานที่</Typography>
          <Card>
            {sites.map((x) => (
              <Box key={x.id} component={NextLink} href={`/sites/${x.id}`} sx={rowSx}>
                <PlaceOutlined fontSize="small" sx={{ color: "text.secondary" }} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: 500 }}>{x.name}</Typography>
                  <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                    {x.job_count} งาน · {x.device_count.toLocaleString("th-TH")} อุปกรณ์
                  </Typography>
                </Box>
              </Box>
            ))}
          </Card>
        </Box>
      )}
      {jobs.length > 0 && (
        <Box>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: "text.secondary", mb: 0.5 }}>งาน</Typography>
          <Card>
            {jobs.map((j) => (
              <Box key={j.id} component={NextLink} href={`/jobs/${j.id}`} sx={rowSx}>
                <WorkOutlineOutlined fontSize="small" sx={{ color: "text.secondary" }} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: 500 }}>{j.name}</Typography>
                  <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                    {j.site_name} · {j.device_count} อุปกรณ์
                  </Typography>
                </Box>
              </Box>
            ))}
          </Card>
        </Box>
      )}
    </Box>
  );
}

export default function SearchHome({ stats, initialQuery = "" }) {
  const [q, setQ] = useState(initialQuery);
  const [scan, setScan] = useState(null); // answer for the last scan, until the box is edited
  const { text, results, loading } = useDeviceSearch(q);

  const onScan = async (value, label) => {
    const scanned = { serial: label?.serial || value, mac: label?.mac || "" };
    try {
      const { devices, by } = await findScanned(value, label);
      setScan({ label: scanned, devices, by });
      setQ(devices[0]?.serial || scanned.serial || scanned.mac);
    } catch {
      setScan(null);
      setQ(scanned.serial || scanned.mac);
    }
  };
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      <Box>
        <Typography variant="h1">ค้นหาอุปกรณ์</Typography>
        <Typography sx={{ color: "text.secondary", mt: 0.5 }}>
          จาก {stats.devices.toLocaleString("th-TH")} อุปกรณ์ · พิมพ์ serial, MAC, รุ่น หรือชื่อสถานที่/งาน บางส่วนก็ได้
        </Typography>
      </Box>

      <Box
        sx={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 2,
          border: 1,
          borderColor: "divider",
          borderRadius: 3,
          bgcolor: "background.paper",
          overflow: "hidden",
          "&:focus-within": { borderColor: "primary.main", boxShadow: "0 0 0 3px rgba(var(--mui-palette-primary-mainChannel) / 0.15)" },
        }}
      >
        <SearchIcon sx={{ color: "text.secondary" }} />
        <InputBase
          autoFocus
          fullWidth
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setScan(null);
          }}
          placeholder="serial, MAC, รุ่น, สถานที่ หรือกดสแกน ▸"
          slotProps={{ input: { "aria-label": "ค้นหา serial, MAC หรือรุ่น" } }}
          sx={{ minHeight: 56, fontSize: 17, fontFamily: fontMono }}
        />
        <ScanButton onScan={onScan} label="สแกน QR / barcode เพื่อเช็คว่าอยู่ในระบบไหม" />
        {loading && <LinearProgress sx={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2 }} />}
      </Box>

      {scan && <ScanResult scan={scan} />}

      {results && !scan && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <PlaceResults sites={results.sites} jobs={results.jobs} />
          <Typography sx={{ fontSize: 13, color: "text.secondary", mt: results.sites.length || results.jobs.length ? 1 : 0 }}>
            {results.devices.length === 0
              ? loading
                ? "กำลังค้นหา…"
                : results.sites.length || results.jobs.length
                  ? `ไม่พบอุปกรณ์ที่ serial/MAC/รุ่น/ตำแหน่งตรงกับ “${text}”`
                  : `ไม่พบอะไรที่ตรงกับ “${text}”`
              : results.devices.length >= 50
                ? "อุปกรณ์ · แสดง 50 รายการแรก พิมพ์เพิ่มเพื่อให้แคบลง"
                : `อุปกรณ์ · พบ ${results.devices.length} รายการ`}
          </Typography>
          {results.devices.length > 0 && (
            <Card>
              {results.devices.map((d) => (
                <Box
                  key={d.id}
                  component={NextLink}
                  href={`/devices/${d.id}`}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    px: 2,
                    py: 1.5,
                    borderTop: 1,
                    borderColor: "divider",
                    color: "text.primary",
                    textDecoration: "none",
                    "&:first-of-type": { borderTop: 0 },
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontWeight: 500 }} noWrap>
                      {[d.brand, d.model].filter(Boolean).join(" ") || d.device_type || "อุปกรณ์"}
                    </Typography>
                    <Typography noWrap sx={{ fontSize: 13, color: "text.secondary" }}>
                      {[d.place, d.location, d.shared_count > 0 && `ใช้ร่วมกับอีก ${d.shared_count} งาน`].filter(Boolean).join(" · ")}
                    </Typography>
                  </Box>
                  <Box sx={{ display: { xs: "none", sm: "flex" }, flexDirection: "column", alignItems: "flex-end" }}>
                    <Typography sx={{ fontFamily: fontMono, fontSize: 13 }}>{d.serial || "—"}</Typography>
                    <Typography sx={{ fontFamily: fontMono, fontSize: 13, color: "text.secondary" }}>{d.mac || "—"}</Typography>
                  </Box>
                  <StatusBadge status={d.status} />
                </Box>
              ))}
            </Card>
          )}
        </Box>
      )}
    </Box>
  );
}
