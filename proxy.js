import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

const PUBLIC_API = ["/api/auth/login"];
// Phones open these before logging in, to trust the dev HTTPS certificate
const PUBLIC_PAGES = ["/phone-setup", "/dev-ca.crt"];

export async function proxy(request) {
  const { pathname, search } = request.nextUrl;
  const user = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/login") {
    return user ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }
  if (PUBLIC_API.includes(pathname) || PUBLIC_PAGES.includes(pathname)) return NextResponse.next();

  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  // Everything except Next.js assets and files in public/
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|woff2?|wasm)$).*)"],
};
