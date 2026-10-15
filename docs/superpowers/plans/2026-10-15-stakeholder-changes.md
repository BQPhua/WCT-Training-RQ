# Stakeholder Changes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the BU Admin approval step, make every rejection return to the requester, slim the request form (manual names or an Excel name list, Relevancy), add a per-request Excel export, move analytics to the dashboard, and add an admin-only "View as demo user".

**Architecture:**
- The pure workflow module (`src/lib/workflow`) gains a `BU` stage and loses send-back choices.
- Services enforce the BU-Admin guard and compute round approvers for rejection emails.
- One additive Drizzle migration adds the enum value and three columns.
- UI changes follow existing components. View-as lives in the iron-session cookie and is resolved in `getCurrentUser`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Drizzle + PostgreSQL, zod 4, iron-session, @react-pdf/renderer, exceljs, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-15-stakeholder-changes-design.md`

## Global Constraints

- **Status:** new status value `PENDING_BU`, placed between `PENDING_HOD` and `PENDING_LND`. Stage `BU`, labels "Pending BU Admin" / "BU Admin". New event `BU_APPROVED` = "Approved by BU Admin".
- **Reject:** always `RETURNED`; remark ≥ 3 characters. Resubmit → `PENDING_HOD`. `sendBackTo`/`notify` are removed from the inputs, and `sent_back_to` is written as `REQUESTER`.
- **No-BU-Admin error copy:** "Your business unit ({BU name}) has no BU Admin assigned. Please contact HR."
- **Labels:**
  - "New Training Requisition"
  - "Training RQ History"
  - "Training Dates"
  - "From (Requester)" / "FROM (REQUESTER)"
  - "In progress"
- **Removed copy:**
  - "WCT-F-4.18-2 (REV2)" on the web new/edit pages and the sign-in page
  - "Leave blank for one day"
  - "What should participants be able to do afterwards?"
  - "Your … BU Admin is kept informed."
- **Attachments:**
  - Limit `5 * 1024 * 1024`; message "File exceeds 5 MB". UI copy "up to 5 MB".
  - Name list accepts `.xlsx, .xls, .csv`; one per request; `attachments.kind = 'NAME_LIST'`. Others are `'SUPPORTING'` (max 5).
- **Candidates:** names only, max 8, max 120 characters. Submit requires either 1–8 typed names, or a name list + participant count 1–999. Never both.
- **Relevancy:** required on submit, max 2000 characters, placed under Objective.
- **View as:** SYS_ADMIN real user only; target must be active with email ending `@demo.wct.my`.
- **Migrations:** additive only. Do not drop `candidates.staff_no` etc.
- **Commits:** end every message with the session's attribution lines.

## Review Focus

1. **Switching participant mode mid-draft.** Attaching a name list after typing names (and the reverse) must leave exactly one source. Submit must reject a request that has both.
   - Owned by Task 4 (validation test) and Task 5 (UI confirm + clear).
2. **BU Admin removed or deactivated.** HOD approval must fail with the no-BU-Admin message rather than strand the request.
   - Owned by Task 3 (integration test).
3. **Viewed demo user deleted** (`demo-data.sh remove` while an admin is "viewing as"). The admin must fall back to their own account, not be signed out or see an error.
   - Owned by Task 9 (integration test).
4. **Stale clients still sending `sendBackTo`/`notify`.** Reject must still succeed and return to the requester.
   - Owned by Task 4 (`actionSchema` strips unknown keys test).
5. **Legacy rows** (no relevancy, null participant_count, staff_no set, already past HOD on the old route). The detail page, PDF and Excel must render, and totals must fall back to the candidate count.
   - Owned by Task 7 (PDF/Excel test with null relevancy/participantCount).

---

### Task 1: Workflow core: BU stage, simple reject

**Files:**
- Modify:
  - `src/lib/workflow/types.ts`
  - `src/lib/workflow/permissions.ts`
  - `src/lib/workflow/transitions.ts`
  - `src/lib/workflow/recipients.ts`
  - `src/lib/workflow/index.ts`
- Test:
  - `tests/unit/workflow/{fixtures,transitions,recipients,permissions}.test.ts`
  - `tests/unit/tracker.test.ts`

**Interfaces (produces):**
- `STATUSES` includes `"PENDING_BU"` after `"PENDING_HOD"`; `Stage = "REQUESTER"|"HOD"|"BU"|"LND"|"HR"`; `NotifyTarget` removed.
- `RoleHolderCounts { lnd: number; hrHead: number; buAdmin: number }` (`buAdmin` = active BU Admins of the request's unit).
- `AllowedAction { type: WorkflowActionType }`; `ActionInput { type; remark?: string }`.
- `WorkflowEventKind` adds `"BU_APPROVED"`; `WorkflowEvent` drops `notify`; `sentBackTo` is always `"REQUESTER"` for REJECTED.
- `Parties` adds `roundApprovers: Person[]`.
- `WorkflowErrorCode` drops `INVALID_SEND_BACK`.
- `sendBackOptions` is deleted. Callers: `action-panel.tsx`, `requests/[id]/page.tsx`, tests.
- `holdsStage(req, actor, "BU")` = `req.businessUnitId !== null && actor.buAdminBusinessUnitIds.includes(req.businessUnitId)`.
- `canView` is unchanged; BU admins already see their unit.

- [ ] **Step 1: Update fixtures and write failing tests.** Fixtures gain `counts = { lnd: 2, hrHead: 1, buAdmin: 1 }` and `parties.roundApprovers = []`.
  - **transitions:**
    - HOD approve → `PENDING_BU`, event `HOD_APPROVED`.
    - BU Admin of the request's unit approves `PENDING_BU` → `PENDING_LND`, event `BU_APPROVED`.
    - BU Admin of another unit → `FORBIDDEN`.
    - BU Admin on own request: allowed and `selfApproved` when `buAdmin: 1`; `FORBIDDEN` when `buAdmin: 2`.
    - `it.each(["PENDING_HOD","PENDING_BU","PENDING_LND","PENDING_HR"])` reject with remark → `RETURNED`, `event.sentBackTo === "REQUESTER"`, `byStage` = stage.
    - `getAllowedActions` REJECT entries carry no `sendBackOptions` key.
    - RESUBMIT → `PENDING_HOD`.
  - **recipients:**
    - HOD_APPROVED → to = `buAdmins`, cc = requester.
    - BU_APPROVED → to = L&D, cc = requester.
    - REJECTED by HR with `roundApprovers=[hod, bua, lnd1]` → to = [requester], cc = [hod, bua, lnd1].
    - REJECTED by BU with `roundApprovers=[hod]` → to = [requester], cc = [hod].
    - FINAL_APPROVED cc = HOD, BU Admins, L&D.
    - CANCELLED from PENDING_BU → to = buAdmins.
  - **permissions:** `stageOf("PENDING_BU") === "BU"`.
  - **tracker:** stations order HOD, BU Admin, L&D, HR Head.
- [ ] **Step 2: Run** `npx vitest run tests/unit/workflow tests/unit/tracker.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** in `types.ts`, `permissions.ts`, `transitions.ts` and `recipients.ts` per the Interfaces above and spec §1:
  - `APPROVE_NEXT` gains `PENDING_HOD→PENDING_BU (HOD_APPROVED)` and `PENDING_BU→PENDING_LND (BU_APPROVED)`.
  - `approverCheck` pooled holders: `BU→counts.buAdmin`, `LND→counts.lnd`, `HR→counts.hrHead`.
  - In recipients, `ownersOf("BU") = p.buAdmins`. REJECTED: `to=[requester]`, `cc=p.roundApprovers`. CANCELLED no longer adds buAdmins except via `ownersOf`.
  - `src/lib/services/tracker.ts`: add the station "BU Admin" between HOD and L&D; `order` includes `PENDING_BU`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(workflow): BU Admin approval stage; reject always returns to requester`.

### Task 2: Database migration

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0001_*.sql` (generated) + meta
- Test: `tests/integration/seed.test.ts` (migration applies)

