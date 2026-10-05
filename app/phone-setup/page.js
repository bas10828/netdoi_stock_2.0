import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import DownloadOutlined from "@mui/icons-material/DownloadOutlined";
import { TextLink } from "@/components/Links";

export const metadata = { title: "ตั้งค่ามือถือให้ใช้กล้องสแกน" };

function Steps({ title, steps }) {
  return (
    <Box component="section" sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Typography variant="h2">{title}</Typography>
      <Box component="ol" sx={{ m: 0, pl: 2.5, display: "flex", flexDirection: "column", gap: 0.75 }}>
        {steps.map((s, i) => (
          <Typography component="li" key={i}>
            {s}
          </Typography>
        ))}
      </Box>
    </Box>
  );
}

// Optional, for the dev server only: trust this machine's local CA so the
// browser allows the live camera. Without it the scanner's "take a photo" works.
export default function PhoneSetupPage() {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", px: 2, py: { xs: 3, sm: 6 } }}>
      <Box sx={{ maxWidth: 640, mx: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
        <Box>
          <Typography variant="h1">ตั้งค่ามือถือให้ใช้กล้องสแกนสด</Typography>
          <Typography sx={{ color: "text.secondary", mt: 0.5 }}>
            ไม่บังคับ · ถ้าไม่ตั้ง ใช้ปุ่ม “ถ่ายรูป barcode” ในหน้าสแกนได้เหมือนกัน · ทำครั้งเดียวต่อมือถือ 1 เครื่อง
          </Typography>
        </Box>

        <Alert severity="info">
          ใบรับรองนี้ใช้ได้เฉพาะเครื่องในวง LAN ของออฟฟิศ (และ localhost) เท่านั้น ถูกจำกัดไว้ไม่ให้รับรองเว็บอื่น ·
          ถ้าใช้ผ่านลิงก์ https:// ของ Cloudflare ไม่ต้องตั้งค่านี้
        </Alert>

        <Button variant="contained" size="large" href="/dev-ca.crt" download="netdoi-dev-ca.crt" startIcon={<DownloadOutlined />} sx={{ alignSelf: "flex-start" }}>
          ดาวน์โหลดใบรับรอง (netdoi-dev-ca.crt)
        </Button>

        <Steps
          title="Android (Chrome)"
          steps={[
            "กดปุ่มดาวน์โหลดด้านบน",
            "เปิด ตั้งค่า → ความปลอดภัยและความเป็นส่วนตัว → การตั้งค่าความปลอดภัยเพิ่มเติม → การเข้ารหัสและข้อมูลเข้าสู่ระบบ (ชื่อเมนูต่างกันเล็กน้อยตามยี่ห้อ)",
            "เลือก ติดตั้งใบรับรอง → ใบรับรอง CA → ติดตั้งต่อไป",
            "เลือกไฟล์ netdoi-dev-ca.crt จากโฟลเดอร์ดาวน์โหลด",
            "ปิด Chrome ให้หมดแล้วเปิดเว็บใหม่ กล้องสแกนสดจะใช้ได้",
          ]}
        />

        <Steps
          title="iPhone / iPad (Safari)"
          steps={[
            "เปิดหน้านี้ใน Safari แล้วกดปุ่มดาวน์โหลด → อนุญาต",
            "เปิด ตั้งค่า → ดาวน์โหลดโปรไฟล์แล้ว (ด้านบนสุด) → ติดตั้ง",
            "เปิด ตั้งค่า → ทั่วไป → เกี่ยวกับ → การตั้งค่าความเชื่อถือใบรับรอง",
            "เปิดสวิตช์ “netdoi stock dev CA” ให้เชื่อถือเต็มที่",
            "เปิดเว็บใหม่ กล้องสแกนสดจะใช้ได้",
          ]}
        />

        <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
          เลิกใช้: Android ลบได้ที่ “ข้อมูลเข้าสู่ระบบของผู้ใช้” · iPhone ลบที่ ตั้งค่า → ทั่วไป → VPN และการจัดการอุปกรณ์
        </Typography>

        <TextLink href="/">← กลับไปหน้าแรก</TextLink>
      </Box>
    </Box>
  );
}
