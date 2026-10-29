# Round 4 Implementation Plan: Twilight redesign, motion, Malls/Land route

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (native) or superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Malls and Land requests end at L&D, and E&C requests still end at HR Head. The whole app gets a WCT-red and twilight-navy redesign with restrained Motion animation, and a sharp split-screen sign-in page built on the Paradigm Mall photo.

**Architecture:**
- **Route:** a per-business-unit flag, `requires_hr_approval`, feeds `RequestRef.requiresHrApproval`. The pure `transition()` function decides the next state, and nothing else does.
- **Look:** comes from CSS tokens in `globals.css` plus the shared `ui/*` primitives. Pages change only where their layout changes.
- **Motion:** one small client module, `src/components/motion/`, wraps `motion/react`. Pages use those wrappers and never use raw animation settings.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind 4, Drizzle/Postgres 16, Radix, `motion` (new), Vitest, Playwright, Real-ESRGAN (asset prep only), Pillow.

**Spec:** `docs/superpowers/specs/2026-10-29-twilight-redesign-and-route-design.md`

## Global Constraints

- **Brand red:** `#E30613` = `oklch(0.58 0.235 27)`. In dark mode it is `oklch(0.66 0.21 27)`.
- **Status colours:**
  - Approved: green.
  - Pending: sky `oklch(0.64 0.13 262)`.
  - Returned: orange `oklch(0.7 0.16 55)`.
  - Cancelled and draft: grey.
  - Brand red is never used as a status colour.
- **Radius and focus:** 12px for cards, 10px for controls. Focus ring is a 2px sky ring.
- **Motion:**
  - Import from `motion/react` (client) or `motion/react-client` (server `motion.*` elements only).
  - Animate only transform and opacity.
  - Durations 150–300ms.
  - Springs use `{ type: "spring", visualDuration: 0.25, bounce: 0 }`.
  - `MotionConfig reducedMotion="user"` at the root.
  - Never import `framer-motion`.
- **Route copy:**
  - Admin switch label: "Final approval by HR Head".
  - Timeline label for an L&D final approval: "Final approval (L&D)".
  - PDF HR block when skipped: "Not required for {unit name}".
- **Repo rules:**
  - The repo is public, so no secrets, no `.env` and no flow URL.
  - Never push. Deliver a git bundle.
  - Don't touch the Frappe demo.
  - Server commands are given one at a time.
- No feature, permission or data-capture changes beyond the spec.

## Review Focus

1. **In-flight request.** A Malls request already in `PENDING_HR` when the flag is false must still be approvable by HR Head. Its tracker must show the HR step as current. Owner: Task 2 and Task 3 tests.
2. **No business unit.** A request with `businessUnitId = null` (an orphan department) must go to HR Head and must not crash. Owner: Task 2 test.
3. **Flag toggled mid-flight.** When an admin flips the flag while a request sits at `PENDING_LND`, the L&D approval uses the value at approval time. Owner: Task 2 integration test.
4. **Reduced motion.** With `prefers-reduced-motion: reduce`, no transform animation runs and nothing is stuck at opacity 0. Owner: Task 5 e2e check, using Playwright `reducedMotion: 'reduce'` and asserting the main content is visible.
5. **Mobile sign-in.** At a 390px viewport the sign-in button is above the fold and the photo banner doesn't push it off screen. Owner: Task 7 e2e check.

---

### Task 1: Local environment

**Files:**
- `/tmp/claude-0/startdev.sh`
- `/tmp/claude-0/killdev.sh`
- `.env.local` (git-ignored)

**Produces:** a running Postgres 16 with `wct_training_rq` and `wct_training_rq_test`, `node_modules`, and a dev server on port 3010 with seed and demo data.

- [ ] Install Postgres 16 if it's missing. Start it with `sudo pg_ctlcluster 16 main start`. Create the role and databases from `.env.example` values (local-only password).
- [ ] Run `npm ci`.
- [ ] Write `.env.local` with:
  - `APP_URL=http://localhost:3010/WCT-Training-RQ`
  - `DATABASE_URL`
  - a random `SESSION_SECRET`
  - `AUTH_DEV_LOGIN=true`, `DEMO_LOGIN=true`
  - `UPLOAD_DIR` in the scratchpad
