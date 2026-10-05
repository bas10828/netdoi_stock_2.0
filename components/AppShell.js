"use client";
import { useEffect, useState } from "react";
import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
import SearchIcon from "@mui/icons-material/Search";
import PlaceOutlined from "@mui/icons-material/PlaceOutlined";
import UploadFileOutlined from "@mui/icons-material/UploadFileOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutOutlined from "@mui/icons-material/LogoutOutlined";
import CommandPalette, { kbdSx } from "./CommandPalette";
import ThemeToggle from "./ThemeToggle";

const SIDEBAR_WIDTH = 240;

const NAV = [
  { href: "/", label: "ค้นหา", icon: SearchIcon, match: (p) => p === "/" },
  { href: "/sites", label: "สถานที่", icon: PlaceOutlined, match: (p) => /^\/(sites|jobs|devices)/.test(p) },
  { href: "/import", label: "Import Inventory", icon: UploadFileOutlined, match: (p) => p.startsWith("/import") },
];

function Logo() {
  return (
    <Box component={NextLink} href="/" sx={{ display: "flex", alignItems: "center", gap: 1.25, textDecoration: "none", color: "text.primary" }}>
      <Box
        sx={{
          width: 30,
          height: 30,
          borderRadius: 2,
          bgcolor: "text.primary",
          color: "background.paper",
          display: "grid",
          placeItems: "center",
          fontWeight: 700,
          fontSize: 15,
        }}
      >
        N
      </Box>
      <Box sx={{ lineHeight: 1.2 }}>
        <Typography sx={{ fontWeight: 600, lineHeight: 1.2 }}>netdoi stock</Typography>
        <Typography sx={{ fontSize: 12, color: "text.secondary", lineHeight: 1.2 }}>2.0</Typography>
      </Box>
    </Box>
  );
}

function SidebarContent({ pathname, onNavigate }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3, p: 1.5, pt: 2.25, height: "100%" }}>
      <Box sx={{ px: 0.75 }}>
        <Logo />
      </Box>
      <Box component="nav" aria-label="เมนูหลัก" sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
        {NAV.map(({ href, label, icon: Icon, match }) => {
          const on = match(pathname);
          return (
            <Box
              key={href}
              component={NextLink}
              href={href}
              onClick={onNavigate}
              aria-current={on ? "page" : undefined}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                minHeight: 40,
                px: 1.5,
                borderRadius: 2,
                textDecoration: "none",
                fontWeight: 500,
                color: on ? "primary.main" : "text.secondary",
                bgcolor: on ? "rgba(var(--mui-palette-primary-mainChannel) / 0.1)" : "transparent",
                "&:hover": { bgcolor: on ? undefined : "action.hover", color: on ? undefined : "text.primary" },
              }}
            >
              <Icon fontSize="small" />
              {label}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export default function AppShell({ user, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(null);

  // Ctrl+K / ⌘K anywhere, or "/" when not typing in a field
  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const logout = async () => {
    setUserMenu(null);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      {/* Desktop sidebar */}
      <Box
        component="aside"
        sx={{
          display: { xs: "none", md: "block" },
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          borderRight: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        <SidebarContent pathname={pathname} />
      </Box>

      {/* Mobile sidebar */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{ display: { md: "none" } }}
        slotProps={{ paper: { sx: { width: SIDEBAR_WIDTH } } }}
      >
        <SidebarContent pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
      </Drawer>

      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <Box
          component="header"
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: { xs: 2, md: 4 },
            py: 1.25,
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <IconButton aria-label="เปิดเมนู" onClick={() => setDrawerOpen(true)} sx={{ display: { md: "none" } }}>
            <MenuIcon />
          </IconButton>
          <Box sx={{ display: { md: "none" } }}>
            <Logo />
          </Box>

          <Button
            variant="outlined"
            onClick={() => setPaletteOpen(true)}
            startIcon={<SearchIcon />}
            sx={{
              ml: "auto",
              minWidth: { xs: 0, sm: 260 },
              justifyContent: "flex-start",
              color: "text.secondary",
              fontWeight: 400,
              "& .label": { display: { xs: "none", sm: "inline" } },
            }}
            aria-label="ค้นหา serial หรือ MAC"
          >
            <span className="label">ค้นหา serial / MAC</span>
            <Box component="kbd" sx={{ ...kbdSx, ml: "auto", pl: 0.75, display: { xs: "none", sm: "inline" } }}>
              Ctrl K
            </Box>
          </Button>
          <ThemeToggle />
          <IconButton aria-label="บัญชีผู้ใช้" onClick={(e) => setUserMenu(e.currentTarget)} sx={{ p: 0.5 }}>
            <Avatar sx={{ width: 32, height: 32, fontSize: 14, fontWeight: 600, bgcolor: "rgba(var(--mui-palette-primary-mainChannel) / 0.14)", color: "primary.main" }}>
              {user.username.slice(0, 1).toUpperCase()}
            </Avatar>
          </IconButton>
          <Menu anchorEl={userMenu} open={!!userMenu} onClose={() => setUserMenu(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
            <Box sx={{ px: 2, py: 1, minWidth: 200 }}>
              <Typography sx={{ fontWeight: 600 }}>{user.username}</Typography>
              <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{user.role}</Typography>
            </Box>
            <MenuItem onClick={logout}>
              <ListItemIcon>
                <LogoutOutlined fontSize="small" />
              </ListItemIcon>
              ออกจากระบบ
            </MenuItem>
          </Menu>
        </Box>

        <Box component="main" sx={{ flex: 1, width: "100%", maxWidth: 1240, mx: "auto", px: { xs: 2, md: 4 }, pt: { xs: 2.5, md: 4 }, pb: 8 }}>
          {children}
        </Box>
      </Box>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </Box>
  );
}
