import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/realtime";
import { fetchGraphUsers, getEntraSettings, mapOfficeLocationToDesk } from "@/lib/entra";

export const runtime = "nodejs";

export async function POST() {
  const settings = await getEntraSettings();
  if (!settings) {
    return NextResponse.json({ ok: false, error: "Entra config is incomplete" }, { status: 400 });
  }

  try {
    const users = await fetchGraphUsers(settings);
    const map = await prisma.mapConfig.findFirst();
    if (!map) {
      return NextResponse.json({ ok: false, error: "Map not initialized" }, { status: 400 });
    }

    const desks = await prisma.desk.findMany({ where: { mapId: map.id } });
    const deskByNumber = new Map(desks.map((desk) => [desk.number, desk]));
    const assignedDeskIds = new Set<string>();

    const deskUpdates: { id: string; firstName: string; lastName: string }[] = [];

    for (const user of users) {
      const deskNumber = mapOfficeLocationToDesk(user.officeLocation, settings);
      if (!deskNumber) continue;
      const desk = deskByNumber.get(deskNumber);
      if (!desk || assignedDeskIds.has(desk.id)) continue;
      assignedDeskIds.add(desk.id);
      deskUpdates.push({
        id: desk.id,
        firstName: user.givenName || user.displayName || "",
        lastName: user.surname || ""
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.userCache.deleteMany();
      if (users.length > 0) {
        await tx.userCache.createMany({
          data: users.map((user) => ({
            id: user.id,
            givenName: user.givenName ?? null,
            surname: user.surname ?? null,
            displayName: user.displayName ?? null,
            officeLocation: user.officeLocation ?? null,
            userPrincipalName: user.userPrincipalName ?? null,
            lastSync: new Date()
          }))
        });
      }

      await tx.desk.updateMany({
        where: { mapId: map.id },
        data: { occupantFirstName: null, occupantLastName: null }
      });

      for (const update of deskUpdates) {
        await tx.desk.update({
          where: { id: update.id },
          data: { occupantFirstName: update.firstName, occupantLastName: update.lastName }
        });
      }

      await tx.entraConfig.updateMany({
        data: { lastSyncAt: new Date(), lastSyncStatus: `Synced ${users.length} users` }
      });
    });

    broadcast("layout", { updatedAt: new Date().toISOString() });

    return NextResponse.json({ ok: true, users: users.length, desksUpdated: deskUpdates.length });
  } catch (error) {
    await prisma.entraConfig.updateMany({
      data: { lastSyncAt: new Date(), lastSyncStatus: "Sync failed" }
    });
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