**Interfaces (produces):**
- `requestStatusEnum` includes `PENDING_BU`.
- `trainingRequests.relevancy: text`, `trainingRequests.participantCount: integer("participant_count")`.
- `attachments.kind: text("kind").notNull().default("SUPPORTING")`.

- [ ] **Step 1:** Edit the schema. Run `npx drizzle-kit generate --name bu_stage_relevancy_namelist`.
- [ ] **Step 2:** Inspect the SQL. It must contain `ALTER TYPE "public"."request_status" ADD VALUE 'PENDING_BU' BEFORE 'PENDING_LND';` and three `ADD COLUMN` statements, with no drops.
- [ ] **Step 3:** Run `DATABASE_URL=… npm run db:migrate` on a fresh DB and on a DB at 0000 with demo data. Expected: "Migrations applied."
- [ ] **Step 4:** Run `npm run test:integration`. Expected: existing tests compile. Workflow-related failures are fixed in Task 3.
- [ ] **Step 5: Commit** `feat(db): PENDING_BU status, relevancy, participant_count, attachment kind`.

### Task 3: Services for the new flow

**Files:**
- Modify:
  - `src/lib/services/parties.ts`
  - `src/lib/services/requests.ts`
  - `src/lib/services/errors.ts`
  - `src/lib/services/queries.ts`
  - `src/lib/services/dashboard.ts`
  - `src/lib/services/history.ts`
  - `src/lib/services/reports.ts`
  - `src/lib/pdf/from-detail.ts`
  - `src/lib/notify/payload.ts`
  - `src/app/(app)/requests/actions.ts`
  - `docs/POWER_AUTOMATE.md`
