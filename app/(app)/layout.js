import AppShell from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { getOpenClaimCount } from "@/lib/queries";

export default async function AppLayout({ children }) {
  const user = await requireUser();
  const openClaims = await getOpenClaimCount();
  return (
    <AppShell user={{ username: user.username, role: user.role }} openClaims={openClaims}>
      {children}
    </AppShell>
  );
}
