# WCT Training RQ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the WCT Training Requisition web system (form, 3-stage approval workflow with send-back, history, PDF, reports, admin), deployable at `https://hrforms.wct.my/WCT-Training-RQ/`.

**Architecture:** One Next.js 16 App Router application with `basePath: "/WCT-Training-RQ"`. Business rules live in a pure, unit-tested workflow module (`src/lib/workflow`). DB-touching services (`src/lib/services`) wrap them in Prisma transactions. Pages and server actions stay thin. Notifications go to a Power Automate HTTP flow and are logged and retried.

**Tech Stack:** Next.js 16.4, React 19, TypeScript, Tailwind CSS 4 + shadcn/ui, Auth.js (`next-auth@5.0.0-beta.32`, Microsoft Entra ID provider), Prisma 7.10 + `@prisma/adapter-pg` + PostgreSQL 16, Zod 4, `@react-pdf/renderer` 4, `exceljs` 4, Recharts 3, Vitest, Playwright, PM2, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-13-wct-training-rq-design.md`

## Global Constraints

- Base path `/WCT-Training-RQ`; every link, redirect, asset, and notification URL must include it. `APP_URL=https://hrforms.wct.my/WCT-Training-RQ`.
- The repo is public, so no secrets are committed. All config comes from env vars, listed in `.env.example`.
- Statuses: `DRAFT, PENDING_HOD, PENDING_LND, PENDING_HR, RETURNED, APPROVED, CANCELLED`.
- Roles in DB: `LND, HR_HEAD, SYS_ADMIN`. HOD comes from `Department.hodUserId`, BU Admin from `BusinessUnitAdmin`.
- BU codes seeded: `LAND` "Land", `ENC` "E&C", `MALLS` "Malls".
- Ref no format `TRQ-YYYY-NNNN` (4-digit zero-padded, yearly sequence), allocated at first submit.
- Candidates 1–8, no duplicates (by email if present, else by case-insensitive name).
- Attachments ≤ 5 per request, ≤ 10 MB each; types pdf, docx, xlsx, png, jpg/jpeg.
- Reject and cancel need a remark, trimmed and at least 3 characters.
- The BU Admin is always notified on every rejection, on final approval, and on cancel.
- The PDF header reads exactly: "WCT BERHAD", "TRAINING REQUISITION FORM", "Ref No: WCT-F-4.18-2", "Revision: REV2", "Date: 20/03/2024"; the footer reads "WCT BERHAD • Quality Management System", "Ref: WCT-F-4.18-2 (REV2)".
- Dev sign-in only when `NODE_ENV !== "production" && AUTH_DEV_LOGIN === "true"`.
- Timezone for display: `Asia/Kuala_Lumpur`; dates are displayed as `dd/MM/yyyy`.
- Currency: MYR, 2 decimal places, stored as `Decimal(12,2)`.

## Review Focus

1. **Requester's department has no HOD configured.** Submit must be refused with "Your department has no HOD assigned. Please contact HR." and leave the request a draft (Task 6 test).
2. **Signed-in user has no department** (Entra department string unmatched). The form forces a department pick, and submit is refused without one (Task 6 test, Task 11 UI).
3. **Two approvers act at once** (for example, two L&D members). The second action is refused with a stale-version error naming who acted, and no second audit row is written (Task 6 test).
4. **Approver mapping changes while a request is pending** (a new HOD is assigned). The new HOD sees it in their inbox and can act; the old HOD no longer can (Task 3 and Task 6 tests).
5. **Insecure direct object reference (IDOR) and file safety.** A user opening another department's request ID or attachment ID gets 404. An uploaded filename like `../../etc/passwd.pdf` is stored under a UUID and served with a sanitised download name (Task 3 `canView` test, Task 9 test).

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `vitest.config.ts`, `eslint.config.mjs`, `.gitignore`, `.env.example`, `components.json`, `src/lib/utils.ts`, `src/lib/env.ts`
- Test: `tests/unit/env.test.ts`

**Interfaces:**
- Produces: `cn(...classes)` in `src/lib/utils.ts`; `env` object (`src/lib/env.ts`) exposing `APP_URL`, `DATABASE_URL`, `AUTH_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_ID/SECRET/ISSUER`, `GRAPH_TENANT_ID`, `POWER_AUTOMATE_FLOW_URL?`, `CRON_SECRET`, `UPLOAD_DIR`, `BOOTSTRAP_ADMIN_EMAILS: string[]`, `isDevLoginEnabled(): boolean`, `BASE_PATH = "/WCT-Training-RQ"`.

