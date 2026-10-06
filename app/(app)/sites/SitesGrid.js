"use client";
import { useState } from "react";
import NextLink from "next/link";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import InputAdornment from "@mui/material/InputAdornment";
import FilterListIcon from "@mui/icons-material/FilterList";
import { Pill } from "@/components/StatusBadge";

export default function SitesGrid({ sites }) {
  const [filter, setFilter] = useState("");
  const f = filter.trim().toLowerCase();
  const shown = f ? sites.filter((s) => s.name.toLowerCase().includes(f)) : sites;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <TextField
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="กรองชื่อสถานที่"
        size="small"
        sx={{ maxWidth: 320 }}
        slotProps={{
          htmlInput: { "aria-label": "กรองชื่อสถานที่" },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <FilterListIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />

      {shown.length === 0 && (
        <Typography sx={{ color: "text.secondary", py: 4, textAlign: "center" }}>
          ไม่พบสถานที่ที่ชื่อมี “{filter.trim()}”
        </Typography>
      )}

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 1.75 }}>
        {shown.map((s) => (
          <Box
            key={s.id}
            component={NextLink}
            href={`/sites/${s.id}`}
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 0.5,
              p: 2.25,
              border: 1,
              borderColor: "divider",
              borderRadius: 2.5,
              bgcolor: "background.paper",
              color: "text.primary",
              textDecoration: "none",
              transition: "border-color .15s, transform .15s",
              "&:hover": { borderColor: "primary.main" },
              "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
            }}
          >
            <Typography sx={{ fontWeight: 600, fontSize: 15 }}>{s.name}</Typography>
            <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
              {s.job_count} งาน · {s.device_count.toLocaleString("th-TH")} อุปกรณ์
              {s.quoted_total !== null && s.quoted_total !== undefined ? ` · ตามใบ ${Math.round(s.quoted_total).toLocaleString("th-TH")} บาท` : ""}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
              <Typography sx={{ fontSize: 12, color: "text.secondary" }}>ส่งงานล่าสุด {s.last_text}</Typography>
              {s.open_claims > 0 && (
                <Pill color="warning" sx={{ ml: "auto" }}>
                  เคลม {s.open_claims}
                </Pill>
              )}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
