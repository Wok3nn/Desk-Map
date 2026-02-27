import crypto from "crypto";

export const SESSION_COOKIE = "deskmap_session";
export const AUTH_STATE_COOKIE = "deskmap_auth_state";

type SessionPayload = {
  oid: string;
  name?: string;
  upn?: string;
  exp: number;
};

function b64url(input: Buffer | string) {
  const data = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return data.toString("base64url");
}

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.ENCRYPTION_KEY;
  if (!secret) throw new Error("AUTH_SECRET (or NEXTAUTH_SECRET/ENCRYPTION_KEY) is required");
  return secret;
}

export function createSessionToken(payload: Omit<SessionPayload, "exp">, maxAgeSeconds = 60 * 60 * 24) {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds
  };
  const body = b64url(JSON.stringify(fullPayload));
  const sig = b64url(crypto.createHmac("sha256", getAuthSecret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null) {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = b64url(crypto.createHmac("sha256", getAuthSecret()).update(body).digest());
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.oid || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
