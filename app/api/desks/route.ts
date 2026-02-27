import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/realtime";

export const runtime = "nodejs";

const demoDesks = () => {
  const lastNames = ["Miller", "Nguyen", "Lopez", "Baker", "Patel", "Hughes", "Diaz", "Rossi", "Khan", "Brooks"];
  return Array.from({ length: 10 }).map((_, index) => {
    const number = index + 1;
    return {
      id: `demo-${number}`,
      number,
      x: 80 + (index % 5) * 180,
      y: 80 + Math.floor(index / 5) * 180,
      width: 10,
      height: 10,
      label: null,
      occupantFirstName: number % 2 === 0 ? "Alex" : "Jordan",
      occupantLastName: lastNames[index] ?? ""
    };
  });
};

async function ensureSeed() {
  return prisma.$transaction(async (tx) => {
    let map = await tx.mapConfig.findFirst({ orderBy: { createdAt: "asc" } });

    if (!map) {
      map = await tx.mapConfig.create({
        data: {
          name: "HQ Floor 1",
          width: 1200,
          height: 700,
          backgroundUrl: null,
          deskColor: "#8764B8",
          deskShape: "rounded",
          deskIcon: "none",
          labelPosition: "top-center",
          showName: true,
          showNumber: true,
          deskTextSize: 14,
          deskVisibleWhenSearching: false
        }
      });
    }

    const desksCount = await tx.desk.count({ where: { mapId: map.id } });

    if (desksCount === 0) {
      for (const desk of demoDesks()) {
        await tx.desk.upsert({
          where: { number: desk.number },
          update: {
            x: desk.x,
            y: desk.y,
            width: desk.width,
            height: desk.height,
            label: desk.label,
            occupantFirstName: desk.occupantFirstName,
            occupantLastName: desk.occupantLastName,
            mapId: map.id
          },
          create: {
            ...desk,
            mapId: map.id
          }
        });
      }
    } else {
      // Normalize old demo seed sizes from previous versions.
      await tx.desk.updateMany({
        where: { id: { startsWith: "demo-" }, OR: [{ width: { gt: 10 } }, { height: { gt: 10 } }] },
        data: { width: 10, height: 10 }
      });
      await tx.desk.updateMany({
        where: { id: { startsWith: "demo-" }, occupantLastName: { startsWith: "Team " } },
        data: { occupantLastName: null }
      });
    }

    return map;
  });
}

export async function GET() {
  const map = await ensureSeed();
  const desks = await prisma.desk.findMany({
    where: { mapId: map.id },
    orderBy: { number: "asc" }
  });

  return NextResponse.json({ map, desks });
}

export async function PUT(request: Request) {
  const map = await ensureSeed();
  const body = await request.json();
  const desks = Array.isArray(body.desks) ? body.desks : [];
  const mapStyle = body.mapStyle ?? null;

  const numbers = new Set<number>();
  for (const desk of desks) {
    if (numbers.has(desk.number)) {
      return NextResponse.json({ error: "Duplicate desk number" }, { status: 400 });
    }
    numbers.add(desk.number);
  }

  await prisma.$transaction(async (tx) => {
    if (mapStyle) {
      await tx.mapConfig.update({
        where: { id: map.id },
        data: {
          deskColor: typeof mapStyle.deskColor === "string" ? mapStyle.deskColor : undefined,
          deskShape: typeof mapStyle.deskShape === "string" ? mapStyle.deskShape : undefined,
          labelPosition: typeof mapStyle.labelPosition === "string" ? mapStyle.labelPosition : undefined,
          showName: typeof mapStyle.showName === "boolean" ? mapStyle.showName : undefined,
          showNumber: typeof mapStyle.showNumber === "boolean" ? mapStyle.showNumber : undefined,
          deskTextSize: typeof mapStyle.deskTextSize === "number" ? mapStyle.deskTextSize : undefined,
          deskVisibleWhenSearching:
            typeof mapStyle.deskVisibleWhenSearching === "boolean"
              ? mapStyle.deskVisibleWhenSearching
              : undefined,
          width: typeof mapStyle.width === "number" ? mapStyle.width : undefined,
          height: typeof mapStyle.height === "number" ? mapStyle.height : undefined
        }
      });
    }

    await tx.desk.deleteMany({});

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
          mapId: map.id
        }))
      });
    }
  });

  const updatedMap = await prisma.mapConfig.findUnique({ where: { id: map.id } });
  const updatedDesks = await prisma.desk.findMany({
    where: { mapId: map.id },
    orderBy: { number: "asc" }
  });

  broadcast("layout", { updatedAt: new Date().toISOString() });

  return NextResponse.json({ map: updatedMap ?? map, desks: updatedDesks });
}
