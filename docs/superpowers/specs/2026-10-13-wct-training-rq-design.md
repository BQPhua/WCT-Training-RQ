# WCT Training Requisition (Training RQ) — Design Spec

- **Date:** 2026-10-13
- **Owner:** WCT HR Transformation Team (Phua Bian Qi)
- **Status:** Draft for review
- **Source form:** WCT Berhad Training Requisition Form, Ref WCT-F-4.18-2, REV2, dated 20/03/2024
- **Production URL:** `https://hrforms.wct.my/WCT-Training-RQ/`
- **Repository:** `github.com/BQPhua/WCT-Training-RQ` (public, so no secrets are ever committed)

---

## 1. Purpose and success criteria

Replace the paper/Excel Training Requisition Form with an internal web system. In it, staff raise training requests, approvals happen online in a fixed chain, and HR has a searchable history of all requests.

**Success looks like:**

1. A requester signs in with their WCT Microsoft account and submits a request in under 5 minutes.
2. Each approver gets an email/Teams notification (via Power Automate) and acts **inside the system**. Notifications only link to the request; no decision is taken in email or Teams.
3. Anyone involved can see where a request is, who holds it, and the full audit trail.
4. HR / L&D can search all past requests, export to Excel, and print any request as a PDF that mirrors form WCT-F-4.18-2.
5. Approver mappings (HODs, BU Admins, L&D, HR Head) are maintained by HR in the app, without a developer.

**Out of scope for V1** (Phase 2): automated reminders/escalation, approver delegation (out-of-office), training calendar view, post-training feedback/certificates.

---

## 2. Users and roles

| Role | Who | Can |
|---|---|---|
| **Requester** | Any signed-in WCT staff | Create, save draft, submit, edit when returned, resubmit, cancel, clone, comment, view own requests, print PDF |
| **Department HOD** | Set per department in Admin | Approve/reject requests from their department; view their department's requests |
| **BU Admin** | Set per business unit (Land, E&C, Malls) in Admin | **FYI only.** Receives notifications; read-only view of all requests in their BU; can comment |
| **L&D Team** | Users with L&D role | Review/approve/reject any request at the L&D stage; edit L&D fields (HRD Corp); view all requests |
| **HR Head** | User(s) with HR Head role | Final approve/reject; view all requests |
| **System Admin** | HR system owners | Manage BUs, departments, HOD mapping, role assignments, users; view audit log; view all |

A user can hold several roles (for example, an HOD who is also a requester). Every permission check runs on the server for every action.

**Business units (V1):** `LAND` (Land), `ENC` (E&C), `MALLS` (Malls). They're stored as data, so more can be added later.

---

## 3. Workflow

### 3.1 Statuses

| Status | Meaning | Held by |
|---|---|---|
| `DRAFT` | Saved, not submitted | Requester |
| `PENDING_HOD` | Awaiting Department HOD | Dept HOD |
| `PENDING_LND` | Awaiting L&D review | L&D Team (any member) |
| `PENDING_HR` | Awaiting HR Head final approval | HR Head |
| `RETURNED` | Sent back to the requester for amendment | Requester |
| `APPROVED` | Final approval given (terminal) | — |
| `CANCELLED` | Withdrawn by requester (terminal) | — |

### 3.2 Transitions

| From | Action | Actor | To | Remark |
|---|---|---|---|---|
| DRAFT | Submit | Requester | PENDING_HOD | optional |
| PENDING_HOD | Approve | Dept HOD | PENDING_LND | optional |
| PENDING_HOD | Reject | Dept HOD | RETURNED | **required** |
| PENDING_LND | Approve | L&D | PENDING_HR | optional |
| PENDING_LND | Reject → *send back to* Requester / HOD | L&D | RETURNED / PENDING_HOD | **required** |
| PENDING_HR | Approve | HR Head | APPROVED | optional |
| PENDING_HR | Reject → *send back to* Requester / HOD / L&D | HR Head | RETURNED / PENDING_HOD / PENDING_LND | **required** |
| RETURNED | Edit + Resubmit | Requester | PENDING_HOD | optional |
| DRAFT, PENDING_*, RETURNED | Cancel | Requester | CANCELLED | **required** |

