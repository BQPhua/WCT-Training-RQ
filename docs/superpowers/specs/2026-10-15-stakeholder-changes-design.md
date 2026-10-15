# Stakeholder change request: BU Admin approval, simpler rejection, form and reporting changes

Date: 2026-10-15 · Status: for review · Builds on `2026-10-13-wct-training-rq-design.md`

## Intent

Stakeholders reviewed the live trial and asked for:

- a BU Admin approval step;
- one simple rejection path;
- a lighter request form that works without the WCT employee list;
- per-request Excel export;
- analytics on the dashboard;
- a way to show every role's screens without real Microsoft accounts.

Success means:

- stakeholders can walk the full flow as each role;
- requesters can submit large groups through a name list;
- nothing in the live system can reach real staff by accident.

**Decisions from the user (2026-10-15):**

- The PDF keeps its layout. Only the text changes.
- Relevancy is one multi-line field under Objective.
- Demo roles are shown through an admin-only "View as demo user".
- A rejection email goes to the requester, with earlier approvers copied.
- "New Training Requisition" is the new wording.
- Submission is blocked when the business unit has no BU Admin.
- A request carries either typed names or a name list, never both.

## 1. Workflow

```
DRAFT ─submit→ PENDING_HOD ─approve→ PENDING_BU ─approve→ PENDING_LND ─approve→ PENDING_HR ─approve→ APPROVED
                    │ reject              │ reject              │ reject              │ reject
                    └──────────────┬──────┴─────────────────────┴─────────────────────┘
                                   ▼
                               RETURNED ─resubmit→ PENDING_HOD   (full restart)
any open state ─cancel (requester)→ CANCELLED
```

**New status `PENDING_BU`.**
- Its stage is `BU` ("BU Admin").
- Anyone in `business_unit_admins` for the request's `business_unit_id` holds it.
- Self-approval follows the L&D rule. A BU Admin may act on their own request only when they are the sole BU Admin of that unit.
- In that case the action is flagged `selfApproved`.

**Reject.**
- Allowed from any pending status. It always goes to `RETURNED`.
- A remark of at least 3 characters is required.
- `sendBackTo` and `notify` are removed from the action input, the zod schema and the UI.
- The `request_actions.sent_back_to` column is kept, and is written as `REQUESTER` for new rejects.
- The event keeps `byStage`.

**Submit and resubmit guard.**
- Submit fails with a `ServiceError` when the request's business unit has no BU Admin: "Your business unit (Land) has no BU Admin assigned. Please contact HR."
- This sits beside the existing "no HOD" check.
- HOD approve performs the same check, so a BU Admin removed mid-flight cannot strand a request.

**Recipients (`resolveRecipients`).**

| Event | To | Cc |
|---|---|---|
| SUBMITTED / RESUBMITTED | HOD | requester |
| HOD_APPROVED | BU Admins of the unit | requester |
| BU_APPROVED (new) | L&D team | requester |
| LND_APPROVED | HR Head | requester |
| FINAL_APPROVED | requester | HOD, BU Admins, L&D |
| REJECTED | requester | everyone who approved in the current round (approve actions since the latest SUBMIT/RESUBMIT), minus the actor |
| CANCELLED | owners of the stage it was in | — |
| COMMENTED | unchanged | unchanged |

- The current round's approvers are loaded in the service and passed in `Parties.roundApprovers`.
- The actor is still excluded from `to`.

**Places that enumerate statuses or stages.** Each of these gains `PENDING_BU`/`BU`:

