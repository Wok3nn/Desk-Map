import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { AUTH_STATE_COOKIE, SESSION_COOKIE, createSessionToken } from "@/lib/auth";

export const runtime = "nodejs";

function decodeJwtPayload(idToken: string) {
  const parts = idToken.split(".");
  if (parts.length < 2) throw new Error("Invalid id_token");
  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stateCookie = request.cookies.get(AUTH_STATE_COOKIE)?.value;

  if (!code || !state || !stateCookie) {
    return NextResponse.json({ error: "Invalid auth callback" }, { status: 400 });
  }

  const [expectedState, encodedNext] = stateCookie.split("|");
  if (!expectedState || state !== expectedState) {
    return NextResponse.json({ error: "State mismatch" }, { status: 400 });
  }
  const next = encodedNext ? decodeURIComponent(encodedNext) : "/viewer";

  const config = await prisma.entraConfig.findFirst();
  if (!config?.tenantId || !config.clientId || !config.clientSecretEnc) {
    return NextResponse.json({ error: "Entra auth is not configured" }, { status: 400 });
  }

  const tokenEndpoint = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
  const redirectUri = `${url.origin}/api/auth/callback`;
  const params = new URLSearchParams();
  params.set("client_id", config.clientId);
  params.set("client_secret", decryptSecret(config.clientSecretEnc));
  params.set("grant_type", "authorization_code");
  params.set("code", code);
  params.set("redirect_uri", redirectUri);
  params.set("scope", "openid profile email User.Read");

  const tokenRes = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });
  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    return NextResponse.json({ error: `Token exchange failed: ${text}` }, { status: 400 });
  }

  const tokenPayload = await tokenRes.json();
  const idToken = tokenPayload.id_token as string | undefined;
  if (!idToken) {
    return NextResponse.json({ error: "Missing id_token" }, { status: 400 });
  }

  const id = decodeJwtPayload(idToken);
  const oid = id.oid || id.sub;
  if (!oid) {
    return NextResponse.json({ error: "Missing user id in token" }, { status: 400 });
  }

  const sessionToken = createSessionToken(
    {
      oid: String(oid),
      name: typeof id.name === "string" ? id.name : undefined,
      upn:
        typeof id.preferred_username === "string"
          ? id.preferred_username
          : typeof id.email === "string"
            ? id.email
            : undefined
    },
    60 * 60 * 24
  );

  const res = NextResponse.redirect(new URL(next.startsWith("/") ? next : "/viewer", url.origin));
  res.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24
  });
  res.cookies.set(AUTH_STATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
  return res;
}
