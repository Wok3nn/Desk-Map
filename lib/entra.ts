import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";

export type EntraSettings = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
  mappingPrefix?: string | null;
  mappingRegex?: string | null;
};

export async function getEntraSettings() {
  const config = await prisma.entraConfig.findFirst();
  if (!config || !config.tenantId || !config.clientId || !config.clientSecretEnc) {
    return null;
  }
  const clientSecret = decryptSecret(config.clientSecretEnc);
  return {
    tenantId: config.tenantId,
    clientId: config.clientId,
    clientSecret,
    scopes: config.scopes || "https://graph.microsoft.com/.default",
    mappingPrefix: config.mappingPrefix,
    mappingRegex: config.mappingRegex
  } as EntraSettings;
}

export async function fetchGraphUsers(settings: EntraSettings, limit?: number) {
  const token = await getClientCredentialToken(settings);
  const users: any[] = [];
  let url =
    "https://graph.microsoft.com/v1.0/users?$select=id,givenName,surname,displayName,officeLocation,userPrincipalName";
  if (limit && limit > 0) {
    url += `&$top=${limit}`;
  }

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Graph error: ${res.status} ${text}`);
    }
    const data = await res.json();
    if (Array.isArray(data.value)) {
      users.push(...data.value);
    }
    if (limit && users.length >= limit) {
      break;
    }
    url = data["@odata.nextLink"] || "";
  }

  return users;
}

export async function getClientCredentialToken(settings: EntraSettings) {
  const params = new URLSearchParams();
  params.set("client_id", settings.clientId);
  params.set("scope", settings.scopes || "https://graph.microsoft.com/.default");
  params.set("client_secret", settings.clientSecret);
  params.set("grant_type", "client_credentials");

  const res = await fetch(`https://login.microsoftonline.com/${settings.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token error: ${res.status} ${text}`);
  }
  const payload = await res.json();
  return payload.access_token as string;
}

export async function isUserInGroup(userObjectId: string, groupId: string, settings: EntraSettings) {
  if (!userObjectId || !groupId) return false;
  const token = await getClientCredentialToken(settings);
  const url = `https://graph.microsoft.com/v1.0/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userObjectId)}/$ref`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (res.status === 204) return true;
  if (res.status === 404) return false;
  const text = await res.text();
  throw new Error(`Group membership check failed: ${res.status} ${text}`);
}

export function mapOfficeLocationToDesk(officeLocation: string | null | undefined, settings: EntraSettings) {
  if (!officeLocation) return null;
  const value = officeLocation.trim();
  if (settings.mappingRegex) {
    const regex = new RegExp(settings.mappingRegex, "i");
    const match = value.match(regex);
    if (match) {
      const candidate = match[1] ?? match[0];
      const parsed = parseInt(candidate.replace(/\D/g, ""), 10);
      return Number.isNaN(parsed) ? null : parsed;
    }
  }
  if (settings.mappingPrefix && value.toLowerCase().startsWith(settings.mappingPrefix.toLowerCase())) {
    const trimmed = value.slice(settings.mappingPrefix.length);
    const parsed = parseInt(trimmed.replace(/\D/g, ""), 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  const fallback = parseInt(value.replace(/\D/g, ""), 10);
  return Number.isNaN(fallback) ? null : fallback;
}
