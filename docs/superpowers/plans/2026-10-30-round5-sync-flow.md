# Round 5 Implementation Plan: staff sync, approval-flow admin, go-live, collapsible sidebar

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (native). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make four changes:
- Sync Microsoft 365 staff into Training RQ, nightly and on demand.
- Let L&D switch the BU Admin and HR Head steps per unit on a visual "Approval flow" tab.
- Add a one-command go-live clean-up.
- Make the desktop sidebar collapsible.

**Architecture:**
- **Route:** one pure route module (`src/lib/workflow/route.ts`) decides a unit's stages. `transition()`, recipients, the tracker, the form and the admin flow card all use it.
- **Sync:** the directory sync is a service. It pages Microsoft Graph through an injectable `fetch`, upserts in batches, and records each run in `directory_sync_runs` under a Postgres advisory lock.
- **Person picker:** the picker is a client combobox backed by a scoped server action.

**Tech Stack:** Next.js 16 App Router, React 19, Drizzle/Postgres 16, Radix, motion v12, Vitest, Playwright, bash.

**Spec:** `docs/superpowers/specs/2026-10-30-round5-sync-flow-golive-design.md`

## Global Constraints

- **Graph query:** `$filter=accountEnabled eq true and userType eq 'Member'`, `$top=999`, header `ConsistencyLevel: eventual`, `$count=true`. Follow `@odata.nextLink`.
- **Email:** `mail ?? userPrincipalName`, lower-cased. Skip the person if both are missing.
- **Users the sync never touches:** `@demo.wct.my` accounts, and `is_active=false` users.
- **Leavers:** flagged only after a complete run, never deactivated.
- **Advisory lock key:** `hashtext('trq-directory-sync')`.
- **Cron:** `POST /api/cron/directory-sync` with Bearer `CRON_SECRET`, at 01:40 nightly.
- **Step keys:** `REQUESTER`, `HOD`, `BU`, `LND`, `HR`. Each note has a 40-character maximum.
- **Default notes:**
  - "Raises the request"
  - "Department head"
  - "BU Admin review"
  - "Reviews" when HR is on, "Reviews and gives final approval" when HR is off
  - "Final approval"
- **Confirmation copy:** "New approvals for {unit} will skip the {step}. Requests already waiting there stay with them."
- **Go-live:**
  - confirmation word `GO-LIVE`
  - flag `--yes`
  - env backup `shared/.env.bak-<YYYYmmddHHMMSS>`
- **Sidebar:**
  - cookie `trq_sidebar=collapsed`
  - widths 256px and 72px
  - animation about 200ms; instant with reduced motion
- **Repo rules:**
  - Never push; deliver a bundle.
  - The repo is public: no secrets.
  - Give server commands one at a time.
  - Run `rm -rf .next/dev .next/cache` and restart the dev server after any CSS token or schema change.

## Review Focus

1. **An in-flight request at `PENDING_BU` when the BU step is turned off** must still be approvable by the BU Admin. Its tracker shows the BU step as current. Covered in Task 1 and Task 2 tests.
2. **A sync that fails midway** (network error on page 2) must flag no leavers and must not leave the lock held. Covered in Task 4.
3. **Staff list size.** A tenant of about 2,000 staff must not ship the whole user list to the browser. `searchPeople` returns at most 10 people, and the pickers never get the full list. Covered in Task 6.
4. **Running `golive` twice** must be harmless: a second run reports 0 removed, and the env file still has a single `DEMO_LOGIN=false` line. Covered in Task 7.
5. **The collapsed sidebar** must keep the approvals count readable to screen readers (`aria-label` on the dot), and the keyboard focus order must stay the same. Covered in Task 8.

---

### Task 1: Route module + BU Admin switch in the workflow

**Files:**
- Create: `src/lib/workflow/route.ts`
- Create: `drizzle/0003_bu_flow.sql`, with these columns on `business_units`:
  - `requires_bu_admin boolean not null default true`
  - `step_notes jsonb not null default '{}'::jsonb`