- [ ] Run `npm run db:migrate && npm run db:seed && npm run db:seed-demo`.
- [ ] Write the start/kill scripts (`nohup npm run dev`, pid file). Check that `curl -s localhost:3010/WCT-Training-RQ/api/health` returns ok.
- [ ] Baseline: `npm test`, `npm run test:integration` and `npm run typecheck` all pass before any change. Record any failure that already exists.

### Task 2: Route rule (data + workflow)

**Files:**
- Modify:
  - `src/db/schema.ts` (`businessUnits`)
  - `src/db/seed.ts` (`SEED_BUSINESS_UNITS`)
  - `src/lib/workflow/types.ts` (`RequestRef`)
  - `src/lib/workflow/transitions.ts` (`APPROVE` at `PENDING_LND`)
  - `src/lib/services/requests.ts` (`ref()` and the action path around line 264)
- Create: `drizzle/0002_bu_requires_hr_approval.sql` plus its meta, via `npm run db:generate`, then hand-add the UPDATE.
- Tests:
  - `tests/unit/workflow/transitions.test.ts`
  - `tests/integration/requests.test.ts`

**Produces:**
- `businessUnits.requiresHrApproval: boolean` (column `requires_hr_approval`, default `true`).
- `RequestRef.requiresHrApproval: boolean`.
- `SEED_BUSINESS_UNITS` entries gain `requiresHrApproval`: LAND false, ENC true, MALLS false.

**Steps:**

- [ ] Unit tests in the transitions suite:
  - `L&D approval goes to PENDING_HR when requiresHrApproval`: expect `toStatus` `PENDING_HR` and event `LND_APPROVED`.
  - `L&D approval is final when HR approval is not required`: expect `toStatus` `APPROVED` and event `FINAL_APPROVED`.
  - `HR Head can still approve PENDING_HR when the flag is false`: expect `APPROVED`.
  - `getAllowedActions` is unchanged at `PENDING_LND` for both flag values.
- [ ] Run `npx vitest run tests/unit/workflow`. Expected: FAIL (type error or wrong status).
- [ ] Implement:
  - Add `requiresHrApproval` to `RequestRef`. Update every existing test fixture that builds a `RequestRef`, defaulting to `true`.
  - In `transition()`, `APPROVE` from `PENDING_LND` goes to `APPROVED`/`FINAL_APPROVED` when the flag is false.
  - Any code path that sets `finalisedAt` on `FINAL_APPROVED` must also cover this case. Check `requests.ts`, which sets it from the event kind and not from the status.
- [ ] Schema column and migration:
  - `ALTER TABLE business_units ADD COLUMN requires_hr_approval boolean NOT NULL DEFAULT true;`
  - `UPDATE business_units SET requires_hr_approval = false WHERE code IN ('LAND','MALLS');`
  - Seed upsert sets the flag.
- [ ] `requests.ts`:
  - When building the ref for an action, load `requires_hr_approval` for the request's `businessUnitId` inside the same transaction. Null unit means `true`.
  - `ref()` gains the parameter.
- [ ] Integration tests, using existing helpers to create users and requests:
  - `Malls request is approved by L&D without HR Head`.
  - `E&C request still goes to HR Head`.
  - `Request with no business unit goes to HR Head`.
  - `Flag read at L&D approval time` (flip after submit, before L&D approves).
  - `In-flight PENDING_HR Malls request can be approved by HR Head`.
- [ ] Run `npm test && npm run test:integration`. Expected: all pass. Then `npm run typecheck`.
- [ ] Commit: `feat(route): Malls and Land requests are finalised by L&D`.

### Task 3: Route shown everywhere

**Files:**
- `src/lib/services/tracker.ts`
- `src/app/(app)/requests/[id]/page.tsx`
- `src/lib/workflow/types.ts` (`EVENT_LABEL` stays; the timeline decides)
- `src/components/request-detail/timeline.tsx`
- `src/lib/pdf/from-detail.ts`
- `src/lib/pdf/training-rq-document.tsx`
- `src/lib/services/requests.ts` (`RequestDetail` gains `businessUnit: { name, requiresHrApproval } | null` if not already present)
- `src/lib/services/admin.ts` (`buSchema` plus upsert)
- `src/components/admin/org-editors.tsx`
- `src/app/(app)/admin/organisation/page.tsx`
- `src/app/(app)/admin/roles/page.tsx` (copy)
- Tests: `tests/unit/tracker.test.ts`, `tests/unit/pdf.test.ts`, `tests/integration/admin.test.ts`

**Consumes:** `businessUnits.requiresHrApproval` (Task 2).

