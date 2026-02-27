import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AUTH_STATE_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

function sanitizeNext(value: string | null) {
  if (!value || !value.startsWith("/")) return "/viewer";
  return value;
}

export async function GET(request: Request) {
  const config = await prisma.entraConfig.findFirst();
  if (!config?.tenantId || !config.clientId) {
    return NextResponse.json({ error: "Entra auth is not configured" }, { status: 400 });
  }

  const url = new URL(request.url);
  const next = sanitizeNext(url.searchParams.get("next"));
  const origin = url.origin;
  const state = crypto.randomBytes(24).toString("hex");
  const redirectUri = `${origin}/api/auth/callback`;
  const authorize = new URL(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize`);
  authorize.searchParams.set("client_id", config.clientId);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("response_mode", "query");
  authorize.searchParams.set("scope", "openid profile email User.Read");
  authorize.searchParams.set("state", state);

  const res = NextResponse.redirect(authorize.toString());
  res.cookies.set(AUTH_STATE_COOKIE, `${state}|${encodeURIComponent(next)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600
  });
  return res;
}
