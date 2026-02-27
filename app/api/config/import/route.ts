import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const map = payload.map;
    const desks = Array.isArray(payload.desks) ? payload.desks : [];
    const entraConfig = payload.entraConfig ?? null;
    const users = Array.isArray(payload.users) ? payload.users : [];

    if (!map) {
      return NextResponse.json({ error: "Invalid config: missing map" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.desk.deleteMany({});
      await tx.mapConfig.deleteMany({});
      await tx.entraConfig.deleteMany({});
      await tx.userCache.deleteMany({});

      const createdMap = await tx.mapConfig.create({
        data: {
          id: map.id,
          name: map.name,
          width: map.width,
          height: map.height,
          backgroundUrl: map.backgroundUrl ?? null,
          brandLogoUrl: map.brandLogoUrl ?? null,
          brandTitle: map.brandTitle ?? "DeskMap",
          brandSubtitle: map.brandSubtitle ?? "Premium seating intelligence",
          deskColor: map.deskColor ?? "#8764B8",
          deskTextColor: map.deskTextColor ?? "#334155",
          deskShape: map.deskShape ?? "rounded",
          labelPosition: map.labelPosition ?? "top-center",
          showName: map.showName ?? true,
          showNumber: map.showNumber ?? true,
          deskTextSize: map.deskTextSize ?? 14,
          deskVisibleWhenSearching: map.deskVisibleWhenSearching ?? false,
          gridSize: map.gridSize ?? 10,
          gridVisible: map.gridVisible ?? true
        }
      });

      if (desks.length > 0) {
        await tx.desk.createMany({
          data: desks.map((desk: any) => ({
            id: desk.id,
            number: desk.number,
            x: desk.x,
            y: desk.y,
            width: desk.width,
            height: desk.height,
            label: desk.label ?? null,
            occupantFirstName: desk.occupantFirstName ?? null,
            occupantLastName: desk.occupantLastName ?? null,
            mapId: createdMap.id
          }))
        });
      }

      if (entraConfig) {
        await tx.entraConfig.create({
          data: {
            tenantId: entraConfig.tenantId ?? null,
            clientId: entraConfig.clientId ?? null,
            clientSecretEnc: entraConfig.clientSecretEnc ?? null,
            scopes: entraConfig.scopes ?? null,
            syncIntervalMinutes: entraConfig.syncIntervalMinutes ?? 15,
            mappingPrefix: entraConfig.mappingPrefix ?? "Desk-",
            mappingRegex: entraConfig.mappingRegex ?? null,
            adminGroupId: entraConfig.adminGroupId ?? null,
            authMode: entraConfig.authMode ?? "public",
            lastTestAt: entraConfig.lastTestAt ?? null,
            lastSyncAt: entraConfig.lastSyncAt ?? null,
            lastSyncStatus: entraConfig.lastSyncStatus ?? null
          }
        });
      }

      if (users.length > 0) {
        await tx.userCache.createMany({
          data: users.map((user: any) => ({
            id: user.id,
            givenName: user.givenName ?? null,
            surname: user.surname ?? null,
            displayName: user.displayName ?? null,
            officeLocation: user.officeLocation ?? null,
            userPrincipalName: user.userPrincipalName ?? null,
            lastSync: user.lastSync ?? new Date()
          }))
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Import failed" }, { status: 500 });
  }
}