**Produces:** `buildStations(d, holders)` reads `d.businessUnit?.requiresHrApproval ?? true`.

**Steps:**

- [ ] Tracker tests:
  - `hides HR station for a Malls request at PENDING_LND`: keys are `submit, hod, bu, lnd, final`.
  - `hides HR station for an approved Malls request`.
  - `shows HR station for an in-flight Malls request at PENDING_HR`.
  - `shows HR station when the round contains an HR approval`.
  - `E&C request keeps all six stations`.
- [ ] PDF test: `HR block reads "Not required for Malls" when no HR approval and the unit skips HR`.
- [ ] Admin integration test: `upsertBusinessUnit stores requiresHrApproval`.
- [ ] Run the tests. Expected: FAIL.
- [ ] Implement:
  - Tracker condition: per the spec §2.4.
  - Timeline: a `FINAL_APPROVED` action whose `fromStatus` is `PENDING_LND` renders "Final approval (L&D)".
  - PDF: the copy above.
  - Admin: a checkbox "Final approval by HR Head" in the BU editor, plus a column on the BU list showing "HR Head" or "L&D".
  - Roles page copy: "HR Head gives final approval for E&C requests."
- [ ] Run unit, integration and typecheck. Expected: pass.
- [ ] Commit: `feat(route): tracker, timeline, PDF and admin show the per-unit route`.

### Task 4: Twilight tokens and UI primitives

**Files:**
- `src/app/globals.css`
- `src/components/ui/{button,field,panel,tabs,menu,dialog,misc}.tsx`
- `src/components/status.tsx`
- Create: `scripts/check-contrast.mjs`

**Produces:**
- Token names stay the same (`--ground`, `--surface`, `--shell*`, `--brand*`, `--st-*`, `--danger*`, `--focus`) so pages don't break.
- New tokens: `--sky`, `--sky-soft`, `--sky-text` (exposed to Tailwind as `info`, `info-soft`, `info-text`).
- `--radius: 0.75rem`.
- Button variants keep their names. `primary` becomes brand red with white text. `danger` becomes an outline. Status tones keep their names.

**Steps:**

- [ ] Write `scripts/check-contrast.mjs` (pure Node, OKLCH → sRGB → WCAG ratio):
  - It reads the `:root` and `.dark` blocks of `globals.css`.
  - It asserts these pairs reach ≥ 4.5:
    - `ink`/`ground`, `ink`/`surface`, `muted`/`surface`;
    - `shell-fg`/`shell`, `shell-muted`/`shell`;
    - `brand-fg`/`brand`;
    - each `st-*-text`/`st-*-soft`;
    - `danger`/`surface`.
  - It asserts `brand`/`surface` reaches ≥ 3 (UI component).
  - It exits non-zero on failure.
- [ ] Run it against the old palette to see that it works (it should pass or list current failures).
- [ ] Rewrite the token values per the spec §3.1, for light and dark:
  - Shell gradient via `--shell` and `--shell-2`.
  - Softer, layered `--shadow-*`.
  - Chart series retuned and checked with the dataviz skill's validator: `--series-1` sky, `--series-2` navy-violet, `--series-3` warm copper, all clear of the status hues.
- [ ] Restyle the primitives:
  - Buttons: 10px radius, h-10, solid brand red.
  - Inputs: h-10, 10px radius, sky focus ring.
  - Panel: 12px radius, `shadow-sm`, header divider.
  - Tabs: underline style, ready for the Task 5 indicator.
  - Status pill: soft background, a dot, and 12px medium text.
  - `PageHeader`: title 24/28 semibold, description muted, actions aligned to the end, wrapping on mobile.
  - `EmptyState`: icon in a soft circle.
- [ ] Run `node scripts/check-contrast.mjs && npm run typecheck && npm test`. Expected: pass.
- [ ] Commit: `feat(ui): twilight tokens, contrast check and restyled primitives`.

### Task 5: Motion foundation

**Files:**
- `package.json` (add `motion`)
- `src/components/providers.tsx`
- Create:
  - `src/components/motion/fade-rise.tsx`
  - `src/components/motion/stagger.tsx`
  - `src/components/motion/presence.tsx`
- Modify:
  - `src/components/ui/{dialog,menu,tabs}.tsx`
  - `src/app/(app)/template.tsx` (create: page transition wrapper)