- [ ] Step 1: Write test `isDevLoginEnabled` → true only when NODE_ENV=development and AUTH_DEV_LOGIN=true; false in production even when the flag is true. `BOOTSTRAP_ADMIN_EMAILS="A@x.my, b@x.my"` → `["a@x.my","b@x.my"]`.
- [ ] Step 2: Run `npx vitest run tests/unit/env.test.ts`. Expected: FAIL (module missing).
- [ ] Step 3: Scaffold Next 16 (TS, App Router, `src/`), Tailwind 4, shadcn init (neutral base, CSS variables); `next.config.ts` sets `basePath`, `output: "standalone"` off, `serverExternalPackages: ["@react-pdf/renderer"]`; implement `env.ts` with Zod parsing (lazy, so builds work without secrets).
- [ ] Step 4: Run tests and `npm run build`. Expected: PASS, build succeeds.
- [ ] Step 5: Commit `chore: scaffold Next.js app with basePath`.

### Task 2: Database schema and seed

**Files:**
- Create: `prisma/schema.prisma`, `prisma.config.ts`, `prisma/seed.ts`, `src/lib/db.ts`, `tests/integration/setup.ts`, `vitest.integration.config.ts`
- Test: `tests/integration/seed.test.ts`

**Interfaces:**
- Produces: `prisma` singleton from `src/lib/db.ts` (Prisma 7 `prisma-client` generator, output `src/generated/prisma`, `PrismaPg` adapter). Models exactly as spec §6.1. Enums `RequestStatus`, `TrainingType {PLANNED, ADHOC}`, `RoleName {LND, HR_HEAD, SYS_ADMIN}`, `ActionType {CREATE, SUBMIT, RESUBMIT, APPROVE, REJECT, CANCEL, COMMENT, EDIT_LND_FIELDS}`, `NotificationStatus {PENDING, SENT, FAILED}`. `resetDb()` test helper (truncate all tables) in `tests/integration/setup.ts`.
- Seed: 3 BUs; departments (Land: "Land – Project Management", "Land – Sales & Marketing"; E&C: "E&C – Engineering", "E&C – QS & Contracts"; Malls: "Malls – Operations", "Malls – Leasing"; plus "Group HR & Admin" under E&C). With `SEED_DEMO=true`, 8 demo users (requester, hod-land, hod-enc, hod-malls, lnd1, lnd2, hrhead, buadmin-land/enc/malls, admin) with emails `*@demo.wct.my`.

- [ ] Step 1: Write integration test: after `seed()`, 3 BUs exist with codes `LAND, ENC, MALLS`; running `seed()` twice is idempotent (counts unchanged).
- [ ] Step 2: Start Postgres (`docker run postgres:16` or local), run `npx vitest run -c vitest.integration.config.ts`. Expected: FAIL.
- [ ] Step 3: Write schema, `prisma migrate dev --name init`, seed with upserts.
- [ ] Step 4: Run integration tests. Expected: PASS.
- [ ] Step 5: Commit `feat(db): prisma schema, migration and seed`.

### Task 3: Workflow engine (pure)

**Files:**
- Create: `src/lib/workflow/types.ts`, `src/lib/workflow/permissions.ts`, `src/lib/workflow/transitions.ts`, `src/lib/workflow/recipients.ts`, `src/lib/workflow/index.ts`
- Test: `tests/unit/workflow/transitions.test.ts`, `permissions.test.ts`, `recipients.test.ts`

