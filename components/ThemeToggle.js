"use client";
import { useState } from "react";
import { useColorScheme } from "@mui/material/styles";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import Tooltip from "@mui/material/Tooltip";
import LightModeOutlined from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlined from "@mui/icons-material/DarkModeOutlined";
import SettingsBrightnessOutlined from "@mui/icons-material/SettingsBrightnessOutlined";
import Check from "@mui/icons-material/Check";

const OPTIONS = [
  { mode: "light", label: "สว่าง", icon: <LightModeOutlined fontSize="small" /> },
  { mode: "dark", label: "มืด", icon: <DarkModeOutlined fontSize="small" /> },
  { mode: "system", label: "ตามเครื่อง", icon: <SettingsBrightnessOutlined fontSize="small" /> },
];

export default function ThemeToggle() {
  const { mode, systemMode, setMode } = useColorScheme();
  const [anchor, setAnchor] = useState(null);
  // mode is undefined until mounted on the client
  const resolved = mode === "system" ? systemMode : mode;

  return (
    <>
      <Tooltip title="ธีม">
        <IconButton aria-label="เปลี่ยนธีม" onClick={(e) => setAnchor(e.currentTarget)} sx={{ border: 1, borderColor: "divider" }}>
          {resolved === "dark" ? <DarkModeOutlined fontSize="small" /> : <LightModeOutlined fontSize="small" />}
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {OPTIONS.map((o) => (
          <MenuItem
            key={o.mode}
            selected={mode === o.mode}
            onClick={() => {
              setMode(o.mode);
              setAnchor(null);
            }}
            sx={{ minWidth: 180, gap: 1 }}
          >
            <ListItemIcon>{o.icon}</ListItemIcon>
            {o.label}
            {mode === o.mode && <Check fontSize="small" sx={{ ml: "auto", color: "primary.main" }} />}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