- Test:
  - `tests/integration/requests.test.ts`, `tests/integration/helpers.ts`
  - `tests/unit/notify-payload.test.ts`

**Interfaces:**
- **Produces:**
  - `loadParties(tx, req: { id: string; requesterId; departmentId; businessUnitId }): Promise<Parties>`. It fills `roundApprovers`: distinct actors of `APPROVE` actions created after the latest `SUBMIT|RESUBMIT` action of that request.
  - `roleHolderCounts(tx, businessUnitId: string | null): Promise<RoleHolderCounts>`.
  - `class NoBuAdminError extends ServiceError` (422, copy from Global Constraints).
- **Consumes:** Task 1 types.

- [ ] **Step 1: Write failing integration tests.** `helpers.ts` gains a BU Admin for the test unit.
  - Happy path is HOD → BU → L&D → HR, with 5 notifications.
  - Submit fails with `NoBuAdminError` when the unit has no BU Admin.
  - HOD approve fails with `NoBuAdminError` after the unit's only BU Admin is deactivated.
  - BU Admin rejects → `RETURNED`; the notifier's `cc` contains the HOD.
  - Resubmit → `PENDING_HOD`; the next HOD approval → `PENDING_BU`.
  - The HR reject after a full round cc's HOD, BU Admin and the L&D approver.
  - The BU Admin's awaiting-action list contains the `PENDING_BU` request.
  - Unit (`notify-payload`): BU_APPROVED headline "The {BU} BU Admin ({actor}) has approved this training request. It is now with the L&D Team for review."; HOD_APPROVED headline "…It is now with the {BU} BU Admin for approval."; REJECTED label "Rejected (returned to requester)"; row label "Training Dates".