**Interfaces:**
- Produces:
  - `type Status`, `type Stage = "REQUESTER"|"HOD"|"LND"|"HR"`, `type NotifyTarget = "REQUESTER"|"HOD"|"LND"`
  - `interface Actor { id: string; roles: ("LND"|"HR_HEAD"|"SYS_ADMIN")[]; hodDepartmentIds: string[]; buAdminBusinessUnitIds: string[] }`
  - `interface RequestRef { status: Status; requesterId: string; departmentId: string; businessUnitId: string }`
  - `interface RoleHolderCounts { lnd: number; hrHead: number }` (active holders)
  - `canView(req, actor): boolean` (requester; HOD of dept; BU Admin of BU; LND/HR_HEAD/SYS_ADMIN all)
  - `canEditContent(req, actor): boolean` (requester and status ∈ {DRAFT, RETURNED})
  - `canEditLndFields(req, actor): boolean` (LND and status PENDING_LND)
  - `getAllowedActions(req, actor, counts): AllowedAction[]` where `AllowedAction = { type: "SUBMIT"|"RESUBMIT"|"APPROVE"|"REJECT"|"CANCEL"; sendBackOptions?: Stage[] }`
  - `transition(req, actor, input: { type; remark?: string; sendBackTo?: Stage; notify?: NotifyTarget[] }, counts): TransitionResult` → `{ toStatus: Status; selfApproved: boolean; event: WorkflowEvent }`; throws `WorkflowError(code: "FORBIDDEN"|"INVALID_STATE"|"REMARK_REQUIRED"|"INVALID_SEND_BACK")`
  - `type WorkflowEvent = { kind: "SUBMITTED"|"RESUBMITTED"|"HOD_APPROVED"|"LND_APPROVED"|"FINAL_APPROVED"|"REJECTED"|"CANCELLED"|"COMMENTED"; fromStatus: Status; sentBackTo?: Stage; notify?: NotifyTarget[]; actorId: string }`
  - `interface Person { id: string; name: string; email: string }`; `interface Parties { requester: Person; hod: Person|null; lnd: Person[]; hrHeads: Person[]; buAdmins: Person[] }`
  - `resolveRecipients(event, parties): { to: Person[]; cc: Person[] }` (deduped by email, actor excluded from `to`)
  - `stageOf(status): Stage|null`, `STAGE_LABEL`, `STATUS_LABEL`

- [ ] Step 1: Write transition tests:
  - DRAFT+SUBMIT by requester → PENDING_HOD, event SUBMITTED; by a non-requester → FORBIDDEN.
  - PENDING_HOD+APPROVE by HOD of the request's dept → PENDING_LND; by the HOD of another dept → FORBIDDEN. After `hodDepartmentIds` changes to the new HOD, the old one gets FORBIDDEN (Review Focus 4).
  - PENDING_HOD+REJECT with remark "  " → REMARK_REQUIRED; with a remark → RETURNED, sentBackTo REQUESTER; HOD `sendBackTo:"LND"` → INVALID_SEND_BACK.
  - PENDING_LND REJECT sendBackOptions = [REQUESTER, HOD]; sendBackTo HOD → PENDING_HOD.
  - PENDING_HR REJECT sendBackOptions = [REQUESTER, HOD, LND]; LND → PENDING_LND; HOD → PENDING_HOD; REQUESTER → RETURNED.
  - PENDING_HR APPROVE by HR_HEAD → APPROVED, event FINAL_APPROVED.
  - RETURNED RESUBMIT by requester → PENDING_HOD.
  - CANCEL allowed from DRAFT/PENDING_*/RETURNED by the requester with a remark; from APPROVED → INVALID_STATE.
  - Self-approval: the requester is LND with counts.lnd=2 → APPROVE not in allowed actions; with counts.lnd=1 → allowed and `selfApproved=true`. The requester as HOD of own dept → allowed, `selfApproved=true`.
  - SYS_ADMIN alone cannot approve any stage.
- [ ] Step 2: Write permission tests: `canView` true for requester, dept HOD, BU Admin of same BU, LND, HR_HEAD, SYS_ADMIN; false for the HOD of another dept, the BU Admin of another BU, and an unrelated staff member (Review Focus 5).
- [ ] Step 3: Write recipient tests:
  - SUBMITTED → to [hod], cc [requester].
  - HOD_APPROVED → to lnd ∪ buAdmins, cc [requester].
  - LND_APPROVED → to hrHeads, cc [requester].
  - FINAL_APPROVED → to [requester], cc [hod, ...lnd, ...buAdmins].
  - REJECTED by HR sendBackTo LND with notify [REQUESTER] → to includes lnd (target owner, locked), requester, and buAdmins always.
  - REJECTED by HOD → to [requester] ∪ buAdmins.
  - CANCELLED from PENDING_LND → to lnd ∪ buAdmins.
  - COMMENTED → requester + current stage owners, minus the actor.
  - Duplicate emails are removed.
