/** Microsoft Graph app-only access (client credentials; needs admin-consented application permissions). */
export interface GraphConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export async function getGraphToken(cfg: GraphConfig, fetchFn: typeof fetch = fetch): Promise<{ value: string; expiresAt: number }> {
  const res = await fetchFn(`https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Microsoft sign-in for the directory failed (HTTP ${res.status}). Check ENTRA_* settings.`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  return { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
}
