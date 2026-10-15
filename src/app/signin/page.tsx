import fs from "node:fs";
import path from "node:path";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { Wordmark } from "@/components/shell/wordmark";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isEntraConfigured } from "@/lib/auth/oidc";
import { safeReturnTo } from "@/lib/auth/return-to";
import { BASE_PATH, isDevLoginEnabled } from "@/lib/env";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  expired: "Your sign-in took too long. Please try again.",
  tenant: "Please sign in with your WCT Microsoft account.",
  profile: "We couldn't read your Microsoft profile. Please contact IT.",
  deactivated: "Your account has been deactivated in Training RQ. Please contact HR.",
  callback: "Sign-in failed. Please try again; if it keeps happening, contact IT.",
  not_configured: "Microsoft sign-in isn't configured on this server yet. Please contact IT.",
  dev_user: "That demo user doesn't exist. Run the demo seed first.",
};

// Decorative board for the sign-in panel (not data).
const PATTERN = "AAPAAAPRAPAAACAAPPAAAARAPAAAPAACAAPAAAAPRAAP".split("");
const PATTERN_CLASS: Record<string, string> = {
  A: "bg-approved/85",
  P: "bg-pending/90",
  R: "bg-returned/85",
  C: "bg-shell-muted/25",
};

/** The official Microsoft logo is not shipped in the repo; see docs/DEPLOYMENT.md. */
function hasMicrosoftLogo(): boolean {
  try {
    return fs.existsSync(path.join(process.cwd(), "public/brand/microsoft-logo.svg"));
  } catch {
    return false;
  }
}

export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const sp = await searchParams;
  const returnTo = safeReturnTo(typeof sp.returnTo === "string" ? sp.returnTo : null);
  if (await getCurrentUser()) redirect(returnTo);
  const error = typeof sp.error === "string" ? ERRORS[sp.error] : undefined;
  const dev = isDevLoginEnabled();
  const demoUsers = dev ? await db.select({ email: users.email, name: users.name, jobTitle: users.jobTitle }).from(users).orderBy(asc(users.email)).limit(30) : [];

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-shell p-12 text-shell-fg lg:flex lg:flex-col">
        <Wordmark />
        <div className="mt-auto max-w-md">
          <div aria-hidden className="mb-10 grid w-fit grid-cols-11 gap-1.5">
            {PATTERN.map((c, i) => (
              <span key={i} style={{ animationDelay: `${i * 18}ms` }} className={`size-7 animate-tile rounded-[4px] ${PATTERN_CLASS[c]}`} />
            ))}
          </div>
          <h1 className="text-[32px] font-semibold leading-tight tracking-tight">Every training request, from proposal to approval, in one place.</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-shell-muted">
            Raise a request, follow it through HOD, BU Admin, L&amp;D and HR Head approval, and print the signed-off training requisition form when it&apos;s done.
          </p>
        </div>
        <p className="mt-12 text-xs text-shell-muted">WCT Berhad · Human Resources &amp; Administration</p>
      </aside>

      <main id="main" className="flex items-center justify-center bg-ground px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="inline-flex rounded-lg bg-shell p-2 pr-3">
              <Wordmark />
            </span>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1.5 text-sm text-muted">Use your WCT Microsoft 365 account.</p>

          {error && (
            <p role="alert" className="mt-5 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
              {error}
            </p>
          )}
          {sp.signedout && !error && <p className="mt-5 rounded-lg bg-approved-soft px-4 py-3 text-sm text-approved-text">You have signed out.</p>}

          <Button asChild variant="primary" size="lg" className="mt-6 w-full">
            <a href={`${BASE_PATH}/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`} aria-disabled={!isEntraConfigured()}>
              {hasMicrosoftLogo() ? (
                // Official asset from Microsoft's identity platform branding guidelines (added by the deployer).
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`${BASE_PATH}/brand/microsoft-logo.svg`} alt="" width={20} height={20} className="size-5" />
              ) : (
                <KeyRound />
              )}{" "}
              Sign in with Microsoft
            </a>
          </Button>
          <p className="mt-4 text-[13px] leading-relaxed text-muted">
            Having trouble? Contact the HR Transformation Team. Approvals are only made inside this system, never by replying to email.
          </p>

          {dev && (
            <form action={`${BASE_PATH}/api/auth/dev-login`} method="post" className="mt-10 rounded-xl border border-dashed border-line-strong bg-surface p-4">
              <p className="text-[13px] font-semibold text-ink">Development sign-in</p>
              <p className="mt-0.5 text-xs text-muted">Demo accounts. Disabled automatically in production.</p>
              <input type="hidden" name="returnTo" value={returnTo} />
              <div className="mt-3 grid gap-1">
                {demoUsers.map((u) => (
                  <button
                    key={u.email}
                    name="email"
                    value={u.email}
                    className="flex cursor-pointer items-center justify-between rounded-md px-2.5 py-2 text-left text-sm hover:bg-ground"
                  >
                    <span className="font-medium text-ink">{u.name}</span>
                    <span className="truncate pl-3 text-xs text-muted">{u.jobTitle}</span>
                  </button>
                ))}
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