- [ ] Step 4: Run `npx vitest run tests/unit/workflow`. Expected: FAIL.
- [ ] Step 5: Implement the modules as a transition table keyed by status.
- [ ] Step 6: Run tests. Expected: PASS.
- [ ] Step 7: Commit `feat(workflow): pure state machine, permissions and recipients`.

### Task 4: Validation schemas and formatters

**Files:**
- Create: `src/lib/validation/request.ts`, `src/lib/format.ts`
- Test: `tests/unit/validation.test.ts`, `tests/unit/format.test.ts`

**Interfaces:**
- Produces: `requestFormSchema` (Zod) with fields `trainingType, title(≤200), objective(≤2000), startDate, endDate(≥start), startTime, endTime(HH:mm), feePerPax(≥0, ≤2dp), venue, conductedBy, candidates(1..8, {name, email?, jobTitle?, department?, staffNo?, userId?})`; `draftSchema` = same with all optional except title; `actionSchema` `{ requestId, version:int, type, remark?, sendBackTo?, notify? }`; `lndFieldsSchema {hrdcClaimable?:boolean, hrdcGrantNo?:string≤50, lndRemarks?:string≤1000}`.
- `formatRefNo(year, n) → "TRQ-2026-0007"`; `formatMYR(value) → "RM 1,250.00"`; `totalFees(feePerPax, count)` using integer cents; `formatDateMY(date) → "13/10/2026"` in Asia/Kuala_Lumpur.

- [ ] Step 1: Tests:
  - Duplicate candidate emails → error "Duplicate candidate"; 9 candidates → error; endDate < startDate → error on `endDate`.
  - `feePerPax` 10.555 → error.
  - `totalFees("1250.50", 3) === "3751.50"`; `formatRefNo(2026, 7) === "TRQ-2026-0007"`.
- [ ] Step 2: Run. Expected: FAIL. Step 3: Implement. Step 4: Run. Expected: PASS.
- [ ] Step 5: Commit `feat: request validation and formatters`.

### Task 5: Authentication and current user

**Files:**
- Create: `src/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/proxy.ts`, `src/lib/auth/current-user.ts`, `src/lib/auth/sync-user.ts`, `src/app/signin/page.tsx`, `src/app/dev-login/page.tsx`
- Test: `tests/integration/sync-user.test.ts`

**Interfaces:**
- Consumes: `prisma`, `env`.
- Produces:
  - `auth()`, `signIn`, `signOut` from `src/auth.ts` (Entra provider single-tenant; Credentials provider "dev" registered only when `isDevLoginEnabled()`; JWT session carrying `userId`).
  - `syncUserFromProfile({ oid, email, name, jobTitle?, department? }): Promise<User>` (upsert by oid; email lowercased; department matched case-insensitively to `Department.name`; never overwrites an admin-set department with null; grants SYS_ADMIN if the email is in `BOOTSTRAP_ADMIN_EMAILS`).
  - `getCurrentUser(): Promise<CurrentUser|null>`, `requireUser(): Promise<CurrentUser>` (redirects to `/signin`), `requireRole(role)`, where `CurrentUser = User & { actor: Actor; department: Department|null; businessUnit: BusinessUnit|null }`.
  - `proxy.ts` protects everything except `/signin`, `/dev-login`, `/api/auth/*`, `/api/cron/*`, and static assets.
- [ ] Step 1: Tests: a first sync creates the user and matches the "land – project management" department case-insensitively; a re-sync with department undefined keeps the existing department; a bootstrap email gets SYS_ADMIN once (no duplicate row on second sync).
- [ ] Step 2: Run. Expected: FAIL. Step 3: Implement. Step 4: Run. Expected: PASS. Also run `npm run build`.
- [ ] Step 5: Commit `feat(auth): Entra ID sign-in, dev login, user sync`.

### Task 6: Request service

**Files:**
- Create: `src/lib/services/requests.ts`, `src/lib/services/parties.ts`, `src/lib/services/queries.ts`, `src/lib/services/ref-no.ts`
- Test: `tests/integration/requests.test.ts`

