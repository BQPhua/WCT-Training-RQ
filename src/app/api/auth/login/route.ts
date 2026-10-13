import { NextResponse, type NextRequest } from "next/server";
import { client, getOidcConfig, isEntraConfigured, OIDC_SCOPES, redirectUri } from "@/lib/auth/oidc";
import { getOidcTx } from "@/lib/auth/session";
import { safeReturnTo } from "@/lib/auth/return-to";
import { env } from "@/lib/env";

export async function GET(req: NextRequest) {
  if (!isEntraConfigured()) {
    return NextResponse.redirect(`${env.APP_URL}/signin?error=not_configured`);
  }
  const config = await getOidcConfig();
  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  const state = client.randomState();
  const nonce = client.randomNonce();

  const tx = await getOidcTx();
  tx.state = state;
  tx.nonce = nonce;
  tx.codeVerifier = codeVerifier;
  tx.returnTo = safeReturnTo(req.nextUrl.searchParams.get("returnTo"));
  await tx.save();

  const url = client.buildAuthorizationUrl(config, {
    redirect_uri: redirectUri(),
    scope: OIDC_SCOPES,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    nonce,
    prompt: "select_account",
  });
  return NextResponse.redirect(url.href);
}
