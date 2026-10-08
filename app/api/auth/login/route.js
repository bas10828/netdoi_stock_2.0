import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

// Failed logins: at most 10 per 15 minutes per client IP and per username
// (in memory; resets on restart). The username limit holds even when the IP is faked.
const failures = new Map();
const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;

function blocked(key) {
  const rec = failures.get(key);
  return !!rec && Date.now() < rec.resetAt && rec.count >= MAX_FAILURES;
}

function recordFailure(key) {
  const now = Date.now();
  const rec = failures.get(key);
  if (!rec || now > rec.resetAt) failures.set(key, { count: 1, resetAt: now + WINDOW_MS });
  else rec.count += 1;
  if (failures.size > 10000) {
    for (const [k, r] of failures) if (now > r.resetAt) failures.delete(k);
  }
}

// Through the tunnel Cloudflare sets cf-connecting-ip itself, so it can't be faked.
// Direct (LAN) requests: Next fills x-forwarded-for with the socket address unless the
// client sent one, so it can be faked there; the per-username limit still applies.
function clientIp(request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown"
  );
}

// Compared against when the username doesn't exist, so both cases take as long (no username probing)
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const login = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  if (!login || !password) {
    return NextResponse.json({ error: "กรอกชื่อผู้ใช้และรหัสผ่าน" }, { status: 400 });
  }

  const ip = clientIp(request);
  const ipKey = `ip:${ip}`;
  const userKey = `user:${login.toLowerCase()}`;
  if (blocked(ipKey) || blocked(userKey)) {
    return NextResponse.json({ error: "ลองหลายครั้งเกินไป รอ 15 นาทีแล้วลองใหม่" }, { status: 429 });
  }

  const [user] = await query(
    `SELECT id, username, role, password FROM users
      WHERE lower(username) = lower($1) OR lower(email) = lower($1)
      LIMIT 1`,
    [login]
  );
  const ok = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
  if (!user || !ok) {
    recordFailure(ipKey);
    recordFailure(userKey);
    return NextResponse.json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  failures.delete(ipKey);
  failures.delete(userKey);
  // Always a fresh token, never one the browser already had
  const token = await createSession(user.id, { ip, userAgent: request.headers.get("user-agent") });
  const res = NextResponse.json({ username: user.username, role: user.role });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(request));
  return res;
}
