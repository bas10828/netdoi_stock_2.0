import { NextResponse } from "next/server";
import { getUser } from "./auth";

export function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

export function error(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// Wraps a route handler: requires a session (proxy.js checks too) and turns
// unexpected errors into a 500 without leaking details to the client.
export function handler(fn) {
  return async (request, context) => {
    const user = await getUser();
    if (!user) return error("Unauthorized", 401);
    try {
      return await fn(request, { ...context, user });
    } catch (err) {
      console.error(`[${request.method} ${request.nextUrl.pathname}]`, err);
      return error("เกิดข้อผิดพลาดที่ server", 500);
    }
  };
}

// Postgres unique_violation
export function isUniqueViolation(err) {
  return err?.code === "23505";
}
