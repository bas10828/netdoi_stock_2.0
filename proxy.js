import { NextResponse } from "next/server";
import { SESSION_COOKIE, getSessionUser } from "@/lib/session";

const PUBLIC_API = ["/api/auth/login"];
// Phones open these before logging in, to trust the dev HTTPS certificate
const PUBLIC_PAGES = ["/phone-setup", "/dev-ca.crt"];
const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

// Blocks writes started by another site (CSRF). Browsers send Sec-Fetch-Site on every
// request; older ones fall back to comparing Origin with the host the browser used.
// Requests with neither header come from non-browser clients, which don't hold our cookie.
function crossSite(request) {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site !== "same-origin";
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const hosts = [request.headers.get("host"), request.headers.get("x-forwarded-host")].filter(Boolean);
  try {
    return !hosts.includes(new URL(origin).host);
  } catch {
    return true;
  }
}

export async function proxy(request) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/api/") && !SAFE_METHODS.includes(request.method) && crossSite(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Full check against the sessions table on every request (pages, RSC navigations and API),
  // so a logged-out or expired session stops working at once
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = await getSessionUser(token);
  // Drop a cookie that no longer maps to a session
  const clearStale = (res) => {
    if (token && !user) res.cookies.delete(SESSION_COOKIE);
    return res;
  };

  if (pathname === "/login") {
    return user ? NextResponse.redirect(new URL("/", request.url)) : clearStale(NextResponse.next());
  }
  if (PUBLIC_API.includes(pathname) || PUBLIC_PAGES.includes(pathname)) return NextResponse.next();

  if (!user) {
    if (pathname.startsWith("/api/")) {
      return clearStale(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    }
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", pathname + search);
    return clearStale(NextResponse.redirect(login));
  }
  return NextResponse.next();
}

export const config = {
  // Everything except Next.js assets and files in public/
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|woff2?|wasm)$).*)"],
};