- [ ] **Step 2: Run** `npm run test:integration -- requests` and `npx vitest run tests/unit/notify-payload.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **`performAction`:**
    - On SUBMIT/RESUBMIT, and on APPROVE from `PENDING_HOD`, call `assertBuAdmin(tx, businessUnitId)`. It throws `NoBuAdminError` with the unit's name when `roleHolderCounts(...).buAdmin === 0`.
    - Drop `sendBackTo`/`notify` from the input type.
    - Write `sentBackTo: t.event.sentBackTo ?? null`.
  - **`awaitingActionWhere`:** add `status = 'PENDING_BU' AND business_unit_id IN actor.buAdminBusinessUnitIds AND requester_id <> actor.id`.
  - **Status lists:**
    - dashboard `OPEN`, history OPEN filter and reports `from_status` list each gain `PENDING_BU`.
    - reports stage keys `["HOD","BU","LND","HR"]`.
    - PDF `STAGE` map adds `PENDING_BU: "BU Admin"`.
  - **Payload:** headlines and labels per the tests.
  - **`docs/POWER_AUTOMATE.md`:** list `BU_APPROVED`.
- [ ] **Step 4: Run** the same commands. Expected: PASS.
- [ ] **Step 5: Commit** `feat: BU Admin step in services, guard, round-approver cc on reject`.

### Task 4: Validation, content, attachments (relevancy, participants, name list, 5 MB)

**Files:**
- Modify:
  - `src/lib/validation/request.ts`
  - `src/lib/services/requests.ts` (`contentValues`, `replaceCandidates`, `loadContent`, `cloneRequest`, save)
  - `src/lib/services/form-data.ts`
  - `src/lib/services/attachment-rules.ts`
  - `src/lib/services/attachments.ts`
  - `src/app/api/requests/[id]/attachments/route.ts`
  - `src/components/request-detail/revisions.tsx`
- Test:
  - `tests/unit/validation.test.ts`, `tests/unit/attachments.test.ts`
  - `tests/integration/requests.test.ts`

**Interfaces (produces):**
- `candidateSchema`: `{ name, email?, jobTitle?, department?, userId? }`. `staffNo` is removed, and unknown keys are stripped.
- `requestFormSchema` adds:
  - `relevancy: trimmed(2000, "Relevancy")`
  - `hasNameList: z.boolean()`
  - `participantCount: z.number().int().min(1).max(999).nullable().optional()`
  - `candidates: candidatesList(0)`
  - a superRefine with these issues:
    - `candidates`: "Remove the typed names when using a name list"
    - `participantCount`: "Enter the number of participants on the name list"
    - `candidates`: "Add at least one candidate or attach a name list"
- `draftSchema` adds `relevancy: optionalTrimmed(2000)` and `participantCount: z.number().int().min(1).max(999).nullable().optional()`.
- `actionSchema` is `{ requestId, version, type, remark? }`.
- `type AttachmentKind = "SUPPORTING" | "NAME_LIST"`.
- `NAME_LIST_TYPES: Record<"xlsx"|"xls"|"csv", string>`.
- `validateUpload(file: { name: string; size: number }, existingCount: number, kind: AttachmentKind): string | null`.
- `saveAttachment(user, requestId, file, kind: AttachmentKind = "SUPPORTING")`. NAME_LIST replaces the request's existing name list (row + file).
- `loadContent` returns `relevancy`, `participantCount`, and `hasNameList` (from attachments).
- Save sets `participant_count = hasNameList ? d.participantCount ?? null : d.candidates.length`.
- `effectiveParticipants(r: { participantCount: number | null }, candidateCount: number): number` lives in `src/lib/format.ts`.

- [ ] **Step 1: Write failing tests.**
  - **Unit, validation:**
    - zero names and no list fails with the candidates message
    - list and names fails
    - list without count fails with the participantCount message
    - list + 25 is OK
    - 3 names is OK
    - missing relevancy fails "Relevancy is required"
    - `actionSchema.parse({..., sendBackTo: "HOD", notify: ["HOD"]})` has no `sendBackTo` key
    - candidate with `staffNo` parses without it
  - **Unit, attachments:**
    - 5 MB + 1 byte → "File exceeds 5 MB"
    - `.csv` allowed for NAME_LIST, rejected for SUPPORTING
    - `.exe` rejected for both
    - a 6th SUPPORTING file is rejected; NAME_LIST doesn't count towards 5
  - **Integration:**
    - a second NAME_LIST upload replaces the first
    - save with list + count 30 stores `participant_count = 30`
    - save with 2 names stores 2
    - submit with a list and names → validation error
- [ ] **Step 2: Run** `npx vitest run tests/unit/validation.test.ts tests/unit/attachments.test.ts && npm run test:integration -- requests`. Expected: FAIL.
- [ ] **Step 3: Implement** per Interfaces.
  - **Sniffing:** xlsx = ZIP `PK\x03\x04`; xls = `D0 CF 11 E0`; csv = no NUL byte in the first 4 KB.
  - **Route:** reads `form.get("kind")` (`"NAME_LIST"` or default).
  - **Revisions:** labels add Relevancy and Participants; the Staff no label is removed.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat: relevancy, participant count, Excel name list, 5 MB attachments`.

