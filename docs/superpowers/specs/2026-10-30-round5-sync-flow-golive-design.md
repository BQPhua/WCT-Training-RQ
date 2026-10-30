# Round 5: Microsoft 365 staff sync, approval-flow admin, go-live command, collapsible sidebar

Date: 2026-10-30 · Owner: Phua (HR Transformation) · Status: design approved in chat, awaiting spec review

## 1. Goals

1. **Staff sync.** All enabled WCT staff from Microsoft 365 appear in Training RQ, so L&D can assign HODs, BU Admins and roles without anyone signing in first.
2. **Approval flow admin.** Admin settings shows each business unit's approval flow as numbered steps. L&D can switch the optional steps (BU Admin, HR Head) on or off per unit and edit each step's short description.
3. **Go-live command.** One server command removes all demo data and turns off demo sign-in.
4. **Collapsible sidebar.** On desktop, the sidebar can shrink to an icon-only rail.

Non-goals:
- custom or reordered steps;
- new roles;
- automatic deactivation of leavers;
- any change to the PDF layout.

## 2. Microsoft 365 staff sync

### 2.1 Source
- **Request:** Microsoft Graph `GET /v1.0/users` with:
  - `$select=id,displayName,mail,userPrincipalName,jobTitle,department,accountEnabled,userType`
  - `$filter=accountEnabled eq true and userType eq 'Member'`
  - `$count=true` and the header `ConsistencyLevel: eventual`
  - `$top=999`, following `@odata.nextLink` to the end.
- **Auth:** an app-only token. It reuses the existing token code in `directory.ts` (client credentials and `User.Read.All`).
- **Email:** `mail` if present, otherwise `userPrincipalName`. Lower-cased. A person with neither is skipped.
- **Kill switch:** the sync only runs when `DIRECTORY_SEARCH_GRAPH=true` and the `ENTRA_*` settings are present. Otherwise "Sync now" explains what is missing.

### 2.2 Matching (same rule as sign-in)
- **Match order:** an existing user by `entra_oid`, then by email.
  - **No match:** insert the person with `last_login_at` null.
  - **Match:** update `entra_oid`, `email`, `name`, `job_title` and `entra_department`.
- **Department:** set by a case-insensitive name match. An unmatched or empty Microsoft 365 department never clears a department that is already set.
- **Never touched:**
  - `@demo.wct.my` users;
  - users an admin deactivated (`is_active = false`). They are not reactivated, and their row is not updated.
- **Seen marker:** every matched user gets `directory_seen_at = <run start>`. This is a new column, `users.directory_seen_at timestamptz null`.
- **Leavers:** after a run that completed fully, an active non-demo user who has an `entra_oid` and a `directory_seen_at` older than the run start is shown as **"No longer in Microsoft 365"**. Nobody is deactivated automatically. A partial run (an error mid-paging) records the error and flags nobody.
- **Speed:** writes are batched (one transaction per 500 people), so a run over about 2,000 staff finishes in seconds.

### 2.3 Runs
- **New table** `directory_sync_runs` with these columns:
  - `id`, `started_at`, `finished_at`
  - `trigger` (`"cron"` or `"manual"`) and `triggered_by` (user id, nullable)
  - `added`, `updated`, `skipped`
  - `ok` (boolean) and `error` (text)
- **Triggers:**
  - **Cron:** `POST /api/cron/directory-sync`, using the same Bearer `CRON_SECRET` check as the notifications cron. A line is added to `deploy/crontab.txt` to run it nightly at 01:40.
  - **Manual:** a **Sync now** server action on Admin settings → Users. It needs `requireAdmin`, so demo accounts are refused. A second run while one is in progress gets "A sync is already running", enforced with a Postgres advisory lock.
- **Users page:**
  - The page shows: "Last synced 30/10/2026, 1:40 AM · 12 added, 3 updated".
  - A failed run shows the error.
  - The table gains two badges: "Not signed in yet" when `last_login_at` is null, and "No longer in Microsoft 365".
  - A filter offers All, Signed in, Not signed in and No longer in M365.

