# Deploy netdoi_stock 2.0 บน server

เป้าหมาย: **https://netdoi-stock.22422522.xyz** → Cloudflare Tunnel → server `192.168.233.200` พอร์ต `3100` → container `netdoi_stock_v2`

- ระบบเก่า (v1) ไม่ต้องแตะ ทำงานคู่กันได้ (v1 ใช้พอร์ต 3000 / 3001)
- DB ใช้ `netdoi_v2` ที่มีอยู่แล้ว (role `netdoi_stock`) ไม่ต้องสร้างอะไรเพิ่มใน PostgreSQL
- ไม่ต้องลง Node.js บน server ทุกอย่างอยู่ใน Docker

---

## ครั้งแรก

### 1. ดึงโค้ด

```bash
cd /home/bas10828
git clone https://github.com/bas10828/netdoi_stock_2.0.git
cd netdoi_stock_2.0
```

repo เป็น private: ใช้ credential เดียวกับที่ server ใช้ `git pull` ระบบเก่า (Personal Access Token หรือ deploy key)

### 2. สร้าง `.env`

```bash
cp .env.example .env
nano .env
```

- `DATABASE_URL` — คัดลอกบรรทัดเดียวกันจากไฟล์ `.env` ในเครื่องที่ dev (`netdoi_stock_2.0/.env`) มาวางทั้งบรรทัด
- `JWT_SECRET` — สร้างใหม่สำหรับ server:
  ```bash
  openssl rand -base64 48
  ```
  (ใช้คนละค่ากับเครื่อง dev ได้ แค่ต้องคงที่ ถ้าเปลี่ยนทุกคนจะถูก logout)

```bash
chmod 600 .env
```

### 3. build และรัน

```bash
docker compose up -d --build
docker compose logs -f app        # ควรเห็น "Ready" · Ctrl+C เพื่อออกจาก log
```

ครั้งแรกใช้เวลาสักพัก (ติดตั้ง package + build) · server ต้องต่ออินเทอร์เน็ตได้ (โหลดฟอนต์ Google, SheetJS จาก cdn.sheetjs.com)

ตรวจในเครื่อง server:

```bash
curl -I http://localhost:3100/login      # ต้องได้ HTTP/1.1 200
docker compose exec app node scripts/migrate.mjs   # ต้องขึ้น "Schema applied"
```

คำสั่ง migrate ตรวจด้วยว่า container ต่อ DB ได้ (ปลอดภัย รันซ้ำได้ ไม่ลบข้อมูล)

### 4. ตั้ง Cloudflare Tunnel

Cloudflare Zero Trust → **Networks → Tunnels** → tunnel ที่ใช้อยู่ (ตัวเดียวกับระบบเก่า) → **Public Hostname** → แก้/เพิ่ม `netdoi-stock.22422522.xyz`:

| ช่อง | ค่า |
|---|---|
| Subdomain / Domain | `netdoi-stock` / `22422522.xyz` |
| Service Type | `HTTP` |
| URL | `192.168.233.200:3100` |

ถ้า container `cloudflared_tunnel` อยู่ใน docker network เดียวกับแอปและต่อ IP ของ host ไม่ได้ ให้ใช้ URL `netdoi_stock_v2:3000` แทน แล้วเพิ่มแอปเข้า network นั้น (ดู "แก้ปัญหา" ด้านล่าง)

### 5. ทดสอบ

เปิด **https://netdoi-stock.22422522.xyz** → login ด้วย user/รหัสเดิม → ลองค้นหา, เปิดหน้างาน, ปุ่มสแกนบนมือถือ (ผ่าน https ของ Cloudflare กล้องสดใช้ได้เลย ไม่ต้องตั้งค่ามือถือ)

---

## อัปเดตเวอร์ชันใหม่

```bash
cd /home/bas10828/netdoi_stock_2.0
git pull
docker compose up -d --build
docker compose exec app node scripts/migrate.mjs   # รันทุกครั้งได้ ถ้าไม่มีอะไรเปลี่ยนก็ไม่ทำอะไร
```

## คำสั่งที่ใช้บ่อย

```bash
docker compose ps                 # สถานะ
docker compose logs -f app        # ดู log / error
docker compose restart app        # restart
docker compose down               # หยุด (ข้อมูลอยู่ใน DB ไม่หาย)
```

---

## ข้อควรรู้

- **เครื่อง dev กับ server ใช้ DB เดียวกัน (`netdoi_v2`)** — แก้ข้อมูลตอนทดสอบบนเครื่อง dev จะเห็นบน server ทันที ถ้าต้องการแยก ภายหลังสร้าง DB สำหรับ dev แยกได้
- **cookie login** ตั้งเป็น Secure อัตโนมัติเมื่อเข้าผ่าน https ของ Cloudflare
- **หน้า `/phone-setup`** ไม่ต้องใช้บน server (ใบรับรองของ Cloudflare ถูกต้องอยู่แล้ว) ปุ่มดาวน์โหลดในหน้านั้นจะใช้ไม่ได้บน server ซึ่งถูกต้อง
- **backup**: ข้อมูลทั้งหมดอยู่ใน schema `stock` ของ `netdoi_v2` เช่น
  ```bash
  docker exec postgres_db pg_dump -U postgres -d netdoi_v2 -n stock -Fc > netdoi_v2_$(date +%F).dump
  ```

## แก้ปัญหา

| อาการ | ดู / แก้ |
|---|---|
| Cloudflare ขึ้น 502 / Bad gateway | `curl -I http://localhost:3100/login` บน server ได้ 200 ไหม · ถ้าได้ แปลว่า URL ใน Public Hostname ผิด หรือ cloudflared ต่อ `192.168.233.200:3100` ไม่ได้ |
| cloudflared อยู่ใน docker network ต่อ host ไม่ได้ | หา network: `docker inspect cloudflared_tunnel --format '{{json .NetworkSettings.Networks}}'` แล้วเพิ่มใน `docker-compose.yml` ของแอป: `networks: [<ชื่อ>]` + ด้านล่างไฟล์ `networks: { <ชื่อ>: { external: true } }` · ตั้ง Service URL เป็น `http://netdoi_stock_v2:3000` |
| หน้าเว็บขึ้น "เกิดข้อผิดพลาดที่ server" | `docker compose logs app` · ส่วนใหญ่คือ `DATABASE_URL` ผิด หรือ container ต่อ `192.168.233.200:5432` ไม่ได้ |
| login แล้วเด้งกลับหน้า login | `JWT_SECRET` ว่าง/ผิด ใน `.env` → แก้แล้ว `docker compose up -d` |
| build ล้มตอน `npm ci` / ฟอนต์ | server ออกอินเทอร์เน็ตไม่ได้ (cdn.sheetjs.com, fonts.googleapis.com) |