- Tests:
  - `tests/unit/motion.test.tsx`
  - `tests/e2e/reduced-motion.spec.ts`

**Produces:**
- `<FadeRise delay?: number className?>`: a client component, opacity 0→1 and y 8→0, using the global spring.
- `<Stagger as?: "ul"|"tbody"|"div" limit?: number=8>` with `<StaggerItem>`: a 30ms stagger for the first `limit` children only.
- `SPRING` constant exported from `fade-rise.tsx`.
- Dialog and Menu content animate in and out using Radix `forceMount` with `AnimatePresence`.
- `TabsList` renders a `layoutId` underline that is unique per instance via `useId()`.

**Steps:**

- [ ] Run `npm i motion`. Load the Motion skill and follow its React rules.
- [ ] Unit test:
  - `FadeRise renders its children`.
  - `Stagger animates at most limit items`: children past the limit get no `motion` initial styles.
- [ ] E2E test: with `reducedMotion: 'reduce'`, `/dashboard` main heading is visible within 500ms and its computed `opacity` is `"1"`.
- [ ] Implement:
  - `MotionConfig reducedMotion="user"` in `Providers`.
  - The template wraps the page in `FadeRise`.
  - Dialog and Menu presence.
  - The tabs indicator.
  - Remove the CSS `rise` and `tile` keyframes once nothing uses them (grep first).
- [ ] Run unit, e2e (`npx playwright test -c _pw.config.ts tests/e2e/reduced-motion.spec.ts`) and typecheck. Expected: pass.
- [ ] Commit: `feat(motion): Motion foundation with reduced-motion support`.

### Task 6: App shell

**Files:**
- `src/components/shell/{app-shell,nav,wordmark,view-as}.tsx`
- `src/app/(app)/layout.tsx`

**Consumes:** tokens (Task 4) and `SPRING` (Task 5).

**Steps:**

- [ ] Sidebar:
  - Navy gradient.
  - Logo on a white chip, with "Training RQ" beneath.
  - Nav groups "Work" (Dashboard, New, My requests, Approvals, History) and "Admin".
  - The active item gets a red 3px left marker as a `motion.span` with `layoutId="nav-marker"`, plus a `bg-white/8` pill.
  - The approvals badge is a brand-red pill.
- [ ] Top bar: page title slot (breadcrumb-less), theme toggle and user menu (avatar, name, role, sign out). The "view as" control stays where it is today, in the new style.
- [ ] Mobile below lg: a hamburger opens a left `SheetContent` drawer with the same nav. The drawer animates with presence (Task 5).
- [ ] Update e2e helpers if any selector changed. Run `npx playwright test -c _pw.config.ts tests/e2e/signout.spec.ts tests/e2e/view-as.spec.ts`. Expected: pass.
- [ ] Commit: `feat(shell): twilight sidebar, top bar and mobile drawer`.

### Task 7: Sign-in page and Paradigm photo

**Files:**
- Create:
  - `public/brand/signin-paradigm-{710,1420}.{avif,webp,jpg}`
  - `scripts/prepare-signin-image.py` (documents the pipeline; not run in CI)
- Delete: `public/brand/signin-bg.jpg`, `public/brand/signin-bg-blur.jpg`
- Modify: `src/app/signin/page.tsx`, `docs/DEPLOYMENT.md` (photo note)
- Test: `tests/e2e/signin.spec.ts`

**Steps:**

- [ ] Upscale the supplied 355×284 photo with Real-ESRGAN ×4 (`realesrgan-ncnn-vulkan` or the ONNX `RealESRGAN_x4plus` model through onnxruntime) to 1420×1136.
  - Inspect it at 100% for halos. If it's over-smoothed, blend 85% ESRGAN with 15% Lanczos.
  - Export AVIF (q≈60), WebP (q≈85) and JPEG (q≈86, progressive) at 1420 and 710 wide.
  - Check sizes: the 1420 AVIF should be under 250 KB.
- [ ] E2E tests:
  - `1920x1080: photo panel is visible and the rendered image width ≤ its natural width`: `img.naturalWidth >= img.getBoundingClientRect().width` at 1×. This is the no-blur guard.
  - `390x844: the Microsoft sign-in button is within the viewport`.
  - `demo accounts list renders when DEMO_LOGIN=true`.
