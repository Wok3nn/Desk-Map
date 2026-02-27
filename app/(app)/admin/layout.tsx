import { ReactNode } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getEntraSettings, isUserInGroup } from "@/lib/entra";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const config = await prisma.entraConfig.findFirst();
  const requiresSignIn = Boolean(config?.adminGroupId) || config?.authMode === "entra" || config?.authMode === "viewer-group";

  if (!requiresSignIn) return <>{children}</>;

  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    redirect("/api/auth/login?next=/admin");
  }

  if (config?.adminGroupId) {
    const settings = await getEntraSettings();
    if (!settings) {
      return (
        <div className="mx-auto max-w-lg rounded-xl border border-border/60 bg-card p-6">
          <h2 className="text-lg font-semibold">Entra Config Incomplete</h2>
          <p className="mt-2 text-sm text-muted-foreground">Tenant ID, Client ID, and Client Secret are required for admin group checks.</p>
        </div>
      );
    }
    const allowed = await isUserInGroup(session.oid, config.adminGroupId, settings).catch(() => false);
    if (!allowed) {
      return (
        <div className="mx-auto max-w-lg rounded-xl border border-border/60 bg-card p-6">
          <h2 className="text-lg font-semibold">Admin Access Denied</h2>
          <p className="mt-2 text-sm text-muted-foreground">Your account is not in the configured admin group.</p>
          <Link href="/api/auth/login?next=/admin" className="mt-4 inline-block text-sm underline">Sign in with another account</Link>
        </div>
      );
    }
  }

  return <>{children}</>;
}