### Task 5: Request form UI

**Files:**
- Modify:
  - `src/components/request-form/request-form.tsx`
  - `src/components/request-form/candidate-picker.tsx` (rename to `candidate-names.tsx`)
  - `src/components/request-form/attachment-field.tsx`
  - `src/app/(app)/requests/new/page.tsx`
  - `src/app/(app)/requests/[id]/edit/page.tsx`
- Test: `tests/e2e/full-flow.spec.ts`, `tests/e2e/autosave.spec.ts`

**Interfaces:**
- **Consumes:** Task 4 schemas and the `kind` upload field.
- **Produces:**
  - `<CandidateNames value: string[] onChange />`: 8 text inputs `#candidate-1…#candidate-8`, placeholder "Full name".
  - `<NameListField requestId nameList: AttachmentView | null participantCount onChange />`: input `#participantCount`, file input accepting `.xlsx,.xls,.csv`.

- [ ] **Step 1: Update the e2e full flow (failing).**
  - Fill `#title`, `#objective` and `#relevancy`, the dates, and `#candidate-1` "Aisyah Rahman".
  - Submit → "Pending HOD".
  - The HOD approves → "Pending BU Admin".
  - `buadmin.land@demo.wct.my` approves → "Pending L&D".
  - L&D "Reject" with `#reject-remark` → "Returned". The flow-sink REJECTED payload `to` is [requester] and `cc` contains `hod.land`.
  - Resubmit → "Pending HOD".
- [ ] **Step 2: Implement.**
  - **Section 3 segmented control** "Type names (up to 8)" | "Upload name list (more than 8)":
    - Switching to the list with typed names asks to confirm, then clears them.
    - Switching back with a list asks to confirm, then deletes the attachment and clears the count.
  - **Relevancy:** a textarea `#relevancy` under Objective (rows like Objective).
  - **Remove:** the objective/end-date hints, the BU "kept informed" line and the WCT-F page descriptions (new description "Training Requisition Form").
  - **Rename:**
    - Section 1 label "From (Requester)"
    - review dialog row "Training Dates"
    - page title / metadata "New Training Requisition"
  - **Route aside:** HOD → BU Admin ({BU}) → L&D Team → HR Head.
  - **Total fees:** use `participants = list ? count : names.length`.
  - **Attachment field copy:** "up to 5 MB each".
- [ ] **Step 3: Run** `npx playwright test tests/e2e/full-flow.spec.ts tests/e2e/autosave.spec.ts`. Expected: PASS.
- [ ] **Step 4: Commit** `feat(form): manual names or Excel name list, relevancy, copy changes`.

### Task 6: Detail page and approval actions

**Files:**
- Modify:
  - `src/components/request-detail/action-panel.tsx`
  - `src/app/(app)/requests/[id]/page.tsx`
  - `src/components/request-detail/timeline.tsx`
  - `src/components/request-detail/progress-tracker.tsx`
  - `src/components/status.tsx`
  - `src/app/(app)/dashboard/page.tsx` (sent-back text)
- Test: covered by the Task 5 e2e and `tests/unit/tracker.test.ts`

