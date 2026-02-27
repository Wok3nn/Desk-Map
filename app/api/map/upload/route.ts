import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/realtime";

export const runtime = "nodejs";

const SUPPORTED = new Set(["image/svg+xml", "image/png", "image/jpeg", "image/jpg"]);

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-");
}

async function ensureMap() {
  const map = await prisma.mapConfig.findFirst({ orderBy: { createdAt: "asc" } });
  if (map) return map;
  return prisma.mapConfig.create({
    data: {
      name: "HQ Floor 1",
      width: 1200,
      height: 700,
      backgroundUrl: null,
      deskColor: "#8764B8",
      deskShape: "rounded",
      deskIcon: "none",
      labelPosition: "inside",
      showName: true,
      showNumber: true,
      deskTextSize: 14,
      deskVisibleWhenSearching: false
    }
  });
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!SUPPORTED.has(file.type)) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), "data", "uploads");
    await mkdir(uploadDir, { recursive: true });

    const safeName = sanitizeFilename(file.name || "map");
    const filename = `${Date.now()}-${safeName}`;
    const outputPath = path.join(uploadDir, filename);

    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(outputPath, bytes);

    const map = await ensureMap();
    const updated = await prisma.mapConfig.update({
      where: { id: map.id },
      data: {
        backgroundUrl: `/api/map/file/${encodeURIComponent(filename)}`
      }
    });

    broadcast("layout", { updatedAt: new Date().toISOString() });

    return NextResponse.json({
      ok: true,
      map: {
        id: updated.id,
        name: updated.name,
        width: updated.width,
        height: updated.height,
        backgroundUrl: updated.backgroundUrl,
        deskColor: updated.deskColor,
        deskShape: updated.deskShape,
        labelPosition: updated.labelPosition,
        showName: updated.showName,
        showNumber: updated.showNumber,
        deskTextSize: updated.deskTextSize,
        deskVisibleWhenSearching: updated.deskVisibleWhenSearching,
        updatedAt: updated.updatedAt
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
