import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "./session";

// Current user from the session cookie, or null. Reading cookies also makes the page dynamic.
export async function getUser() {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

// For server pages: send anonymous visitors to the login page
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