- [ ] **Step 1: Implement.**
  - **Reject dialog:** title "Reject and return to requester"; description "The requester will amend and resubmit; approval restarts at the Department HOD. Everyone who approved this round is copied." Remark textarea `#reject-remark`. Button "Reject". Remove the send-back and notify fieldsets, `buName` and `SEND_BACK_HINT`. Toast "Returned to requester".
  - **Detail page:**
    - "Training Dates" label
    - a Relevancy block under Objective
    - candidates without staff no.
    - with a name list: "Name list: <file link> · N participants"
  - **Status tone:** `PENDING_BU` uses the pending tone.
  - **Timeline:** `STAGE_OF_FROM` adds `PENDING_BU: "BU Admin"`.
  - **Dashboard recent activity:** rejects read "returned to requester".
- [ ] **Step 2: Run** `npx playwright test tests/e2e/full-flow.spec.ts`. Expected: PASS.
- [ ] **Step 3: Commit** `feat(detail): BU Admin step, single reject, relevancy and name list display`.

### Task 7: PDF and per-request Excel export

**Files:**
- Modify:
  - `src/lib/pdf/types.ts`, `src/lib/pdf/from-detail.ts`
  - `src/lib/pdf/training-rq-document.tsx`
  - `src/app/(app)/requests/[id]/page.tsx` (button)
- Create:
  - `src/lib/services/request-xlsx.ts`
  - `src/app/api/requests/[id]/xlsx/route.ts`
- Test: `tests/unit/pdf.test.ts`, `tests/integration/request-xlsx.test.ts`

**Interfaces (produces):**
- `PdfData` adds `relevancy: string | null`, `participantCount: number`, `nameList: { fileName: string } | null`. `candidates: { name: string }[]`.
- `buildRequestXlsx(d: PdfData): Promise<Buffer>` builds the sheets "Request", "Candidates" and "Approval trail" (columns Stage, Name, Decision, Date & time, Remark).
- The route returns `Content-Disposition: attachment; filename="<refNo or draft>.xlsx"`, using the same access check as the PDF route.

- [ ] **Step 1: Write failing tests.**
  - **PDF text:**
    - contains "FROM (REQUESTER):", "TRAINING DATES:" and "RELEVANCY:"
    - no "(W1234)"
    - with `nameList`, contains "Refer to attached name list: names.xlsx (25 participants)"
    - renders with `relevancy: null` and `participantCount` derived
  - **xlsx:**
    - "Request" sheet A-column labels include "Relevancy", "Training Dates", "Participants" and "Total fees"
    - "Approval trail" has 4 rows after a full approval
    - name-list request "Candidates" sheet A2 = "Refer to attached name list: names.xlsx (25 participants)"
- [ ] **Step 2: Run** `npx vitest run tests/unit/pdf.test.ts && npm run test:integration -- request-xlsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **PDF** keeps its layout:
    - the Section 4 "REQUESTED BY" and HR box are unchanged
    - Relevancy goes after Objective
    - the trail includes BU Admin
    - fees use `participantCount`
  - **Detail page:** button "Export to Excel" (lucide `FileSpreadsheet`) next to "Download PDF".
- [ ] **Step 4: Run** the same commands. Expected: PASS.
- [ ] **Step 5: Commit** `feat: per-request Excel export; PDF wording and name list`.

### Task 8: Analytics on the dashboard, navigation and labels

**Files:**
- Create: `src/components/dashboard/analytics.tsx` (server component)
- Modify:
  - `src/app/(app)/dashboard/page.tsx`
  - `src/app/(app)/reports/page.tsx` (redirect)
  - `src/components/shell/nav.tsx`, `src/components/shell/app-shell.tsx`
  - `src/app/(app)/layout.tsx`
  - `src/app/(app)/history/page.tsx`
  - `src/app/(app)/my-requests/page.tsx`
  - `src/components/dashboard/availability-board.tsx`
  - `src/components/requests-table.tsx`
  - `src/components/reports/year-select.tsx`
- Test:
  - `tests/integration/reports.test.ts` (unchanged service)
  - `tests/e2e/full-flow.spec.ts` (nav labels)

**Interfaces (produces):** `<Analytics user: CurrentUser year: number />` renders the former reports page body inside `<section id="analytics">`.

- [ ] **Step 1: Implement.**
  - **Dashboard:** renders `<Analytics>` when `canSeeReports(user)`. `searchParams.year` drives the year, and YearSelect navigates `/dashboard?year=…#analytics`.
  - **`/reports`:** `redirect("/dashboard#analytics")`.
  - **Nav:**
    - remove "Reports"
    - "New request" → "New Training Requisition" (also the mobile `aria-label` and the my-requests button)
    - "Training RQ history" → "Training RQ History"
  - **`layout.tsx`:** `canReport` uses `canSeeReports`.
  - **Other labels:**
    - legend "In approval" → "In progress"
    - table header "Dates" → "Training Dates"
    - dashboard button "New Training Requisition"
