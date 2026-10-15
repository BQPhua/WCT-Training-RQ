import "server-only";
import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";
import { BASE_PATH, env } from "@/lib/env";

export interface SessionData {
  userId?: string;
  /** Epoch ms of sign-in; sessions are capped at 8 hours absolute. */
  signedInAt?: number;
  /** System Admin only: demo account the app is currently shown as. */
  viewAsUserId?: string;
}

export interface OidcTxData {
  state?: string;
  nonce?: string;
  codeVerifier?: string;
  returnTo?: string;
}

const SESSION_TTL_SECONDS = 8 * 60 * 60;

function baseCookie() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: BASE_PATH,
  };
}

export function sessionOptions(): SessionOptions {
  return {
    cookieName: "trq_session",
    password: env.SESSION_SECRET,
    ttl: SESSION_TTL_SECONDS,
    cookieOptions: { ...baseCookie(), maxAge: SESSION_TTL_SECONDS },
  };
}

/** Short-lived cookie holding PKCE verifier/state/nonce during the Microsoft redirect. */
export function oidcTxOptions(): SessionOptions {
  return {
    cookieName: "trq_oidc",
    password: env.SESSION_SECRET,
    ttl: 600,
    cookieOptions: { ...baseCookie(), maxAge: 600 },
  };
}

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions());
}

export async function getOidcTx() {
  return getIronSession<OidcTxData>(await cookies(), oidcTxOptions());
}

export function isSessionExpired(s: SessionData): boolean {
  return !s.signedInAt || Date.now() - s.signedInAt > SESSION_TTL_SECONDS * 1000;
}