### 2.4 Searchable person picker
- **New component** `PersonPicker`: a combobox with a text input and a listbox.
  - It searches active, in-scope users by name or email after 2 characters, using a debounced server action. Demo viewers only see demo people.
  - It shows up to 10 results, each with name, email and department.
  - It is fully keyboard-operable (ARIA combobox pattern).
- **Replaces the `NativeSelect` user lists in:**
  - the BU Admins editor;
  - the HOD selector in the department dialog;
  - the role editor.
- `userOptions()` (full list) is no longer sent to the page. It is replaced by `searchPeople(user, q)`, with a limit of 10.

## 3. Approval flow admin

### 3.1 Data
- **New column:** `business_units.requires_bu_admin boolean not null default true`. It joins the existing `requires_hr_approval`.
- **New column:** `business_units.step_notes jsonb not null default '{}'`. It holds optional short descriptions keyed by step (`REQUESTER`, `HOD`, `BU`, `LND`, `HR`), each at most 40 characters, set per unit.
  - Defaults when empty: Requester "Raises the request", HOD "Department head", BU "BU Admin review", L&D "Reviews (and approves for this unit)", HR Head "Final approval".
- **Admin service:** `updateBusinessUnitFlow(user, buId, { requiresBuAdmin, requiresHrApproval, stepNotes })`. It is `requireAdmin` and audit-logged.
- The "Final approval by HR Head" checkbox is removed from the business-unit dialog, so the flow is managed only on the new tab.

### 3.2 Route rules
- **One pure function** in `src/lib/workflow/route.ts`:
  - `routeOf({ requiresBuAdmin, requiresHrApproval })` returns the ordered approval stages: `HOD`, then `BU` if on, then `LND`, then `HR` if on.
  - `nextStatus(from, route)` gives the status that follows an approval.
- **`transition()` uses it.** `RequestRef` gains an optional `requiresBuAdmin`; a missing value counts as `true`.
  - With the BU Admin step off, HOD approval goes from `PENDING_HOD` straight to `PENDING_LND`, and the event is still `HOD_APPROVED`.
  - The HR Head rule from round 4 stays the same.
- **In-flight requests:** a request already at `PENDING_BU` when the step is turned off can still be approved by the BU Admin.
- **Submit:** the "unit has no BU Admin" block (`assertBuAdmin`) applies only when the step is on.
- **Recipients:**
  - **`HOD_APPROVED`:** when the next status is `PENDING_LND`, the email goes to L&D, with the requester copied and the unit's BU Admins also copied (so they stay informed). Otherwise it goes to the BU Admins as today.
  - **Other events:** BU Admins stay copied on rejections, final approval and cancellation, as today.

### 3.3 Display (one source)
- **Tracker** (`buildStations`):
  - Open requests show the stations from `routeOf(unit)`, plus any station the request is currently at or has already passed in this round.
  - Approved requests show exactly the stations that have an approval in this round.
- **Request form panel:** built from `routeOf(requester's unit)`.
- **PDF:** the HR note follows the round 4 rule. BU Admin approvals stay in the approval trail as they are today.
- **Emails:** the `HOD_APPROVED` headline names the next stage: BU Admin or L&D Team.