- [ ] **Step 2: Run** `npm run test:integration -- reports && npx playwright test`. Expected: PASS.
- [ ] **Step 3: Commit** `feat: analytics on dashboard; navigation and label changes`.

### Task 9: View as demo user

**Files:**
- Modify:
  - `src/lib/auth/session.ts` (`viewAsUserId?: string`)
  - `src/lib/auth/current-user.ts`
  - `src/lib/auth/load-user.ts` (`CurrentUser.viewedBy?: { id: string; name: string }`)
  - `src/app/(app)/layout.tsx`
  - `src/components/shell/app-shell.tsx`
- Create:
  - `src/app/api/auth/view-as/route.ts`
  - `src/lib/services/view-as.ts`
  - `src/components/shell/view-as.tsx` (dialog + banner)
- Test:
  - `tests/integration/view-as.test.ts`
  - `tests/e2e/view-as.spec.ts`

**Interfaces (produces):**
- `resolveViewAs(realUserId: string, viewAsUserId: string | undefined): Promise<CurrentUser>`. It returns the demo target with `viewedBy` set when the guard passes; otherwise it returns the real user.
- `listDemoAccounts(): Promise<{ id: string; name: string; roleLabel: string }[]>`. Role labels: "Requester", "Department HOD", "BU Admin", "L&D", "HR Head", "System Admin". A user with several roles gets their labels joined with " · ".
- `startViewAs(real: CurrentUser, targetId: string): Promise<void>` throws `ServiceError(403)` unless the real user is SYS_ADMIN and the target is an active `@demo.wct.my` user. It writes `admin_audit_logs` action `VIEW_AS_START`.
- `stopViewAs(real)` writes `VIEW_AS_STOP`.
- `POST /api/auth/view-as` takes the JSON body `{ userId }` or `{ stop: true }` and responds 303 to `/dashboard`.

- [ ] **Step 1: Write failing integration tests.**
  - an admin viewing as `hod.land` gets `actor.hodDepartmentIds` of hod.land and `viewedBy.id = admin`
  - a non-admin `startViewAs` → 403
  - a target `real.person@wct.my` → 403
  - a deleted or deactivated target → `resolveViewAs` returns the admin
  - start and stop write two audit rows
- [ ] **Step 2: Run** `npm run test:integration -- view-as`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **`getCurrentUser`:** loads the real user from `session.userId`, then `resolveViewAs`.
  - **Layout:**
    - when the real user is SYS_ADMIN and not viewing, passes `demoAccounts` to the AppShell; the user menu shows "View as demo user…" (dialog list)
    - when `viewedBy` is set, renders a top banner "Viewing as {name} ({roleLabel}) · Exit". Exit posts `{stop:true}`.
  - **Sign-out:** clears `viewAsUserId` too.
- [ ] **Step 4: e2e (`view-as.spec.ts`):**
  - The admin opens the menu → "View as demo user…" → picks "Lee Mei Ling".
  - The banner shows "Viewing as Lee Mei Ling".
  - Approvals is visible.
  - Exit → the banner is gone.