Rules:

- **Rejector picks the stage.** When L&D or the HR Head rejects, they choose who the request goes back to (only earlier stages are offered). A request sent back to HOD or L&D re-enters that stage's queue, and that stage reviews it again from there.
- **Rejector picks who is notified.** Checkboxes for Requester / Department HOD / L&D Team. The owner of the stage it is sent back to is always ticked and locked. **The BU Admin of the requester's BU is always notified on every rejection**, whether by HOD, L&D or HR Head, and this can't be unticked.
- A resubmission from `RETURNED` always restarts at `PENDING_HOD`. The previous content is kept as a revision.
- Self-approval guard: if the requester is also the HOD of their department, the HOD step is still shown. That user may approve it, and the timeline records "Approved by requester (as HOD)". An L&D member or the HR Head can't act on their own request while another active holder of that role exists. If they are the only holder, they may act, and the timeline flags it as "self-approved".
- **Concurrency:** every request has a `version` number. An action submitted against a stale version is refused with "This request was already actioned by <name>". This stops two L&D members approving at once.
- Only the requester can edit content, and only in `DRAFT` or `RETURNED`. L&D can edit **L&D fields** (HRD Corp claimable, grant no., L&D notes) while the request is at `PENDING_LND`.

### 3.3 Notifications (who is told)

| Event | Notified |
|---|---|
| Submitted / Resubmitted | Dept HOD (cc requester as confirmation) |
| HOD approved | L&D Team, **BU Admin of requester's BU**, requester (FYI) |
| L&D approved | HR Head, requester (FYI) |
| HR Head approved (final) | Requester, Dept HOD, L&D Team, BU Admin |
| Rejected (any stage) | Selected recipients + owner of target stage + **BU Admin (always)** |
| Cancelled | Owner of the current stage (if pending), BU Admin |
| New comment | Requester + current stage owner (excluding the comment author) |

The HOD, BU Admin, L&D and HR Head for a request are resolved **when the event happens**, from the Admin mappings at that moment.

---

## 4. Form content (maps to WCT-F-4.18-2)