- [ ] Implement the layout per the spec §5:
  - `<picture>` with AVIF, WebP and JPEG sources, `sizes="(min-width:1024px) 55vw, 100vw"`, and `object-position: 50% 60%`.
  - A navy bottom gradient carrying the logo chip, "Training Requisition" and "WCT Holdings Berhad".
  - The card rises with `FadeRise`. The photo settles from 1.04 to 1 with a `motion.img` transform over 1.2s ease-out, as a one-off and not a loop.
  - Keep the error messages, `returnTo`, the dev and demo sign-in, and the Microsoft logo rule.
- [ ] Run `npx playwright test -c _pw.config.ts tests/e2e/signin.spec.ts`. Expected: pass. Screenshot at 1920, 1440 and 390 and look at each.
- [ ] Commit: `feat(signin): split-screen sign-in with the upscaled Paradigm Mall photo`.

### Task 8: Dashboard

**Files:** `src/app/(app)/dashboard/page.tsx`, `src/components/dashboard/{analytics,availability-board}.tsx`, `src/components/reports/charts.tsx`

- [ ] Restyle:
  - Key-figures bar: 4–5 tiles with tabular numbers, an icon in a soft circle and a label. Tiles fade and rise in a stagger.
  - Analytics cards in a 12-column grid.
  - Charts use the new series tokens.
  - The availability board comes last, as the existing order requires.
- [ ] Keep `tests/e2e/dashboard.spec.ts` and `tests/integration/dashboard.test.ts` green. Run both.
- [ ] Commit: `feat(dashboard): twilight dashboard with key figures and motion`.

### Task 9: Request form and request detail

**Files:**
- `src/components/request-form/*`
- `src/app/(app)/requests/new/page.tsx`
- `src/app/(app)/requests/[id]/edit/page.tsx`
- `src/app/(app)/requests/[id]/page.tsx`
- `src/components/request-detail/*`
- `src/components/requests-table.tsx`

**Steps:**

- [ ] Form:
  - Sections as numbered cards (1 Training, 2 Participants, 3 Cost & HRDC, 4 Attachments).
  - A sticky action bar at the bottom, with the autosave status on the left and Save/Submit on the right.
  - Labels above fields.
- [ ] Detail:
  - Header with the reference number, a status pill and the actions.
  - Progress tracker restyled. Completed connectors use `scaleX` and the current step pulses in sky.
  - Two-column layout on lg (details on the left; actions, comments and timeline on the right).
- [ ] Run `npx playwright test -c _pw.config.ts tests/e2e/full-flow.spec.ts tests/e2e/autosave.spec.ts` and `npx vitest run tests/unit/progress-tracker.test.tsx`. Expected: pass.
- [ ] Commit: `feat(requests): redesigned request form and detail`.

### Task 10: Lists, reports and admin

**Files:**
- `src/app/(app)/{my-requests,approvals,history,reports}/page.tsx`
- `src/components/{requests-table,history-filters}.tsx`
- `src/app/(app)/admin/**`
- `src/components/admin/*`

**Steps:**

- [ ] Every page uses `PageHeader`.
- [ ] Tables:
  - Sticky header, 44px rows, hover.
  - The first 8 rows `Stagger` in (this is the `limit` that Task 5 names).
  - New `EmptyState`.
- [ ] Filters sit in a toolbar card.
- [ ] Admin tabs use the motion indicator.
- [ ] Run `npm run test:integration` and `npx playwright test -c _pw.config.ts`. Expected: everything passes.
- [ ] Commit: `feat(pages): restyle lists, reports and admin`.

### Task 11: Verification and handoff

- [ ] Run everything: `npm run typecheck && npm run lint && npm test && npm run test:integration && npx playwright test -c _pw.config.ts && node scripts/check-contrast.mjs`. All must pass.
- [ ] Screenshot pass (Playwright script in the scratchpad):
  - Every page in light and dark, at 390px and 1440px, signed in as demo L&D (System Admin) and as a demo requester.
  - The sign-in page at 1920×1080.
  - Review each one by eye and fix what's off.
- [ ] Final whole-branch review (superpowers requesting-code-review). Fix what it finds.
- [ ] Update `docs/DEPLOYMENT.md` (route switch, photo) and `README.md` if the screenshots or features are listed there.
- [ ] Merge to `main` locally with `--no-ff`. Create `/mnt/user-data/outputs/WCT-Training-RQ-round4.bundle` (from `origin/main`) and verify it.
- [ ] Write the handoff file.
- [ ] Tell the user: the push commands, that the migration runs on deploy, and to check Admin → Business units after deploy.
