import AppShell from "@/components/AppShell";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({ children }) {
  const user = await requireUser();
  return <AppShell user={{ username: user.username, role: user.role }}>{children}</AppShell>;
}
