# Round 3: demo sign-in, new login page, dashboard order, L&D as System Admin

Date: 2026-10-15 · Status: approved (decisions taken on the user's behalf, listed below) · Builds on `2026-10-15-stakeholder-changes-design.md`

## Intent

Stakeholders reviewing the trial want to:

- pick a demo account straight from the sign-in page;
- see analytics first on the dashboard;
- see the new WCT logo and a new sign-in page.

L&D runs every training requisition, so it gets the highest access.

Success means:

- a stakeholder can open the site, choose "HR Head" and look around;
- doing so can never show or change real staff data.

## Decisions (made without a further round of questions; easy to change)

| Question | Decision |
|---|---|
| Demo sign-in in production? | Yes, behind a server switch `DEMO_LOGIN=true` in `shared/.env`. Off by default. Turn it off at go-live. |
| What can a demo account see? | Only requests raised by demo accounts. This applies everywhere: lists, dashboard, analytics, exports, request pages, files. Actions on real requests were already blocked; that now also holds for demo sign-in. |
| Do demo and real staff mix in routing? (added after review) | No. A demo request is routed, notified and counted among demo accounts only; a real request among real staff only. Real approvers don't get demo requests in their inbox and can't act on them (they use "View as"). Real requests therefore need real BU Admins. The last-admin guard counts active real admins only. |
| Admin settings for demo accounts | Read-only. Lists show demo accounts only. The notification log shows demo requests only. |
| L&D "highest access" | L&D holders get everything System Admins have: Admin settings and "View as". `SYS_ADMIN` stays for IT/support. The last-admin guard counts L&D + System Admins. |
| "Remove audit log" | The Admin settings page and tab are removed. Changes are still recorded in the database for security; only the screen goes. |
| Microsoft icon | We still do not draw Microsoft's logo. The deployer adds the official file at `public/brand/microsoft-logo.svg`; the button already uses it. Steps are in DEPLOYMENT.md §Microsoft icon. |

## 1. Sign-in page (new design, single layer)

- **Background.** The supplied WCT tower photo fills the page as a full-bleed background. It is low resolution (596×335), so:
  - it is upscaled once with Lanczos plus a light sharpen to `public/brand/signin-bg.jpg`;
  - a dark gradient covers the right side, where the sign-in card sits.
- **Left side.** The photo's own logo and slogan show on the left.
- **Card.** A frosted card on the right holds:
  - the new logo;
  - "Training Requisition";
  - "Sign in with Microsoft" (official icon when present);
  - the help line.
- **Mobile.** The card is centred and the whole photo is darkened.
- **Demo accounts.** When `DEMO_LOGIN` (or dev login) is on, the card shows a "Try a demo account" section:
  - one button per active `@demo.wct.my` user;
  - each shows the name and role label (Requester / Department HOD / BU Admin / L&D · System Admin / HR Head / System Admin);
  - each posts to `POST /api/auth/demo-login` with `userId`.
- **The route:**
  - returns 404 unless enabled;
  - accepts only active demo accounts;
  - checks `Origin` against `APP_URL` (stops cross-site login);
  - clears view-as, signs in and redirects to `returnTo`.
- **Banner.** Signed-in demo accounts see a banner: "Demo account · You're seeing demo requests only." with a sign-out link.

## 2. Demo scope (server side)

- `isDemoUser(user)`: email ends `@demo.wct.my`.
- `demoScopeWhere(user)`: for demo users, `requester_id IN (demo users)`. It is ANDed into:
  - `visibleRequestsWhere`
  - `awaitingActionWhere`
  - the reports/analytics scope
- **By-id reads and actions** (request page, PDF, Excel, attachments, revisions, comments, actions) go through `assertDemoScope`. This replaces `assertViewAsScope` and now applies to every demo user:
  - reads answer "not found";
  - writes keep the existing 403 message.
- **Admin service.**
  - Writes throw "Demo accounts can look at settings but can't change them."
  - Reads take the demo filter.

## 3. Access

- New helper `isSystemAdmin(user)`: true for `SYS_ADMIN` or `LND`. It is used by:
  - the admin layout guard and admin actions/service;
  - the "View as" eligibility and the menu;
  - the nav "Admin settings".
- Roles page copy:
  - L&D: "Review requests after the BU Admin and manage these settings (full access)."
  - System Admins: "IT support access to these settings…"
- Role label for L&D holders: "L&D Team (System Admin)".

## 4. Admin settings

- Remove the `/admin/audit` page, its tab and `listAudit`.
- Rename "Departments & HODs" to **Head of Departments**.

## 5. Dashboard

The order, top to bottom:

1. Greeting, plus the New Training Requisition button.
2. **One KPI bar** (merges the old placards and the analytics KPIs).
   - Users who see analytics get 5 tiles:
     - Awaiting your action
     - My open requests
     - Requests submitted {year}
     - Requests approved {year}
     - Approved training spend {year}
   - Others get 4 tiles: Awaiting your action, My open requests, Approved in {year}, Approved spend {year}.
   - The year select and "Export to Excel" sit in the bar's header ("Overview · Group-wide · 2026").
3. **Analytics charts** (unchanged content). They sit directly under the bar, for those who can see analytics.
4. Awaiting your action list, Recent activity, Upcoming approved trainings.
5. **Availability board**, full width, at the bottom.

## 6. Logo

- The new logo (165×99, transparent) replaces:
  - `src/components/shell/wct-logo.png`
  - `public/brand/wct-logo.png` (PDF and email; upscaled 2.5×)
  - `src/app/icon.png`
  - `src/app/apple-icon.png`
- On the dark shell it sits on a white rounded chip, so the grey road stays visible.

## Testing

- **Unit**
  - `isSystemAdmin`
  - `demoScopeWhere` presence
  - role labels
- **Integration**
  - demo user can't see real requests (list, by id, analytics)
  - demo admin writes rejected
  - L&D can run admin writes
  - last-admin guard
  - demo-login route: off → 404; real user → refused; demo user → signed in
- **E2E**
  - sign-in page lists demo accounts and signs in as HR Head
  - dashboard order: KPI bar → analytics → board last
- **Browser check** of the sign-in page (desktop and mobile) and the dashboard per role.