- Modify:
  - `src/db/schema.ts`
  - `src/lib/workflow/{types,transitions,recipients}.ts`
  - `src/lib/services/requests.ts` (loads both flags at action time; `assertBuAdmin` only when the BU step is on)
  - `src/lib/notify/payload.ts` (the `HOD_APPROVED` headline names L&D when skipping)
- Tests:
  - `tests/unit/workflow/route.test.ts`
  - `tests/unit/workflow/transitions.test.ts`
  - `tests/unit/workflow/recipients.test.ts`
  - `tests/unit/notify-payload.test.ts`
  - `tests/integration/requests.test.ts`

**Produces:**
- `type ApprovalStage = "HOD" | "BU" | "LND" | "HR"`
- `routeOf(f: { requiresBuAdmin?: boolean; requiresHrApproval?: boolean }): ApprovalStage[]`
- `nextStatusAfter(from: Status, f): Status`
- `RequestRef.requiresBuAdmin?: boolean`

**Steps:**
- [ ] Write the unit tests first:
  - `routeOf` for all four flag combinations;
  - `nextStatusAfter("PENDING_HOD", { requiresBuAdmin:false })` returns `"PENDING_LND"`;
  - an HOD approval with BU off returns `PENDING_LND` with event `HOD_APPROVED`;
  - a `PENDING_BU` request with BU off is still approvable by the BU Admin and goes to `PENDING_LND`;
  - recipients for `HOD_APPROVED` with `toStatus` `PENDING_LND`: to is the L&D members, cc is the requester plus the unit's BU Admins;
  - the payload headline with BU off reads "…approved this training request. It is now with the L&D Team for review."
- [ ] Write the integration tests:
  - "Land request with BU step off goes HOD → L&D";
  - "submit works when the unit has no BU Admin and the BU step is off".
- [ ] Watch the tests fail.
- [ ] Implement. `transition()` gets its approve targets from `nextStatusAfter`. The recipients code needs the next status, so `resolveRecipients(event, parties, toStatus?)` gains an optional `toStatus` that `performAction` passes in.
- [ ] Run `npm test`, `npm run test:integration` and the typecheck. Expect all to pass.
- [ ] Commit.

### Task 2: Route shown from one source

**Files:**
- `src/lib/services/tracker.ts`
- `src/lib/services/form-data.ts`
- `src/components/request-form/request-form.tsx`
- Tests: `tests/unit/tracker.test.ts`, `tests/e2e/full-flow.spec.ts` (panel assertion)

**Consumes:** `routeOf` (Task 1).

**Steps:**
- [ ] Write the tests first:
  - `tracker`: with BU off, an open request has the stations `submit, hod, lnd, hr, final`;
  - an in-flight `PENDING_BU` request with BU off still shows `bu` as current;
  - an approved request shows only the stages that were approved this round;
  - the form panel lists only the route's stages, in order.
- [ ] Implement:
  - `buildStations` puts together the route stations, the current stage and the stages passed this round.
  - `requesterContext` returns `route: ApprovalStage[]` in place of `requiresHrApproval` alone.
- [ ] Run the tests, then commit.

### Task 3: Approval flow admin tab

**Files:**
- Create:
  - `src/app/(app)/admin/flow/page.tsx`
  - `src/components/admin/flow-editor.tsx`
- Modify:
  - `src/lib/services/admin.ts` (`updateBusinessUnitFlow`, plus `stepNotes` defaults through `noteFor(stage, bu)`)
  - `src/app/(app)/admin/actions.ts`
  - `src/components/admin/admin-nav.tsx` (add "Approval flow" first)
  - `src/app/(app)/admin/page.tsx` (the redirect target)
  - `src/components/admin/org-editors.tsx` (remove the HR checkbox)
  - `src/app/(app)/admin/organisation/page.tsx`
- Tests:
  - `tests/integration/admin.test.ts`
  - `tests/e2e/admin-flow.spec.ts`
