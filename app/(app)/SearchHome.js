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
import { fontMono } from "@/lib/fonts";

export default function SearchHome({ stats }) {
  const [q, setQ] = useState("");
  const { text, results, loading } = useDeviceSearch(q);
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      <Box>
        <Typography variant="h1">ค้นหาอุปกรณ์</Typography>
        <Typography sx={{ color: "text.secondary", mt: 0.5 }}>
          จาก {stats.devices.toLocaleString("th-TH")} อุปกรณ์ · พิมพ์ serial, MAC หรือรุ่น บางส่วนก็ได้
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
          onChange={(e) => setQ(e.target.value)}
          placeholder="เช่น FX4417 หรือ 240F9B"
          slotProps={{ input: { "aria-label": "ค้นหา serial, MAC หรือรุ่น" } }}
          sx={{ minHeight: 56, fontSize: 17, fontFamily: fontMono }}
        />
        {loading && <LinearProgress sx={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2 }} />}
      </Box>

      {results && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
            {results.length === 0
              ? loading ? "กำลังค้นหา…" : `ไม่พบอุปกรณ์ที่ตรงกับ “${text}”`
              : results.length >= 50
                ? "แสดง 50 รายการแรก พิมพ์เพิ่มเพื่อให้แคบลง"
                : `พบ ${results.length} รายการ`}
          </Typography>
          {results.length > 0 && (
            <Card>
              {results.map((d) => (
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
                      {[d.site_name, d.job_name, d.location].filter(Boolean).join(" · ")}
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