**Section 1: General details**
- To: *Human Resources and Administration Department* (fixed)
- From (Requisitioner): signed-in user (auto)
- Department: from user profile (selectable on first use if the Entra department doesn't match a configured department). This determines the HOD and the BU.
- Business Unit: derived from the department (read-only)

**Section 2: Training program details**
- Training type: Planned / Ad Hoc (required, one)
- Proposed training program title / subject (required, ≤ 200)
- Objective (required, ≤ 2000)
- Date(s): start date (required) and end date (≥ start, defaults to start)
- Time: start and end time (required)
- Fees (MYR): fee per pax (≥ 0, 2 dp). The total is calculated as fee × number of candidates and shown alongside.
- Venue (required), Conducted by / training provider (required)
- Attachments: up to 5 files, 10 MB each (PDF, DOCX, XLSX, PNG, JPG), for brochures or quotations

**Section 3: Proposed candidates**
- 1 to 8 candidates (same limit as the paper form)
- Picked from the Microsoft 365 directory (type-ahead on name/email; stores name, email, job title, department), with a "manual entry" fallback for name plus optional staff no.
- No duplicate candidates per request

**Section 4: Sign-off and approvals** (system-generated)
- Requested by: name and submitted date
- HOD, L&D and HR Head decisions: name, decision, date/time, remark

**L&D fields** (editable by L&D at PENDING_LND, shown on PDF): HRD Corp claimable (Yes/No), HRD Corp grant / application no., L&D remarks.

**Reference number:** `TRQ-YYYY-NNNN`, allocated on first submit (drafts show "Draft"). The sequence resets every year.

---

## 5. Features (V1)

1. **Dashboard:** greeting, KPI cards (my open requests, awaiting my action, approved this year, total fees this year in my scope), "Awaiting my action" list, recent activity.
2. **New / Edit Request:** sectioned form matching the paper layout, with inline validation, autosaving draft, and a review-before-submit summary.
3. **Request detail:** status badge, **progress tracker** (Submitted → HOD → L&D → HR Head → Approved, current step highlighted, returned steps marked), **audit timeline** (every action, actor, timestamp, remark, notified parties), comments thread, attachments, revisions (view a previous version), and action panel (Approve / Reject with stage and recipient pickers / Cancel / Edit & Resubmit / Clone / Print PDF).
4. **My Requests:** the requester's own requests with status filters.
5. **Approvals inbox:** everything awaiting the user in any of their roles, with a nav badge count.
6. **Training RQ History:** every request the user may see, with search (ref no., title, requester, candidate, provider) and filters (status, BU, department, type, date range, HRD Corp). Paginated, sortable, with **Export to Excel**. Searching by candidate gives one employee's training history.
7. **Reports** (L&D, HR Head, Admin, and BU Admin for their own BU): requests and fees by month, by BU, by department; planned vs ad hoc; approval turnaround time per stage; Excel export.
8. **Print to PDF:** server-generated A4 PDF reproducing WCT-F-4.18-2 REV2 (header box, Sections 1–4, 8-row candidate grid, footer), extended with the system reference no., the L&D fields and the digital approval trail. It is available to anyone who can view the request and works at any status. Non-approved PDFs carry a "NOT FINAL — <status>" watermark.
9. **Clone request:** start a new draft prefilled from any request you can view.
10. **Comments:** threaded comments per request, notifying the relevant parties.
11. **Admin:**
    - Business units: name, code, BU Admin users
    - Departments: name, BU, HOD
    - Role assignments: L&D, HR Head, System Admin
    - Users: synced on login; admin can set department and active flag
    - Notification log: status of every Power Automate call, with a manual "retry"
    - Audit log of admin changes
12. **UX:** modern, professional layout (sidebar navigation, WCT navy palette matching the form's slate/navy styling), light/dark mode, fully responsive so approvers can act from a phone, accessible (WCAG 2.1 AA contrast and keyboard support), with toasts and confirmation dialogs for irreversible actions.

---

## 6. Architecture

**Approach chosen:** one Next.js full-stack application (approach A). Rejected: a separate SPA plus API (extra deployables and CORS for no gain), and Power Apps (doesn't meet the GitHub → Ubuntu requirement).

```
Browser ──HTTPS──> Nginx (hrforms.wct.my)
                     └─ location /WCT-Training-RQ/ ─> Next.js (PM2, 127.0.0.1:3010, basePath=/WCT-Training-RQ)
                                                         ├─ PostgreSQL (local, db: wct_training_rq)
                                                         ├─ Local disk: /var/lib/wct-training-rq/uploads (attachments)
                                                         ├─ Microsoft Entra ID (OIDC sign-in)
                                                         ├─ Microsoft Graph (app-only: directory search for people picker)
                                                         └─ Power Automate HTTP flow (notifications)
```

**Stack:**
- Next.js (App Router, TypeScript, Server Components and Server Actions), `basePath: "/WCT-Training-RQ"`
- PostgreSQL 16 with the Prisma ORM and migrations
- Auth.js with the Microsoft Entra ID provider (single tenant), using JWT session cookies
- Tailwind CSS with shadcn/ui components, lucide icons, and Recharts for reports
- Zod for validation, shared between client and server
- `@react-pdf/renderer` for the PDF (pure Node, so no headless browser on the server)
- `exceljs` for Excel export
- Vitest (unit and integration), Playwright (end-to-end)
- PM2 process manager; GitHub Actions for CI/CD

**Code units (each testable on its own):**

| Unit | Responsibility | Depends on |
|---|---|---|
| `lib/workflow/` | **Pure** state machine: `allowedActions(request, user)`, `applyAction(...)` → next status + side-effect descriptors; recipient resolution rules | nothing (pure) |
| `lib/services/requests` | Create/update/submit/act on requests in a DB transaction with version check; writes ActionLog, revisions, allocates ref no. | workflow, db |
| `lib/services/directory` | Graph app-only user search, cached | Graph |
| `lib/notify/` | Build event payload, POST to Power Automate, log, retry | db, fetch |
| `lib/pdf/` | Render request → PDF buffer | none (pure render) |
| `lib/auth/` | Session, current user, role lookup, `requireRole` guards | Auth.js, db |
| `app/` | Pages and server actions (thin; delegate to services) | services |

### 6.1 Data model (Prisma, summary)

- **User:** id, entraOid (unique), email (unique), name, jobTitle, departmentId?, isActive, lastLoginAt
- **BusinessUnit:** id, code (unique: LAND, ENC, MALLS), name, isActive
- **BusinessUnitAdmin:** businessUnitId, userId (many-to-many)
- **Department:** id, name, businessUnitId, hodUserId?, isActive
- **RoleAssignment:** userId, role (`LND` | `HR_HEAD` | `SYS_ADMIN`) — unique per (userId, role)
- **TrainingRequest:** id, refNo? (unique), status, version, requesterId, departmentId, businessUnitId (snapshotted at submit), trainingType, title, objective, startDate, endDate, startTime, endTime, feePerPax (Decimal), venue, conductedBy, hrdcClaimable?, hrdcGrantNo?, lndRemarks?, submittedAt?, finalisedAt?, createdAt, updatedAt
- **Candidate:** id, requestId, sortOrder, name, email?, jobTitle?, department?, staffNo?, userId?
- **RequestAction** (audit trail): id, requestId, actorId, action (`CREATE`, `SUBMIT`, `APPROVE`, `REJECT`, `RESUBMIT`, `CANCEL`, `COMMENT`, `EDIT_LND_FIELDS`), fromStatus, toStatus, sentBackTo?, remark?, notified (JSON), createdAt
- **RequestRevision:** id, requestId, revisionNo, snapshot (JSON of form content + candidates), createdAt
- **Comment:** id, requestId, authorId, body, createdAt
- **Attachment:** id, requestId, originalName, storedName, mimeType, sizeBytes, uploadedById, createdAt
- **NotificationLog:** id, requestId?, event, payload (JSON), status (`PENDING`, `SENT`, `FAILED`), attempts, lastError?, createdAt, sentAt?
- **AdminAuditLog:** id, actorId, entity, entityId, change (JSON), createdAt
- **RefCounter:** year (PK), lastNo

### 6.2 Authentication and authorisation

- Sign-in uses Microsoft Entra ID OIDC, restricted to the WCT tenant ID. Unauthenticated users go to `/WCT-Training-RQ/signin`.
- On sign-in, the User row is upserted by `entraOid` (name, email, job title). Department is matched by the Entra `department` string to a configured Department name (case-insensitive). If there's no match, the user is asked to pick a department before their first submission.
- Bootstrap: emails listed in the `BOOTSTRAP_ADMIN_EMAILS` env var get SYS_ADMIN on first login.
- Every server action and route calls `requireUser()` and then checks permissions through `lib/workflow` (`canView`, `allowedActions`). The UI hides actions the user can't take, but the server is the enforcement point.
- Attachment and PDF downloads are served by authorised route handlers. Files are never public, and stored names are random UUIDs.
- **Development-only sign-in:** when `NODE_ENV !== "production"` **and** `AUTH_DEV_LOGIN=true`, a "Sign in as seeded user" page exists, for local testing and end-to-end tests. It is impossible to enable in production builds.

### 6.3 Power Automate integration

- The app POSTs JSON to one HTTP-triggered flow URL (`POWER_AUTOMATE_FLOW_URL`, a secret in the server `.env`).
- Payload:
  `{ event, refNo, title, status, requester:{name,email}, actor:{name,email}, remark, to:[emails], cc:[emails], subject, messageHtml, link }`
- The app decides recipients, subject and message. The flow only sends an Outlook email (and optionally a Teams chat message) to `to`/`cc`. This keeps the flow trivial and the business rules in tested code. The repo will document how to build the flow, step by step.
- Delivery is logged in NotificationLog. Failures are retried automatically up to 3 times, 5 minutes apart, by a cron-invoked endpoint (`POST /api/cron/notifications`, protected by `CRON_SECRET`), and admins can retry manually. A notification failure never blocks or rolls back a workflow action.
- **Licensing note:** the "When an HTTP request is received" trigger requires a Power Automate **Premium** licence for the flow owner.

### 6.4 Microsoft Entra app registration (done once by IT)

- Single-tenant app "WCT HR Forms – Training RQ"
- Redirect URI: `https://hrforms.wct.my/WCT-Training-RQ/api/auth/callback/microsoft-entra-id`
- Delegated: `openid profile email User.Read`
- Application: `User.Read.All` (admin consent), for the server-side people picker only
- Client secret stored in the server `.env` only

---

## 7. Error handling

- Form validation uses Zod on both client and server. Field errors are shown inline, and the server re-validates everything.
- Workflow errors (wrong status, no permission, stale version) return friendly messages and never a stack trace. The request page refreshes to show its current state.
- Graph unavailable: the people picker falls back to manual entry with a notice.
- Power Automate unavailable: the action still succeeds. NotificationLog records the failure for retry, and admins see a warning badge.
- PDF render failure: logged, with "Couldn't generate PDF, please try again" shown.
- Uploads: type and size are checked server-side, and the original filename is sanitised. A file over the limit is rejected with a clear message.
- Unexpected errors: logged server-side (PM2 logs with a request id) and shown on a generic error page with that id.

---

## 8. Testing strategy

- **Unit (Vitest, written test-first):** the workflow state machine (every transition, every forbidden transition, the send-back rules, self-approval guard, notification recipients per event including the BU Admin on every rejection), ref-number formatting, fee totals, Zod schemas, and the permission helpers.
- **Integration (Vitest + real PostgreSQL):** request services: submit → approve chain, reject and send back to each stage, resubmit creates a revision, stale-version refusal, ref no. allocation under concurrency. Notification logging with a mocked fetch.
- **End-to-end (Playwright, dev sign-in):** requester submits → HOD approves → L&D rejects back to requester → requester resubmits → full approval → PDF downloads. History search and Excel export.
- **CI:** GitHub Actions runs lint, typecheck, unit/integration tests (Postgres service container) and build on every push and PR. Deploy runs only when all of these pass on `main`.

---

## 9. Deployment

- **Server layout:** app at `/opt/wct-training-rq` (git clone of the public repo), env at `/opt/wct-training-rq/.env` (mode 600, never in git), uploads at `/var/lib/wct-training-rq/uploads`, PM2 process `wct-training-rq` on `127.0.0.1:3010`.
- **Nginx:** `location /WCT-Training-RQ/ { proxy_pass http://127.0.0.1:3010; ... }`, without stripping the path, since Next.js uses `basePath`. `client_max_body_size 12m`.
- **GitHub Actions `deploy` job** (on push to `main` after CI passes): SSH into the server with a dedicated deploy user and key (GitHub Secrets: `DEPLOY_HOST`, `DEPLOY_PORT`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`), then run `scripts/deploy.sh`: `git pull` → `npm ci` → `prisma migrate deploy` → `npm run build` → `pm2 reload`. A failed build leaves the previous build running, because the build goes into a fresh directory and is switched in only on success.
- **Cron:** a system crontab entry calls the notification-retry endpoint every 5 minutes.
- **Backups:** nightly `pg_dump` plus an uploads tarball, kept for 30 days (script provided; IT schedules it).
- The repo ships `README.md`, `docs/DEPLOYMENT.md` (server setup from scratch), `docs/POWER_AUTOMATE.md` (flow build guide) and `.env.example`.

---

## 10. Phase 2 (not in V1)

Reminders and SLA escalation for requests pending more than N days; approver delegation for out-of-office; a training calendar view; post-training attendance confirmation, feedback and certificate upload; budget tracking per department.
