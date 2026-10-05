"use client";
import NextLink from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import HelpOutlineOutlined from "@mui/icons-material/HelpOutlineOutlined";
import StatusBadge from "./StatusBadge";
import { fontMono } from "@/lib/fonts";

// Answer to "is this scanned device in our system, and where?"
// scan: { label: { serial, mac }, devices: [...], by: "serial" | "mac" | null }
export default function ScanResult({ scan }) {
  const { label, devices, by } = scan;
  const found = devices.length > 0;
  return (
    <Box
      role="status"
      sx={{
        p: 2,
        borderRadius: 3,
        border: 1,
        borderColor: found ? "success.main" : "divider",
        bgcolor: found ? "rgba(var(--mui-palette-success-mainChannel) / 0.06)" : "background.paper",
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {found ? <CheckCircleOutlined sx={{ color: "success.main" }} /> : <HelpOutlineOutlined sx={{ color: "text.secondary" }} />}
        <Typography sx={{ fontWeight: 600 }}>
          {found
            ? `อยู่ในระบบ${devices.length > 1 ? ` ${devices.length} รายการ` : ""} · เจอจาก ${by === "mac" ? "MAC" : "S/N"}`
            : "ไม่มีในระบบ"}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
        สแกนได้ · S/N <Box component="span" sx={{ fontFamily: fontMono, color: "text.primary" }}>{label.serial || "—"}</Box> · MAC{" "}
        <Box component="span" sx={{ fontFamily: fontMono, color: "text.primary" }}>{label.mac || "—"}</Box>
      </Typography>

      {devices.map((d) => (
        <Box
          key={d.id}
          component={NextLink}
          href={`/devices/${d.id}`}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            p: 1.5,
            borderRadius: 2,
            bgcolor: "background.paper",
            border: 1,
            borderColor: "divider",
            color: "text.primary",
            textDecoration: "none",
            "&:hover": { borderColor: "primary.main" },
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontWeight: 600 }}>{d.place}</Typography>
            <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
              {[[d.brand, d.model].filter(Boolean).join(" "), d.location].filter(Boolean).join(" · ") || "—"}
            </Typography>
          </Box>
          <StatusBadge status={d.status} />
        </Box>
      ))}
    </Box>
  );
}
