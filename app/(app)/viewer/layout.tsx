import { ReactNode } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getEntraSettings, isUserInGroup } from "@/lib/entra";

export default async function ViewerLayout({ children }: { children: ReactNode }) {
  const config = await prisma.entraConfig.findFirst();
  const authMode = config?.authMode ?? "public";
  if (authMode === "public") return <>{children}</>;

  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    redirect("/api/auth/login?next=/viewer");
  }

  if (authMode === "viewer-group") {
    if (!config?.viewerGroupId) {
      return (
        <div className="mx-auto max-w-lg rounded-xl border border-border/60 bg-card p-6">
          <h2 className="text-lg font-semibold">Viewer Access Not Configured</h2>
          <p className="mt-2 text-sm text-muted-foreground">Set `Viewer Group Object ID` in Admin settings for viewer-group mode.</p>
        </div>
      );
    }
    const settings = await getEntraSettings();
    if (!settings) {
      return (
        <div className="mx-auto max-w-lg rounded-xl border border-border/60 bg-card p-6">
          <h2 className="text-lg font-semibold">Entra Config Incomplete</h2>
          <p className="mt-2 text-sm text-muted-foreground">Tenant ID, Client ID, and Client Secret are required for group access checks.</p>
        </div>
      );
    }
    const allowed = await isUserInGroup(session.oid, config.viewerGroupId, settings).catch(() => false);
    if (!allowed) {
      return (
        <div className="mx-auto max-w-lg rounded-xl border border-border/60 bg-card p-6">
          <h2 className="text-lg font-semibold">Access Denied</h2>
          <p className="mt-2 text-sm text-muted-foreground">Your account is not in the required viewer group.</p>
          <Link href="/api/auth/login?next=/viewer" className="mt-4 inline-block text-sm underline">Sign in with another account</Link>
        </div>
      );
    }
  }

  return <>{children}</>;
}
