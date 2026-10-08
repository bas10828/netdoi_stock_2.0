import { NextResponse } from "next/server";
import { SESSION_COOKIE, deleteSession, deleteUserSessions, getSessionUser } from "@/lib/session";

// POST /api/auth/logout          -> this device
// POST /api/auth/logout?all=1    -> every device of this user
export async function POST(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (request.nextUrl.searchParams.get("all") === "1") {
    const user = await getSessionUser(token);
    if (user) await deleteUserSessions(user.id);
  } else {
    await deleteSession(token);
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
