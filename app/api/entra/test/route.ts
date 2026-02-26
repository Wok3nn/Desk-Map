import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEntraSettings, fetchGraphUsers } from "@/lib/entra";

export const runtime = "nodejs";

export async function POST() {
  const settings = await getEntraSettings();
  if (!settings) {
    return NextResponse.json({ ok: false, error: "Entra config is incomplete" }, { status: 400 });
  }

  try {
    await fetchGraphUsers({ ...settings, scopes: settings.scopes }, 1);
    await prisma.entraConfig.updateMany({
      data: { lastTestAt: new Date() }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    await prisma.entraConfig.updateMany({
      data: { lastTestAt: new Date(), lastSyncStatus: "Test failed" }
    });
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
