/**
 * Central, lazily-read configuration. Values are read on access so that
 * `next build` works without production secrets present.
 * All secrets live in the server's .env file — never in git.
 */
export const BASE_PATH = "/WCT-Training-RQ";

export function parseEmailList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Dev-only sign-in. Can never be enabled in a production build. */
export function isDevLoginEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.AUTH_DEV_LOGIN === "true";
}

/**
 * Demo-account sign-in on the sign-in page. On in development with dev sign-in,
 * and in production only when the server sets DEMO_LOGIN=true (stakeholder trial).
 */
export function isDemoLoginEnabled(): boolean {
  return isDevLoginEnabled() || process.env.DEMO_LOGIN === "true";
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}`);
  return v;
}

export const env = {
  /** Public URL including base path, no trailing slash. */
  get APP_URL(): string {
    return (process.env.APP_URL ?? `http://localhost:3010${BASE_PATH}`).replace(/\/$/, "");
  },
  get DATABASE_URL(): string {
    return required("DATABASE_URL");
  },
  /** ≥32 chars; encrypts the session cookie. */
  get SESSION_SECRET(): string {
    return required("SESSION_SECRET");
  },
  get ENTRA_TENANT_ID(): string | undefined {
    return process.env.ENTRA_TENANT_ID;
  },
  get ENTRA_CLIENT_ID(): string | undefined {
    return process.env.ENTRA_CLIENT_ID;
  },
  get ENTRA_CLIENT_SECRET(): string | undefined {
    return process.env.ENTRA_CLIENT_SECRET;
  },
  /** Company-wide people search via Graph (needs User.Read.All with admin consent). Set "false" to search only users already in the app. */
  get DIRECTORY_SEARCH_GRAPH(): boolean {
    return process.env.DIRECTORY_SEARCH_GRAPH !== "false";
  },
  get POWER_AUTOMATE_FLOW_URL(): string | undefined {
    return process.env.POWER_AUTOMATE_FLOW_URL || undefined;
  },
  get CRON_SECRET(): string | undefined {
    return process.env.CRON_SECRET || undefined;
  },
  get UPLOAD_DIR(): string {
    return process.env.UPLOAD_DIR ?? "./uploads";
  },
  get BOOTSTRAP_ADMIN_EMAILS(): string[] {
    return parseEmailList(process.env.BOOTSTRAP_ADMIN_EMAILS);
  },
};
