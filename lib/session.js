// Database-backed login sessions. Kept free of next/headers so proxy.js can import it.
// The cookie holds a random 256-bit token; the sessions table stores only its SHA-256.
import { createHash, randomBytes } from "node:crypto";
import { query } from "./db";

// Distinct from v1's "token" cookie: both apps can run on the same host
export const SESSION_COOKIE = "nd2_session";

const DAY = 24 * 60 * 60;
const IDLE_DAYS = 30; // unused this long -> logged out
const MAX_DAYS = 90; // logged out this long after login, however often it's used
// The cookie lives as long as the longest possible session; the DB decides if it is still valid
export const SESSION_COOKIE_MAX_AGE = MAX_DAYS * DAY;
// Write last_seen/expires_at at most this often, not on every request
const TOUCH_AFTER_MS = 60 * 60 * 1000;

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/; // 32 bytes, base64url
const hashToken = (token) => createHash("sha256").update(token).digest("hex");

export function sessionCookieOptions(request) {
  return {
    httpOnly: true,
    sameSite: "lax",
    // Secure only over HTTPS (direct, or behind Cloudflare), so plain-HTTP LAN access still works
    secure: request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
  };
}

// New session for a user who just proved their password. Returns the cookie value.
export async function createSession(userId, { ip, userAgent } = {}) {
  const token = randomBytes(32).toString("base64url");
  // Housekeeping: drop expired sessions
  await query("DELETE FROM sessions WHERE expires_at < now()");
  await query(
    `INSERT INTO sessions (token_hash, user_id, expires_at, ip, user_agent)
     VALUES ($1, $2, now() + make_interval(days => $3), $4, $5)`,
    [hashToken(token), userId, IDLE_DAYS, ip ?? null, userAgent?.slice(0, 300) ?? null]
  );
  return token;
}

// The user behind a session cookie, or null if it is missing, unknown, expired or revoked.
// Username and role come from the users table, so changes apply immediately.
export async function getSessionUser(token) {
  if (!token || !TOKEN_RE.test(token)) return null;
  const tokenHash = hashToken(token);
  const [row] = await query(
    `SELECT u.id, u.username, u.role, s.last_seen_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [tokenHash]
  );
  if (!row) return null;
  if (Date.now() - new Date(row.last_seen_at).getTime() > TOUCH_AFTER_MS) {
    await query(
      `UPDATE sessions
          SET last_seen_at = now(),
              expires_at = least(now() + make_interval(days => $2), created_at + make_interval(days => $3))
        WHERE token_hash = $1`,
      [tokenHash, IDLE_DAYS, MAX_DAYS]
    );
  }
  return { id: row.id, username: row.username, role: row.role };
}

export async function deleteSession(token) {
  if (!token || !TOKEN_RE.test(token)) return;
  await query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
}

// "Log out everywhere": every device of this user, including the current one
export async function deleteUserSessions(userId) {
  await query("DELETE FROM sessions WHERE user_id = $1", [userId]);
}