**Interfaces:**
- Consumes: workflow (Task 3), schemas (Task 4), `prisma`, `CurrentUser`.
- Produces:
  - `createDraft(user, data): Promise<{id}>`, `updateContent(user, id, version, data): Promise<void>` (DRAFT/RETURNED only)
  - `performAction(user, input: ActionInput): Promise<{ status; refNo }>`: in one transaction, loads the request with `FOR UPDATE` semantics via `updateMany where {id, version}`; validates with `requestFormSchema` for SUBMIT/RESUBMIT; requires a department and a dept HOD; allocates the ref no on first submit; writes a revision on RESUBMIT (snapshot of the previous content) and on the first SUBMIT (rev 1); writes `RequestAction`; increments `version`; then (after commit) calls `notifyEvent(event, requestId)` (Task 7; injected so tests can stub).
  - `updateLndFields(user, id, version, data)`, `addComment(user, id, body)`, `cloneRequest(user, id): Promise<{id}>`
  - `loadParties(tx, request): Promise<Parties>` (current mappings at event time)
  - `allocateRefNo(tx, year): Promise<string>` (upsert `RefCounter` with an atomic increment)
  - `visibleRequestsWhere(user): Prisma.TrainingRequestWhereInput`; `awaitingActionWhere(user)`; `getRequestForUser(user, id)` (null when `!canView`, so routes 404)
  - `StaleVersionError(actedByName)`, `NoHodError`, `NoDepartmentError` (messages from Review Focus 1 and 2).
- [ ] Step 1: Integration tests (seeded demo users):
  - Full happy path ends APPROVED with 4 actions and ref `TRQ-<year>-0001`; a second request gets `-0002`.
  - HR send back to LND → PENDING_LND; LND approve → PENDING_HR again.
  - RETURNED → updateContent → RESUBMIT creates revision 2 and status PENDING_HOD.
  - Concurrent: two `performAction` calls with the same version → one succeeds, the other throws `StaleVersionError` naming the first actor, and exactly 1 APPROVE row exists (Review Focus 3).
  - Dept without HOD → `NoHodError`, still DRAFT (Review Focus 1). User without department → `NoDepartmentError` (Review Focus 2).
  - HOD reassigned while PENDING_HOD → the new HOD's `awaitingActionWhere` includes it, and the old HOD's action → FORBIDDEN (Review Focus 4).
  - `getRequestForUser` for a staff member of another dept → null.
  - Ten parallel `allocateRefNo` → 10 distinct numbers.
- [ ] Step 2: Run. Expected: FAIL. Step 3: Implement. Step 4: Run. Expected: PASS.
- [ ] Step 5: Commit `feat: request service with transactional workflow`.

### Task 7: Notifications (Power Automate)

**Files:**
- Create: `src/lib/notify/payload.ts`, `src/lib/notify/send.ts`, `src/app/api/cron/notifications/route.ts`
- Test: `tests/unit/notify-payload.test.ts`, `tests/integration/notify.test.ts`

**Interfaces:**
- Produces:
  - `buildPayload(event, request, parties, actor): NotificationPayload` = `{ event, refNo, title, status, statusLabel, requester:{name,email}, actor:{name,email}, remark, to:string[], cc:string[], subject, messageHtml, link }`. Subject is `"[Training RQ] <refNo> – <Event label>: <title>"`; link is `${APP_URL}/requests/${id}`.
  - `notifyEvent(event, requestId): Promise<void>` (creates a NotificationLog PENDING, then `deliver(logId)`; never throws)
  - `deliver(logId)`: POSTs JSON with a 10 s timeout; SENT on 2xx, FAILED + attempts++ + lastError otherwise. If `POWER_AUTOMATE_FLOW_URL` is unset, marks FAILED with "Flow URL not configured".
  - `retryFailed(): Promise<number>` retries FAILED with attempts < 3 and updatedAt older than 5 min. The cron route requires header `Authorization: Bearer ${CRON_SECRET}` (401 otherwise).
- [ ] Step 1: Tests:
  - The payload link equals `https://hrforms.wct.my/WCT-Training-RQ/requests/abc`.
  - The subject format matches; `messageHtml` escapes `<script>` in title and remark.
  - A mocked fetch 500 → log FAILED, attempts 1; a retry with a 200 → SENT.
  - The cron route without the secret → 401.
- [ ] Step 2: Run. Expected: FAIL. Step 3: Implement. Step 4: Run. Expected: PASS.
- [ ] Step 5: Commit `feat: Power Automate notifications with logging and retry`.

### Task 8: Directory search (Microsoft Graph, app-only)

**Files:**
- Create: `src/lib/services/directory.ts`, `src/app/api/directory/route.ts`
- Test: `tests/unit/directory.test.ts`