### 3.4 Admin UI
- **A new tab, "Approval flow"**, at `/admin/flow`, placed first in Admin settings.
- **For each active business unit:**
  - The card header shows the unit name and code.
  - Below it is a horizontal row of numbered steps, wrapping to a vertical list on phones. It follows the reference image: a number in a circle, the step name in bold, and the description in muted text below. A thin line joins each step to the next.
  - The steps are: ① Raise (Requester) → ② Approve (Department HOD) → ③ BU Admin (names of the unit's BU Admins) → ④ L&D Team → ⑤ HR Head → ✓ Approved.
  - Turned-off steps are greyed and struck through, labelled "Skipped", and left out of the numbering.
  - The steps that can be switched (BU Admin, HR Head) each have a toggle.
- **Turning a step off** asks for confirmation: "New approvals for {unit} will skip the {step}. Requests already waiting there stay with them."
- **Step descriptions** are edited through an "Edit descriptions" button that opens a small dialog with one 40-character field per step.
- **The L&D step's description** becomes "Reviews and gives final approval" automatically when HR Head is off, unless an admin has set a custom one.
- **Demo admins** can see the tab, but its controls are disabled, with the existing note explaining why.

## 4. Go-live command

- **New subcommand:** `scripts/demo-data.sh golive`, run as `trq`:
  1. It prints what it will do and asks the user to type `GO-LIVE` to continue. Anything else aborts.
  2. It runs the existing `remove` steps: demo files, then `demo-data-remove.sql`.
  3. In `shared/.env` it sets `DEMO_LOGIN=false`, adding the line if it is missing and keeping a `.env.bak-<stamp>` backup.
  4. It reloads the app with `pm2 reload wct-training-rq --update-env`.
  5. It prints how many demo users and requests are left (should be 0) and a reminder to check Admin settings → Roles.
- **Unattended use:** `--yes` skips the prompt (for scripts).
- **Docs:** DEPLOYMENT.md gets a "Go live" section.

## 5. Collapsible sidebar (desktop)

- **The toggle** is a button at the foot of the rail: "Collapse sidebar" or "Expand sidebar", with `aria-expanded`.
- **Collapsed state:**
  - The rail is 72px wide and shows icons only.
  - Each item has a tooltip with its label.
  - The approvals badge becomes a red dot.
  - The wordmark becomes the logo chip alone.
  - The user menu shows only the avatar.
- **Remembering the choice:** it is stored in a cookie (`trq_sidebar=collapsed`) and read by the server layout, so the first paint is correct with no flicker.
- **Motion:** the rail's width and the content's left padding animate over about 200ms. Animating layout properties is an accepted exception here, because it happens once, on a user action. With reduced motion it is instant.
- **Below 1024px:** no change (the drawer).

## 6. Testing

- **Unit tests:**
  - `routeOf` and `nextStatus` for all four flag combinations;
  - `transition` with the BU Admin step off, plus an in-flight `PENDING_BU` request;
  - recipients for `HOD_APPROVED` going to L&D;
  - tracker stations for each combination, plus finished requests;
  - the directory paging and mapping (a mocked fetch: two pages, a guest skipped, a missing mail field, UPN used as a fallback).
- **Integration tests:**
  - Sync inserts new people, updates existing ones, never touches demo or deactivated users, and flags leavers only after a complete run. A partial run flags nobody.
  - The advisory lock refuses a second concurrent run.
  - `updateBusinessUnitFlow` needs an admin; it saves and is audit-logged.
  - A Land request with the BU Admin step off goes from HOD to L&D.
  - Submitting to a unit with no BU Admin works when the step is off.
  - `searchPeople` is scoped (demo vs real) and limited to 10 results.
- **End-to-end tests:**
  - the flow tab shows the steps and their toggles, read-only for demo accounts;
  - the person picker finds people by typing (a demo L&D sees only demo people; saving is covered by the integration tests, because demo admins can't save);
  - the sidebar collapses, the state survives a reload, and the tooltips show;
- **Script test** (a bash test run against the test database and a temporary `APP_ROOT`): `golive --yes` leaves 0 demo users and sets `DEMO_LOGIN=false`, keeping a backup of the env file. The PM2 reload is stubbed.
- **Checks:** contrast, lint, typecheck, build, the e2e suite, a screenshot pass (flow tab in light and dark at 390 and 1440px, collapsed sidebar), then a final review.

## 7. Open questions

- None blocking. The first real sync on the server is the live test: the user runs "Sync now" and checks the counts.