- Update `tests/e2e/admin-bu-dialog.spec.ts`: it tested the HR checkbox, so it now uses the Name field for its "reset on reopen" check.

**Produces:**
- `updateBusinessUnitFlow(user, buId, { requiresBuAdmin: boolean; requiresHrApproval: boolean; stepNotes: Partial<Record<StepKey,string>> })`
- `flowOverview(user)`, which returns each unit with its route, BU Admin names and resolved notes.

**Steps:**
- [ ] Write the tests first:
  - Integration: the update needs an admin; demo accounts are refused; it saves and writes an audit row; notes over 40 characters are rejected.
  - E2E: the flow tab lists E&C, Land and Malls cards, each step with its number and description; Land shows HR Head as "Skipped"; demo controls are disabled.
- [ ] Implement:
  - Each card is a numbered stepper (circle, bold name, muted description, connecting line), matching the reference image. It wraps to a vertical list below 640px.
  - The BU Admin and HR Head steps get switches, with a confirmation dialog before turning a step off.
  - An "Edit descriptions" dialog edits the notes.
- [ ] Run the tests, take screenshots in light and dark at 390 and 1440px, then commit.

### Task 4: Directory sync service

**Files:**
- Create:
  - `src/lib/services/graph.ts` (`getGraphToken(cfg, fetchFn)`, moved out of `directory.ts`)
  - `src/lib/services/directory-sync.ts`
  - `drizzle/0004_directory_sync.sql`, which adds:
    - the column `users.directory_seen_at`;
    - the table `directory_sync_runs`.
- Modify: `src/db/schema.ts`, `src/lib/services/directory.ts`
- Tests:
  - `tests/unit/directory-sync.test.ts`
  - `tests/integration/directory-sync.test.ts`

**Produces:**
- `fetchDirectoryPeople(cfg, fetchFn): Promise<DirPerson[]>`, where `DirPerson = { oid, email, name, jobTitle, department }`
- `runDirectorySync({ trigger, triggeredBy?, fetchFn? }): Promise<SyncRun>`
- `lastSyncRun(): Promise<SyncRun | null>`

**Steps:**
- [ ] Write the unit tests first, with a mocked fetch:
  - two pages joined;
  - a guest skipped (the filter is in the URL, and the code also checks `userType`);
  - the UPN used when there is no mail address;
  - a person with no email skipped;
  - the request URL and `ConsistencyLevel` header.
- [ ] Write the integration tests first:
  - new people inserted, with `last_login_at` null;
  - an existing user matched by email and given their `entra_oid`;
  - department matched, but an unknown department never clears an existing one;
  - demo and deactivated users untouched;
  - a leaver flagged only after a complete run;
  - an error on page 2 records `ok=false`, flags nobody and releases the lock;
  - a concurrent run is refused with "A sync is already running".
- [ ] Implement it with batched upserts in one transaction per 500 people, using `pg_try_advisory_lock`.
- [ ] Run the tests, then commit.

### Task 5: Sync triggers + Users page

**Files:**
- Create:
  - `src/app/api/cron/directory-sync/route.ts`
  - `src/components/admin/sync-panel.tsx`
- Modify:
  - `src/app/(app)/admin/users/page.tsx`
  - `src/lib/services/admin.ts` (`listUsers` gains a status filter and returns `lastLoginAt` and `directorySeenAt`)
  - `src/app/(app)/admin/actions.ts` (`syncNowAction`)
  - `deploy/crontab.txt`
  - `docs/DEPLOYMENT.md`
- Tests:
  - `tests/integration/directory-sync.test.ts` (the action is admin-only)
  - `tests/e2e/admin-users.spec.ts`
- Refactor the shared cron auth helper out of the notifications route.

**Steps:**
- [ ] Write the tests first:
  - the cron endpoint answers 401 without the secret;
  - the "Sync now" action refuses a demo admin;
  - E2E: the Users page shows the sync panel ("Not configured" locally), the status filter and the "Not signed in yet" badge.