**Interfaces:**
- Produces: `searchDirectory(q: string): Promise<DirectoryPerson[]>` with `DirectoryPerson {id, name, email, jobTitle?, department?}`. Client-credentials token cached until 60 s before expiry. Uses `GET /v1.0/users?$search="displayName:q" OR "mail:q"&$top=10` with `ConsistencyLevel: eventual`, filtered to accounts that have a mail. Falls back to the local `User` table if Graph is not configured or errors. The route returns `{ people, source: "graph"|"local" }`; `q` must be at least 2 characters.
- [ ] Step 1: Tests: the token is fetched once for two searches; a Graph 503 → falls back to local users with source "local"; q "a" → [].
- [ ] Step 2–4: fail → implement → pass. Step 5: Commit `feat: M365 directory people search`.

### Task 9: Attachments

**Files:**
- Create: `src/lib/services/attachments.ts`, `src/app/api/requests/[id]/attachments/route.ts` (POST), `src/app/api/attachments/[attachmentId]/route.ts` (GET, DELETE)
- Test: `tests/unit/attachments.test.ts`, `tests/integration/attachments.test.ts`

**Interfaces:**
- Produces: `validateUpload({name, size, type}, existingCount)` → error string or null; `sanitizeFilename(name)` (basename only, strips control chars and path separators, max 120 characters); `saveAttachment(user, requestId, file)`; `readAttachment(user, attachmentId)` (null when `!canView`); `deleteAttachment` (requester only, while content is editable).
- [ ] Step 1: Tests:
  - `sanitizeFilename("../../etc/passwd.pdf") === "passwd.pdf"`.
  - An 11 MB file → "File exceeds 10 MB"; `.exe` → "File type not allowed"; a 6th file → "Maximum 5 attachments".
  - Another dept's user reading → null (Review Focus 5); the stored file name is a UUID.
- [ ] Step 2–4: fail → implement → pass. Step 5: Commit `feat: request attachments`.

### Task 10: App shell and dashboard

**Design skills:** apply `anthropic-skills:impeccable` / `ui-ux-pro-max` guidance and `modern-web-guidance` before writing UI.

**Files:**
- Create: `src/app/(app)/layout.tsx`, `src/components/shell/sidebar.tsx`, `topbar.tsx`, `user-menu.tsx`, `theme-toggle.tsx`, `src/components/status-badge.tsx`, `src/app/(app)/dashboard/page.tsx`, `src/lib/services/dashboard.ts`, shadcn components (button, card, badge, input, textarea, select, dialog, dropdown-menu, table, tabs, sonner, checkbox, radio-group, label, separator, skeleton, avatar, tooltip, popover, command, sheet)
- Test: `tests/integration/dashboard.test.ts`

**Interfaces:**
- Produces: `getDashboard(user)` → `{ myOpen, awaitingMe, approvedThisYear, feesThisYear, awaitingList(5), recentActivity(8) }`; `<StatusBadge status>`. Navigation: Dashboard, New Request, My Requests, Approvals (badge), History, Reports (role-gated), Admin (SYS_ADMIN).
- Visual: WCT navy primary (`oklch` navy ~ `#1e3a5f`), slate neutrals, Inter font, cards with soft borders, light and dark themes, responsive sidebar that becomes a sheet on mobile.
- [ ] Step 1: Test: `getDashboard` for an HOD with 2 pending dept requests → awaitingMe 2.
- [ ] Step 2–4: fail → implement → pass; `npm run build` OK.
- [ ] Step 5: Commit `feat(ui): app shell and dashboard`.

### Task 11: Request form (new / edit / clone)

**Files:**
- Create: `src/app/(app)/requests/new/page.tsx`, `src/app/(app)/requests/[id]/edit/page.tsx`, `src/components/request-form/request-form.tsx`, `candidate-picker.tsx`, `attachment-field.tsx`, `department-picker.tsx`, `src/app/(app)/requests/actions.ts` (server actions `saveDraftAction`, `submitAction`, `cloneAction`, `setMyDepartmentAction`)
- Test: covered by e2e (Task 17); server actions call the Task 6 services.
- [ ] Step 1: Build the form with four sections mirroring the paper form, a live fee total, a candidate picker (debounced `/api/directory`, manual entry fallback, max 8), a review dialog before submit, and a mandatory department picker when the user has none.
- [ ] Step 2: Verify manually in dev with dev login: create a draft, edit, submit; validation messages show inline.
- [ ] Step 3: Commit `feat(ui): request form`.

