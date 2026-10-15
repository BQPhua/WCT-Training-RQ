import { NextResponse, type NextRequest } from "next/server";
import { client, getOidcConfig, redirectUri } from "@/lib/auth/oidc";
import { getOidcTx, getSession } from "@/lib/auth/session";
import { DeactivatedUserError, syncUserFromProfile } from "@/lib/auth/sync-user";
import { env } from "@/lib/env";

type GraphMe = { displayName?: string; mail?: string; userPrincipalName?: string; jobTitle?: string; department?: string };

async function fetchGraphProfile(accessToken: string): Promise<GraphMe> {
  try {
    const res = await fetch(
      "https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName,jobTitle,department",
      { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(8000) },
    );
    return res.ok ? ((await res.json()) as GraphMe) : {};
  } catch {
    return {};
  }
}

export async function GET(req: NextRequest) {
  const fail = (code: string) => NextResponse.redirect(`${env.APP_URL}/signin?error=${code}`);
  const tx = await getOidcTx();
  const { state, nonce, codeVerifier, returnTo } = tx;
  tx.destroy();
  if (!state || !nonce || !codeVerifier) return fail("expired");

  try {
    const config = await getOidcConfig();
    // Behind Nginx req.url is the internal address; rebuild the public callback URL.
    const currentUrl = new URL(redirectUri());
    currentUrl.search = req.nextUrl.search;

    const tokens = await client.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedState: state,
      expectedNonce: nonce,
      idTokenExpected: true,
    });
    const claims = tokens.claims();
    if (!claims || claims.tid !== env.ENTRA_TENANT_ID) return fail("tenant");

    const me = await fetchGraphProfile(tokens.access_token);
    const email = (me.mail || (claims.email as string) || (claims.preferred_username as string) || "").toLowerCase();
    if (!email || !claims.oid) return fail("profile");

    const user = await syncUserFromProfile({
      oid: String(claims.oid),
      email,
      name: me.displayName || (claims.name as string) || email,
      jobTitle: me.jobTitle,
      department: me.department,
    });

    const session = await getSession();
    session.userId = user.id;
    delete session.viewAsUserId; // a new sign-in never inherits "view as"
    session.signedInAt = Date.now();
    await session.save();
    return NextResponse.redirect(`${env.APP_URL}${returnTo ?? "/dashboard"}`);
  } catch (e) {
    if (e instanceof DeactivatedUserError) return fail("deactivated");
    console.error("[auth] callback failed", e instanceof Error ? e.message : e);
    return fail("callback");
  }
}
