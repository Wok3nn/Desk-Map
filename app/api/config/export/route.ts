import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const map = await prisma.mapConfig.findFirst({ orderBy: { createdAt: "asc" } });
  const desks = map ? await prisma.desk.findMany({ where: { mapId: map.id }, orderBy: { number: "asc" } }) : [];
  const entraConfig = await prisma.entraConfig.findFirst();
  const users = await prisma.userCache.findMany();
  let backgroundFile: { filename: string; contentType: string; dataBase64: string } | null = null;

  if (map?.backgroundUrl && map.backgroundUrl.startsWith("/api/map/file/")) {
    try {
      const filename = decodeURIComponent(map.backgroundUrl.replace("/api/map/file/", ""));
      const basename = path.basename(filename);
      const filePath = path.join(process.cwd(), "data", "uploads", basename);
      const bytes = await readFile(filePath);
      const lower = basename.toLowerCase();
      const contentType = lower.endsWith(".svg")
        ? "image/svg+xml"
        : lower.endsWith(".png")
          ? "image/png"
          : lower.endsWith(".jpg") || lower.endsWith(".jpeg")
            ? "image/jpeg"
            : "application/octet-stream";
      backgroundFile = {
        filename: basename,
        contentType,
        dataBase64: bytes.toString("base64")
      };
    } catch {
      backgroundFile = null;
    }
  }

  return NextResponse.json({
    version: 1,
    exportedAt: new Date().toISOString(),
    map,
    backgroundFile,
    desks,
    entraConfig,
    users
  });
}