- labels and the stage map
- awaiting-action query (BU Admin sees their units' `PENDING_BU`)
- approvals list
- dashboard OPEN list
- history OPEN filter
- reports stage turnaround
- tracker stations: HOD → BU Admin → L&D → HR Head
- PDF stage map
- timeline
- status tone
- form "Approval route" aside
- notification headline: "…approved by the Department HOD. It is now with the {BU} BU Admin for approval." and a BU_APPROVED headline
- `docs/POWER_AUTOMATE.md` event list

**Migration `0001`.**

```sql
ALTER TYPE request_status ADD VALUE 'PENDING_BU' BEFORE 'PENDING_LND';
```

Requests already past HOD continue on the old route. Only demo data exists in production.

## 2. Request form, detail page, PDF

**Candidates.**
- 8 optional name boxes. Free text, no directory search, max 120 characters.
- Staff no., email, job title and department inputs are removed from the form.
- Existing columns stay in the database, unused (no destructive migration).
- Staff no. is removed from the detail page, PDF and Excel.

**Name list.**
- A new upload in Section 3: "Participant name list (Excel)".
- One file. `.xlsx`, `.xls` or `.csv`, ≤ 5 MB.
- Stored in `attachments` with the new column `kind text not null default 'SUPPORTING'` (`'NAME_LIST'`).
- When a name list is present:
  - the 8 boxes are hidden and the request's typed candidates are cleared;
  - **Number of participants** (new column `training_requests.participant_count int`, 1–999) is required.
- When no name list is present, participant count = number of typed names.

**Submit rule.** Exactly one of these must hold:
- 1–8 typed names;
- a name list and a participant count.

Drafts may have neither.

**Total fee.** Fee per pax × participant count.

**Relevancy.**
- New column `training_requests.relevancy text`.
- A multi-line field directly under Objective. Required on submit, max 2000 characters.
- Shown on the detail page, PDF (after Objective), Excel and revisions.

**Text changes.**

| Before | After |
|---|---|
| New request / New training request (nav, buttons, page titles) | **New Training Requisition** |
| Training RQ history | **Training RQ History** |
| Date(s) / Dates / When | **Training Dates** (detail, tables, email, PDF `TRAINING DATES:`, review dialog) |
| From (requisitioner) / FROM (REQUISITIONER) | **From (Requester)** / **FROM (REQUESTER)** |
| In approval (availability board legend) | **In progress** |
| "Training Requisition Form · WCT-F-4.18-2 (REV2)" on new/edit pages; "WCT-F-4.18-2" on sign-in page | removed (PDF keeps its form reference) |
| "Leave blank for one day", "What should participants be able to do afterwards?" | removed (blank end date still means one day) |
| "Your BU Admin is kept informed." | removed; the route aside lists the BU Admin step |
| Attachments "up to 10 MB" | **5 MB** (`MAX_ATTACHMENT_BYTES`) |

**PDF.**
- Same layout.
- Section 3 shows typed names (no staff no.). With a name list it shows one line instead: "Refer to attached name list: <file name> (N participants)".
- Approval trail includes BU Admin.

## 3. Per-request Excel export

- `GET /api/requests/[id]/xlsx`, with the same visibility check as the PDF.
- "Export to Excel" button next to "Download PDF".
- The workbook `TRQ-2026-0031.xlsx` has three sheets:
  - **Request**: label/value rows in PDF order, including Relevancy, participant count and total fees.
  - **Candidates**: typed names, or a note pointing to the name list file.
  - **Approval trail**: stage, name, decision, date, remark.

## 4. Analytics on the dashboard

- The reports page content moves into an **Analytics** section at the bottom of the dashboard:
  - KPIs
  - monthly charts
  - by business unit
  - stage turnaround
  - planned vs ad hoc
  - where requests stand
  - by department
  - year select
  - Export to Excel
- Shown only when `canSeeReports` is true. BU Admins are scoped to their units, as today.
- The year select drives `?year=` on `/dashboard`.
- The "Reports" nav item is removed. `/reports` redirects to `/dashboard#analytics`.
- The `canReport` logic duplicated in `layout.tsx` is replaced by `canSeeReports`.

## 5. Sign-in button icon

- The button renders `public/brand/microsoft-logo.svg` (official asset, supplied by the user from Microsoft's identity platform branding guidelines) when the file exists at build time.
- Otherwise it keeps the current key icon.
- We do not draw the logo ourselves.

## 6. View as demo user (System Admin only)

- The session gains `viewAsUserId`.
- `getCurrentUser()` resolves the real user and checks:
  - the real user holds `SYS_ADMIN`;
  - the target is active and its email ends `@demo.wct.my`.
- Only then does it load and return the target.
- The real admin id is exposed as `user.viewedBy` for the banner.
- Starting and stopping go through `POST /api/auth/view-as` (`{userId}` or `{stop:true}`). Each switch is written to `admin_audit_logs`.
- The user menu gets "View as demo user…" (SYS_ADMIN only). A dialog lists demo users with their roles: Requester, HOD, BU Admin, L&D, HR Head.
- A top banner reads "Viewing as Tan Wei Ming (Department HOD) · Exit".
- Workflow actions while viewing are performed as the demo user. Audit trails name the demo user.
- Demo accounts hold real role assignments. Remove the demo data (`demo-data.sh remove`) before go-live.

## 7. Demo data

- `seed-demo-requests.ts` creates a random 10–20 requests in 5 random months of the current year (≤ today).
- Plans cover:
  - every status, including `PENDING_BU`
  - BU-stage reject
  - L&D reject then resubmit
  - one request using a generated name list (`.xlsx` created with exceljs, attached as `NAME_LIST`)
- Date spreading stays restricted to demo requests.
- `demo-data-remove.sql` also removes attachment rows of demo requests (they cascade). Uploaded demo files live in `UPLOAD_DIR/<requestId>/`; the remove script deletes those folders.

## 8. Testing

- **Unit**
  - transitions (BU stage, reject → RETURNED from every stage, self-approval at BU)
  - recipients (table above)
  - permissions
  - validation (names XOR list, relevancy required, no `sendBackTo`)
  - attachments 5 MB
  - PDF (no staff no., name-list line, labels)
  - payload labels
  - tracker
- **Integration**
  - full happy path with BU
  - submit blocked without BU Admin
  - reject at BU → resubmit restarts at HOD, with round approvers cc'd
  - name list submit
  - Excel export contents
  - view-as guard (non-admin rejected; non-demo target rejected)
  - analytics on dashboard data
- **E2E**
  - updated full flow, including a BU Admin approval
  - view-as banner and exit
  - sign-out
- **Browser check** as each demo role before handing over.

## Out of scope

- Parsing the Excel name list
- WCT employee directory for candidates (wait for the list)
- Changing the PDF layout
