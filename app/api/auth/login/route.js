import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";

// 10 attempts per 15 minutes per IP (in memory; resets on restart)
const attempts = new Map();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

function rateLimited(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now > rec.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_ATTEMPTS;
}

export async function POST(request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "ลองหลายครั้งเกินไป รอ 15 นาทีแล้วลองใหม่" }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const login = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  if (!login || !password) {
    return NextResponse.json({ error: "กรอกชื่อผู้ใช้และรหัสผ่าน" }, { status: 400 });
  }

  const [user] = await query(
    `SELECT id, username, role, password FROM users
      WHERE lower(username) = lower($1) OR lower(email) = lower($1)
      LIMIT 1`,
    [login]
  );
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return NextResponse.json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  attempts.delete(ip);
  const res = NextResponse.json({ username: user.username, role: user.role });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(user), {
    httpOnly: true,
    sameSite: "lax",
    // Secure only behind HTTPS (Cloudflare/nginx), so plain-HTTP LAN access still works
    secure: request.headers.get("x-forwarded-proto") === "https",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