- [ ] **Step 5: Run** `npm run test:integration -- view-as && npx playwright test tests/e2e/view-as.spec.ts`. Expected: PASS.
- [ ] **Step 6: Commit** `feat: admin-only View as demo user with audit log`.

### Task 10: Sign-in page

**Files:**
- Modify: `src/app/signin/page.tsx`
- Docs: `docs/DEPLOYMENT.md` (how to add the official icon)

- [ ] **Step 1: Implement.**
  - Remove "WCT-F-4.18-2" from the hero copy ("…and print the signed-off training requisition form when it's done.").
  - When `fs.existsSync(path.join(process.cwd(), "public/brand/microsoft-logo.svg"))`, render `<img src={`${BASE_PATH}/brand/microsoft-logo.svg`} alt="" width={20} height={20}>`; otherwise render `<KeyRound />`.
- [ ] **Step 2: Verify:** `curl /signin` contains "Sign in with Microsoft" and no "WCT-F-4.18-2".
- [ ] **Step 3: Commit** `feat(signin): official Microsoft icon slot; remove form code`.

### Task 11: Demo data

**Files:**
- Modify:
  - `scripts/seed-demo-requests.ts`
  - `scripts/demo-data.sh`
  - `scripts/demo-data-remove.sql`
  - `src/db/seed.ts` (`DEMO_USERS` unchanged unless a role is missing)

- [ ] **Step 1: Implement.**
  - **Size:** `N = 10 + randInt(0..10)` requests.
  - **Months:** 5 distinct random months between January and the current month of this year.
  - **Spread:** each request gets a base timestamp inside its month (≤ now). Its actions are re-timed `base + k·19h` and the request's created, submitted and finalised times follow its actions.
  - **Plans:**
    - `[SUBMIT]`
    - `[SUBMIT,HOD]`
    - `[SUBMIT,HOD,BU]`
    - `[SUBMIT,HOD,BU,LND]`
    - `[SUBMIT,HOD,BU,LND,HR]` ×3
    - `[SUBMIT,HOD,BU_REJECT]`
    - `[SUBMIT,HOD,BU,LND_REJECT,RESUBMIT]`
    - `[SUBMIT,CANCEL]`
  - **Relevancy text** on every request.
  - **Name-list request:** one request builds a 25-row `.xlsx` with exceljs (sheet "Participants": Name, Department) and attaches it via `saveAttachment(..., "NAME_LIST")` with `participantCount: 25`.
  - **`demo-data.sh remove`:** first `psql -Atc` the `stored_name`s of demo requests' attachments and `rm -f "$UPLOAD_DIR/<name>"`.
- [ ] **Step 2: Verify** against a scratch DB.
  - `demo-data.sh load` creates 10–20 requests across exactly 5 months, including statuses `PENDING_BU` and `RETURNED` and one name list.
  - `remove` leaves the real request untouched (same check as before).
- [ ] **Step 3: Commit** `feat(demo): 10–20 random requests over 5 months with BU step and a name list`.

### Task 12: Docs, full verification, release

- [ ] **Step 1: Update docs** for the new flow, labels, 5 MB and View as:
  - `docs/USER_GUIDE.md`
  - `README.md`
  - `docs/POWER_AUTOMATE.md`
  - `docs/DEPLOYMENT.md`
- [ ] **Step 2: Run everything:** `npm run lint && npx tsc --noEmit && npm test && npm run test:integration && npm run build && npx playwright test`. Expected: all pass.
- [ ] **Step 3: Browser check.** View as each demo role (Requester, HOD, BU Admin, L&D, HR Head), screenshot the dashboard and request page, check the PDF and Excel downloads, and send the screenshots to the user.
- [ ] **Step 4: Release.** Use the superpowers:requesting-code-review skill for a whole-branch review, fix its findings, rebuild the bundle and hand over the push + `demo-data.sh remove && load` instructions.