### Task 12: Request detail

**Files:**
- Create: `src/app/(app)/requests/[id]/page.tsx`, `src/components/request-detail/progress-tracker.tsx`, `timeline.tsx`, `action-panel.tsx`, `reject-dialog.tsx`, `comments.tsx`, `lnd-fields.tsx`, `revisions.tsx`, server actions `performActionServer`, `updateLndFieldsAction`, `addCommentAction`
- [ ] Step 1: Implement. The progress tracker uses 5 steps, with the current step pulsing and returned/sent-back steps shown amber. The reject dialog has a send-back radio (from `sendBackOptions`) and notify checkboxes (the target owner is checked and disabled; "Business Unit Admin – always notified" is shown checked and disabled), plus a required remark. The page 404s via `notFound()` when `getRequestForUser` returns null.
- [ ] Step 2: Verify in dev: each role sees only its allowed buttons; a stale action shows a toast with the actor name.
- [ ] Step 3: Commit `feat(ui): request detail, tracker, timeline, actions`.

### Task 13: Lists, history and Excel export

**Files:**
- Create: `src/app/(app)/my-requests/page.tsx`, `src/app/(app)/approvals/page.tsx`, `src/app/(app)/history/page.tsx`, `src/components/requests-table.tsx`, `src/components/history-filters.tsx`, `src/lib/services/history.ts`, `src/app/api/export/history/route.ts`
- Test: `tests/integration/history.test.ts`

**Interfaces:**
- Produces: `searchHistory(user, filters: { q?, status?, buId?, departmentId?, type?, from?, to?, hrdc?, page=1, pageSize=20, sort="updatedAt", dir="desc" }) → { rows, total }`. `q` matches refNo/title/requester name/candidate name/conductedBy (case-insensitive). Results are always intersected with `visibleRequestsWhere`. `exportHistoryXlsx(user, filters) → Buffer` (one row per request, plus a "Candidates" sheet with one row per candidate).
- [ ] Step 1: Tests: q = a candidate name finds the request; a user from another BU doesn't see it; the export has headers `Ref No, Status, Requester, Department, Business Unit, Type, Title, Start, End, Fee/Pax, Candidates, Total Fees, HRD Corp, Submitted, Finalised`.
- [ ] Step 2–4: fail → implement → pass. Step 5: Commit `feat: history search and Excel export`.

### Task 14: PDF generation

**Files:**
- Create: `src/lib/pdf/training-rq-document.tsx`, `src/lib/pdf/render.ts`, `src/app/api/requests/[id]/pdf/route.ts`
- Test: `tests/unit/pdf.test.ts`

**Interfaces:**
- Produces: `renderRequestPdf(data: PdfData): Promise<Buffer>` where `PdfData` holds the request, candidates, actions, and parties' names. The layout mirrors the uploaded form: the header box (exact strings from Global Constraints) plus the system Ref No; Sections 1–4; an 8-row candidate grid (2 columns × 4); Section 4 with "Requested by", then the HOD / L&D / HR Head approval blocks (name, decision, date, remark); the L&D fields; the footer; and a diagonal "NOT FINAL – <status>" watermark unless APPROVED. The route returns `Content-Disposition: inline; filename="<refNo|draft>.pdf"`, with 404 if not visible.
- [ ] Step 1: Test: render returns a Buffer starting with `%PDF`; the extracted text (via `pdf-parse` dev dependency) contains "TRAINING REQUISITION FORM", "WCT-F-4.18-2" and the candidate names; a non-approved request contains "NOT FINAL".
- [ ] Step 2–4: fail → implement → pass. Step 5: Commit `feat: printable PDF based on WCT-F-4.18-2`.

### Task 15: Reports

**Files:**
- Create: `src/app/(app)/reports/page.tsx`, `src/lib/services/reports.ts`, `src/components/reports/*.tsx`, `src/app/api/export/reports/route.ts`
- Test: `tests/integration/reports.test.ts`

