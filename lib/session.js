// Session token helpers. Kept free of next/headers so proxy.js can import it.
import { SignJWT, jwtVerify } from "jose";

// Distinct from v1's "token" cookie: both apps can run on the same host
export const SESSION_COOKIE = "nd2_session";
export const SESSION_MAX_AGE = 60 * 60 * 12; // 12 hours

function secret() {
  if (!process.env.JWT_SECRET) throw new Error("Missing environment variable: JWT_SECRET");
  return new TextEncoder().encode(process.env.JWT_SECRET);
}

export async function createSessionToken(user) {
  return new SignJWT({ id: user.id, username: user.username, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret());
}

// Returns the session payload, or null if the token is missing, expired or forged
export async function verifySessionToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload;
  } catch {
    return null;
  }
}
