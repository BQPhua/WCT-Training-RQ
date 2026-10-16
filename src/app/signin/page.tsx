import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import logo from "@/components/shell/wct-logo.png";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isEntraConfigured } from "@/lib/auth/oidc";
import { safeReturnTo } from "@/lib/auth/return-to";
import { BASE_PATH, isDemoLoginEnabled } from "@/lib/env";
import { listDemoAccounts } from "@/lib/services/view-as";

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
  demo_user: "That demo account isn't available any more. Please pick another.",
};

/** Demo accounts grouped in workflow order, so stakeholders can walk the route top to bottom. */
const ROLE_ORDER = ["Requester", "Department HOD", "BU Admin", "L&D Team (System Admin)", "HR Head", "System Admin"] as const;
/** An account sits under its most senior role, e.g. "Department HOD · HR Head" → HR Head. */
function primaryRole(label: string): (typeof ROLE_ORDER)[number] {
  const ranks = label.split(" · ").map((l) => ROLE_ORDER.indexOf(l as (typeof ROLE_ORDER)[number]));
  return ROLE_ORDER[Math.max(0, ...ranks)];
}

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
  const demo = isDemoLoginEnabled();
  const accounts = demo ? await listDemoAccounts() : [];
  const groups = ROLE_ORDER.map((role) => ({ role, accounts: accounts.filter((a) => primaryRole(a.roleLabel) === role) })).filter((g) => g.accounts.length);

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#1c232d]">
      {/* Soft, blurred copy of the photo fills any space the photo itself doesn't cover. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${BASE_PATH}/brand/signin-bg-blur.jpg`} alt="" aria-hidden className="absolute inset-0 size-full scale-110 object-cover blur-2xl brightness-75" />
      {/*
        Decorative photo of WCT's headquarters (its own logo and slogan sit on the left).
        It always fits the screen height and keeps its proportions, so the whole picture
        shows at any screen size instead of being blown up and cropped; on very wide
        screens its right edge fades into the blurred copy.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${BASE_PATH}/brand/signin-bg.jpg`}
        alt=""
        aria-hidden
        width={2384}
        height={1340}
        className="absolute inset-y-0 left-0 h-full w-auto max-w-none [mask-image:linear-gradient(to_right,black_82%,transparent)]"
      />
      <div aria-hidden className="absolute inset-0 bg-[#10151c]/60 lg:bg-transparent lg:bg-gradient-to-r lg:from-transparent lg:from-45% lg:to-[#10151c]/75" />

      <main id="main" className="relative z-10 flex min-h-dvh items-center justify-center px-4 py-10 lg:justify-end lg:pr-[7vw]">
        <div className="w-full max-w-[440px] animate-rise rounded-2xl bg-surface/92 p-6 shadow-[0_24px_80px_-20px_rgb(0_0_0/0.6)] ring-1 ring-white/15 backdrop-blur-xl sm:p-8">
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-white px-2 py-1.5 ring-1 ring-black/5">
              <Image src={logo} alt="WCT" unoptimized priority className="h-10 w-auto" />
            </span>
            <span className="border-l border-line pl-3 leading-tight">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">WCT HR Forms</span>
              <span className="block text-[15px] font-semibold text-ink">Training RQ</span>
            </span>
          </div>

          <h1 className="mt-7 text-[26px] font-semibold leading-tight tracking-tight text-ink">Training Requisition</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Raise a training request, follow it through HOD, BU Admin, L&amp;D and HR Head approval, and print the signed-off form.
          </p>

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
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            Use your WCT Microsoft 365 account. Having trouble? Contact the HR Transformation Team.
          </p>

          {demo && accounts.length > 0 && (
            <section aria-labelledby="demo-title" className="mt-7 border-t border-line pt-5">
              <h2 id="demo-title" className="text-sm font-semibold text-ink">
                Try a demo account
              </h2>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">Pick a role to see its screens. Demo accounts only see demo requests.</p>
              <form action={`${BASE_PATH}/api/auth/demo-login`} method="post" className="mt-3 space-y-2.5">
                <input type="hidden" name="returnTo" value={returnTo} />
                {groups.map((g) => (
                  <div key={g.role} role="group" aria-label={g.role}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{g.role}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {g.accounts.map((a) => (
                        <button
                          key={a.id}
                          name="userId"
                          value={a.id}
                          data-email={a.email}
                          title={`${a.name} · ${a.roleLabel}`}
                          className="cursor-pointer rounded-full border border-line bg-surface px-3 py-1 text-[13px] font-medium text-ink transition-colors hover:border-brand hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                        >
                          {a.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </form>
            </section>
          )}
        </div>
      </main>

      <p className="absolute bottom-4 left-5 z-10 hidden text-xs text-white/70 lg:block">WCT Berhad · Human Resources &amp; Administration</p>
    </div>
  );
}