**Interfaces:**
- Produces: `getReports(user, { year }) → { byMonth: {month, count, fees}[12], byBU: {bu, count, fees}[], byDepartment: {...}[], byType: {PLANNED, ADHOC}, turnaround: {stage, avgHours}[], statusCounts }`. Fees count APPROVED requests only (fee × candidates). BU Admins are limited to their BU; LND/HR_HEAD/SYS_ADMIN see everything; others are forbidden.
- [ ] Step 1: Test: two approved requests (LAND 2×RM100, MALLS 1×RM50) → byBU LAND fees 200, MALLS 50; a LAND BU admin sees only LAND.
- [ ] Step 2–4: fail → implement → pass (apply the `dataviz` skill for charts). Step 5: Commit `feat: reports and export`.

### Task 16: Admin

**Files:**
- Create: `src/app/(app)/admin/layout.tsx`, `admin/business-units/page.tsx`, `admin/departments/page.tsx`, `admin/roles/page.tsx`, `admin/users/page.tsx`, `admin/notifications/page.tsx`, `admin/audit/page.tsx`, `src/lib/services/admin.ts`, `src/app/(app)/admin/actions.ts`
- Test: `tests/integration/admin.test.ts`

**Interfaces:**
- Produces: `upsertBusinessUnit`, `setBusinessUnitAdmins(buId, userIds)`, `upsertDepartment({id?, name, businessUnitId, hodUserId?, isActive})`, `assignRole(userId, role)`, `revokeRole(userId, role)`, `updateUser(userId, {departmentId?, isActive?})`. Every function calls `requireRole("SYS_ADMIN")` and writes an `AdminAuditLog`. Revoking your own last SYS_ADMIN is refused. Notification log page with a "Retry" button calling `deliver`.
- [ ] Step 1: Tests: a non-admin call throws FORBIDDEN; each change writes an audit row; self-revoking the last admin is refused.
- [ ] Step 2–4: fail → implement → pass. Step 5: Commit `feat: admin settings`.

### Task 17: End-to-end test

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/full-flow.spec.ts`, `tests/e2e/helpers.ts`
- [ ] Step 1: Write a spec using dev login:
  1. The requester (Land dept) creates and submits.
  2. The Land HOD approves.
  3. lnd1 rejects, sending back to the requester with notify [HOD]; the timeline shows the BU Admin notified.
  4. The requester edits and resubmits.
  5. The HOD approves, lnd1 approves, and hrhead approves → "Approved".
  6. The PDF request returns 200 `application/pdf`.
  7. History search by candidate finds it.

  Mock the Power Automate URL with a local route (`POWER_AUTOMATE_FLOW_URL=http://localhost:3010/WCT-Training-RQ/api/dev/flow-sink`, dev only).
- [ ] Step 2: Run `npx playwright test`. Expected: PASS.
- [ ] Step 3: Commit `test: end-to-end approval flow`.

### Task 18: Deployment and documentation

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `scripts/deploy.sh`, `scripts/backup.sh`, `ecosystem.config.cjs`, `deploy/nginx-wct-training-rq.conf`, `deploy/crontab.txt`, `README.md`, `docs/DEPLOYMENT.md`, `docs/POWER_AUTOMATE.md`, `docs/ENTRA_SETUP.md`, `docs/USER_GUIDE.md`
- [ ] Step 1: CI: Node 22, a Postgres 16 service, `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:integration`, `npm run build`. Deploy runs on push to main after CI passes, using `appleboy/ssh-action` with secrets `DEPLOY_HOST, DEPLOY_PORT, DEPLOY_USER, DEPLOY_SSH_KEY` to run `/opt/wct-training-rq/scripts/deploy.sh`.
- [ ] Step 2: `deploy.sh`: `set -euo pipefail`; git fetch/reset to origin/main; `npm ci`; `npx prisma migrate deploy`; build into `.next-build` with `NEXT_DIST_DIR`, then atomically swap to `.next` on success; `pm2 reload ecosystem.config.cjs --update-env`; health check `curl -fsS http://127.0.0.1:3010/WCT-Training-RQ/api/health` (add that route returning `{ok:true, db:true}`).
- [ ] Step 3: Docs: server setup from scratch (Node 22, PostgreSQL 16, PM2, Nginx location, certbot already present, deploy user, directories, `.env`), the Entra app registration, a step-by-step Power Automate flow (HTTP trigger with JSON schema → Send an email (V2) → optional Post message in Teams), and a user guide.
- [ ] Step 4: Run `bash -n scripts/*.sh`, `npx actionlint` if available, and the full test suite plus build.
- [ ] Step 5: Commit `ci: GitHub Actions CI/CD and deployment docs`.
