import "server-only";
import * as client from "openid-client";
import { env } from "@/lib/env";

let configPromise: Promise<client.Configuration> | null = null;

export function isEntraConfigured(): boolean {
  return !!(env.ENTRA_TENANT_ID && env.ENTRA_CLIENT_ID && env.ENTRA_CLIENT_SECRET);
}

/** Cached OIDC discovery for the single WCT tenant. */
export function getOidcConfig(): Promise<client.Configuration> {
  if (!isEntraConfigured()) throw new Error("Microsoft Entra ID is not configured (ENTRA_* env vars).");
  configPromise ??= client
    .discovery(
      new URL(`https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/v2.0`),
      env.ENTRA_CLIENT_ID!,
      env.ENTRA_CLIENT_SECRET!,
    )
    .catch((e) => {
      configPromise = null;
      throw e;
    });
  return configPromise;
}

export const OIDC_SCOPES = "openid profile email User.Read";

export function redirectUri(): string {
  return `${env.APP_URL}/api/auth/callback`;
}

export { client };
