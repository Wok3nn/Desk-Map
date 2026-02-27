import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const map = await prisma.mapConfig.findFirst({ orderBy: { createdAt: "asc" } });
  const desks = map ? await prisma.desk.findMany({ where: { mapId: map.id }, orderBy: { number: "asc" } }) : [];
  const entraConfig = await prisma.entraConfig.findFirst();
  const users = await prisma.userCache.findMany();

  return NextResponse.json({
    version: 1,
    exportedAt: new Date().toISOString(),
    map,
    desks,
    entraConfig,
    users
  });
}
