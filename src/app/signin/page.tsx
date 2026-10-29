import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import * as motion from "motion/react-client";
import { FadeRise } from "@/components/motion/fade-rise";
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
    <div className="min-h-dvh bg-ground lg:grid lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)]">
      {/*
        Paradigm Mall at dusk (a WCT property), upscaled 4x with Real-ESRGAN to 1420x1136
        (scripts/prepare-signin-image.py). The panel's shape is close to the photo's, so on a
        1080p screen it is shown at or below its own size and stays sharp.
      */}
      <section aria-label="WCT Holdings Berhad" className="relative h-[34dvh] min-h-52 overflow-hidden bg-shell lg:sticky lg:top-0 lg:h-dvh">
        <picture>
          <source type="image/avif" srcSet={`${BASE_PATH}/brand/signin-paradigm-710.avif 710w, ${BASE_PATH}/brand/signin-paradigm-1420.avif 1420w`} sizes="(min-width: 1024px) 55vw, 100vw" />
          <source type="image/webp" srcSet={`${BASE_PATH}/brand/signin-paradigm-710.webp 710w, ${BASE_PATH}/brand/signin-paradigm-1420.webp 1420w`} sizes="(min-width: 1024px) 55vw, 100vw" />
          <motion.img
            data-testid="signin-photo"
            src={`${BASE_PATH}/brand/signin-paradigm-1420.jpg`}
            srcSet={`${BASE_PATH}/brand/signin-paradigm-710.jpg 710w, ${BASE_PATH}/brand/signin-paradigm-1420.jpg 1420w`}
            sizes="(min-width: 1024px) 55vw, 100vw"
            alt="Paradigm Mall at dusk"
            width={1420}
            height={1136}
            fetchPriority="high"
            className="absolute inset-0 size-full object-cover object-[50%_62%]"
            initial={{ scale: 1.04 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          />
        </picture>
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-shell via-shell/55 to-transparent to-80% lg:via-shell/10 lg:to-60%" />
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-4 p-5 sm:p-7 lg:p-10">
          <span className="shrink-0 rounded-lg bg-white px-2 py-1.5 shadow-md">
            <Image src={logo} alt="WCT" unoptimized priority className="h-9 w-auto lg:h-11" />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block text-lg font-semibold tracking-[-0.01em] text-white lg:text-2xl">Training Requisition</span>
            <span className="mt-0.5 block text-[13px] text-white/80 lg:text-sm">
              WCT Holdings Berhad<span className="hidden sm:inline"> · Human Resources &amp; Administration</span>
            </span>
          </span>
        </div>
      </section>

      <main id="main" className="flex justify-center px-5 py-9 sm:px-8 lg:items-center lg:py-14">
        <FadeRise className="w-full max-w-[420px]">
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">Sign in to Training RQ</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Raise a training request, follow it along its approval route, and print the signed-off form.
          </p>

          {error && (
            <p role="alert" className="mt-5 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
              {error}
            </p>
          )}
          {sp.signedout && !error && <p className="mt-5 rounded-lg bg-approved-soft px-4 py-3 text-sm text-approved-text">You have signed out.</p>}

          <Button asChild variant="brand" size="lg" className="mt-6 h-12 w-full">
            <a href={`${BASE_PATH}/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`} aria-disabled={!isEntraConfigured()}>
              {hasMicrosoftLogo() ? (
                // Official asset from Microsoft's identity platform branding guidelines (added by the deployer).
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`${BASE_PATH}/brand/microsoft-logo.svg`} alt="" width={20} height={20} className="size-5 rounded-[2px] bg-white p-px" />
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
            <section aria-labelledby="demo-title" className="mt-8 border-t border-line pt-6">
              <h2 id="demo-title" className="text-sm font-semibold text-ink">
                Try a demo account
              </h2>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted">Pick a role to see its screens. Demo accounts only see demo requests.</p>
              <form action={`${BASE_PATH}/api/auth/demo-login`} method="post" className="mt-4 space-y-3">
                <input type="hidden" name="returnTo" value={returnTo} />
                {groups.map((g) => (
                  <div key={g.role} role="group" aria-label={g.role}>
                    <p className="text-xs font-medium text-ink-2">{g.role}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {g.accounts.map((a) => (
                        <button
                          key={a.id}
                          name="userId"
                          value={a.id}
                          data-email={a.email}
                          title={`${a.name} · ${a.roleLabel}`}
                          className="cursor-pointer rounded-full border border-line-strong bg-surface px-3 py-1 text-[13px] font-medium text-ink shadow-sm transition-colors hover:border-info hover:bg-info-soft hover:text-info-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
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
        </FadeRise>
      </main>
    </div>
  );
}