- [ ] Implement, then run the tests and commit.

### Task 6: Searchable person picker

**Files:**
- Create: `src/components/admin/person-picker.tsx`
- Modify:
  - `src/lib/services/admin.ts` (`searchPeople(user, q)` replaces `userOptions`)
  - `src/app/(app)/admin/actions.ts` (`searchPeopleAction`)
  - `src/components/admin/{org-editors,role-editor}.tsx`
  - `src/app/(app)/admin/{organisation,roles}/page.tsx`
- Tests:
  - `tests/integration/admin.test.ts` (scope and limit of 10)
  - `tests/e2e/admin-picker.spec.ts`

**Produces:** `<PersonPicker onPick={(p: UserOpt) => void} exclude?: string[] placeholder disabled? />`

**Steps:**
- [ ] Write the tests first:
  - `searchPeople` returns at most 10 people, matches name or email case-insensitively, shows a demo viewer only demo people, and needs at least 2 characters;
  - E2E: typing "Ha" in the BU Admins picker (demo L&D) lists Hafiz Osman, and the arrow keys and Enter select him.
- [ ] Implement the ARIA combobox (input, listbox and options with `aria-activedescendant`) with a 200ms debounce.
- [ ] Run the tests, then commit.

### Task 7: Go-live command

**Files:**
- `scripts/demo-data.sh` (`golive [--yes]`)
- Create: `tests/scripts/golive.test.sh`, plus an `npm run test:scripts` entry in `package.json`
- `docs/DEPLOYMENT.md`

**Steps:**
- [ ] Write the script test first. It:
  - makes a temporary `APP_ROOT` containing `shared/.env` (`DEMO_LOGIN=true`, test `DATABASE_URL`, `UPLOAD_DIR`) and `current` linked to the repo;
  - stubs `pm2` on the `PATH`;
  - seeds demo data into the test database;
  - runs `golive --yes`;
  - asserts there are 0 demo users, `DEMO_LOGIN=false` appears once, a `.env.bak-*` file exists and the stub `pm2` was called with `reload`;
  - runs it a second time and asserts the same results (no duplicate line);
  - runs it without `--yes`, answers "no", and asserts the exit code is non-zero with nothing removed.
- [ ] Implement. The `pm2` command can be overridden with `PM2_BIN`.
- [ ] Run the tests, then commit.

### Task 8: Collapsible sidebar

**Files:**
- `src/app/(app)/layout.tsx` (reads the cookie)
- `src/components/shell/{app-shell,nav,wordmark}.tsx`
- Create: `src/components/shell/sidebar-toggle.tsx`
- `src/app/globals.css` (the width transition)
- Test: `tests/e2e/sidebar.spec.ts`

**Steps:**
- [ ] Write the E2E tests first:
  - clicking "Collapse sidebar" makes the rail about 72px wide and hides the nav labels; hovering over "Approvals" shows a tooltip;
  - after a reload the rail is still collapsed (the cookie works);
  - the approvals dot has the `aria-label` "2 awaiting your action";
  - "Expand sidebar" restores the rail.
- [ ] Implement, then run the tests, take screenshots and commit.

### Task 9: Verification and handoff

- [ ] Run everything: lint, typecheck, unit, integration, the script test, all E2E tests, the contrast check and the build.
- [ ] Take screenshots: the flow tab, the Users page with its sync panel and the collapsed sidebar, each in light and dark at 390 and 1440px.
- [ ] Have a fresh reviewer (opus) review the whole branch, then do one fix pass.
- [ ] Update `DESIGN.md` (stepper, picker, collapsed rail), USER_GUIDE (the flow tab, sync and pickers) and DEPLOYMENT (cron line, go-live, first sync check).
- [ ] Merge into `main` locally, create the bundle, write the handoff, and give the user the server commands one at a time: add the cron line, check `DIRECTORY_SEARCH_GRAPH`, run the first "Sync now", and know the go-live command for when they're ready.
