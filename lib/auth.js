import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "./session";

// Current user from the session cookie, or null. Reading cookies also makes the page dynamic.
// Cached per request, so a layout and its page share one DB lookup.
export const getUser = cache(async () => {
  const store = await cookies();
  return getSessionUser(store.get(SESSION_COOKIE)?.value);
});

// For server pages: send anonymous visitors to the login page
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
