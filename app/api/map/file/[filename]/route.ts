import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

function contentTypeFor(filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

export async function GET(_: Request, { params }: { params: { filename: string } }) {
  try {
    const decoded = decodeURIComponent(params.filename);
    const basename = path.basename(decoded);
    if (!basename || basename !== decoded) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const filePath = path.join(process.cwd(), "data", "uploads", basename);
    const data = await readFile(filePath);

    return new Response(data, {
      headers: {
        "Content-Type": contentTypeFor(basename),
        "Cache-Control": "public, max-age=300"
      }
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
