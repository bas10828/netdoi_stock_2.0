"use client";
import { useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Visibility from "@mui/icons-material/VisibilityOutlined";
import VisibilityOff from "@mui/icons-material/VisibilityOffOutlined";
import ThemeToggle from "@/components/ThemeToggle";
import { TextLink } from "@/components/Links";

// true once React has hydrated; before that a submit would be a plain form GET
const subscribe = () => () => {};
function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const hydrated = useHydrated();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Only follow same-site relative paths ("//x" and "/\x" would leave the site)
      const next = params.get("next");
      router.replace(next && /^\/(?![/\\])/.test(next) ? next : "/");
      router.refresh();
    } catch (err) {
      setError(err.message || "เข้าสู่ระบบไม่สำเร็จ");
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", bgcolor: "background.default", px: 2, position: "relative" }}>
      <Box sx={{ position: "absolute", top: 16, right: 16 }}>
        <ThemeToggle />
      </Box>
      <Box
        component="form"
        method="post"
        onSubmit={submit}
        sx={{
          width: "100%",
          maxWidth: 380,
          display: "flex",
          flexDirection: "column",
          gap: 2.25,
          p: { xs: 3, sm: 4 },
          border: 1,
          borderColor: "divider",
          borderRadius: 3,
          bgcolor: "background.paper",
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5, mb: 1 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: "text.primary", color: "background.paper", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 20 }}>
            N
          </Box>
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="h1" sx={{ fontSize: "1.35rem" }}>
              netdoi stock
            </Typography>
            <Typography sx={{ color: "text.secondary" }}>เข้าสู่ระบบเพื่อใช้งาน</Typography>
          </Box>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        <TextField
          label="ชื่อผู้ใช้หรืออีเมล"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoFocus
          required
          fullWidth
        />
        <TextField
          label="รหัสผ่าน"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          fullWidth
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                    onClick={() => setShowPassword((v) => !v)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
        <Button type="submit" variant="contained" size="large" disabled={loading || !hydrated} sx={{ minHeight: 44 }}>
          {!hydrated ? "กำลังโหลด…" : loading ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
        </Button>
        <Typography sx={{ fontSize: 12, color: "text.secondary", textAlign: "center" }}>
          ใช้มือถือสแกน barcode?{" "}
          <TextLink href="/phone-setup">ตั้งค่ากล้องสแกน</TextLink>
        </Typography>
      </Box>
    </Box>
  );
}
