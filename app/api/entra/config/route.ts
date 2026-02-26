import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";

export const runtime = "nodejs";

export async function GET() {
  const config = await prisma.entraConfig.findFirst();
  return NextResponse.json({
    config: config
      ? {
          tenantId: config.tenantId,
          clientId: config.clientId,
          scopes: config.scopes,
          syncIntervalMinutes: config.syncIntervalMinutes,
          mappingPrefix: config.mappingPrefix,
          mappingRegex: config.mappingRegex,
          adminGroupId: config.adminGroupId,
          authMode: config.authMode,
          lastTestAt: config.lastTestAt,
          lastSyncAt: config.lastSyncAt,
          lastSyncStatus: config.lastSyncStatus
        }
      : null
  });
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const config = await prisma.entraConfig.findFirst();

    const parsedInterval =
      typeof body.syncIntervalMinutes === "number"
        ? body.syncIntervalMinutes
        : Number.parseInt(body.syncIntervalMinutes, 10);

    const data: any = {
      tenantId: body.tenantId ?? null,
      clientId: body.clientId ?? null,
      scopes: body.scopes ?? null,
      syncIntervalMinutes: Number.isFinite(parsedInterval) ? parsedInterval : 15,
      mappingPrefix: body.mappingPrefix ?? null,
      mappingRegex: body.mappingRegex ?? null,
      adminGroupId: body.adminGroupId ?? null,
      authMode: body.authMode ?? "public"
    };

    if (typeof body.clientSecret === "string" && body.clientSecret.length > 0) {
      data.clientSecretEnc = encryptSecret(body.clientSecret);
    }

    const saved = config
      ? await prisma.entraConfig.update({ where: { id: config.id }, data })
      : await prisma.entraConfig.create({ data });

    return NextResponse.json({
      config: {
        tenantId: saved.tenantId,
        clientId: saved.clientId,
        scopes: saved.scopes,
        syncIntervalMinutes: saved.syncIntervalMinutes,
        mappingPrefix: saved.mappingPrefix,
        mappingRegex: saved.mappingRegex,
        adminGroupId: saved.adminGroupId,
        authMode: saved.authMode,
        lastTestAt: saved.lastTestAt,
        lastSyncAt: saved.lastSyncAt,
        lastSyncStatus: saved.lastSyncStatus
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save config" },
      { status: 500 }
    );
  }
}
