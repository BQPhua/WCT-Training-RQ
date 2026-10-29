# Round 4: "Twilight" redesign, motion, and the Malls/Land approval route

Date: 2026-10-29 · Owner: Phua (HR Transformation) · Status: approved in chat, awaiting spec review

## 1. Goals

1. **Approval route.** Malls and Land requests finish at L&D. Only E&C requests go on to HR Head.
2. **Look and feel.** A modern "twilight" redesign of the whole app. It uses WCT red with a deep navy taken from the Paradigm Mall photo, and keeps every feature and flow.
3. **Motion.** Purposeful, restrained animation using the `motion` library (Motion for React). It follows the Motion skill's best practices.
4. **Sign-in page.** Rebuilt around the Paradigm Mall photo, and sharp on a 1080p display.

Non-goals: no new features, no changes to permissions or data capture, and no change to the email (Power Automate) templates beyond the route wording.

## 2. Approval route

### 2.1 Rule

| Business unit | Route |
|---|---|
| E&C (and any unit with the switch on, or a request with no unit) | HOD → BU Admin → L&D → **HR Head (final)** |
| Land, Malls (switch off) | HOD → BU Admin → **L&D (final)** |

### 2.2 Data

- Add a column to `business_units`: `requires_hr_approval boolean not null default true`.
- Migration `0002_bu_requires_hr_approval.sql` adds the column, then sets it to `false` where `code in ('LAND','MALLS')`.
- Admin settings → Business units & departments gets a switch per unit, labelled **"Final approval by HR Head"**. If the live codes differ from the seed codes, an admin fixes it there.
- The seed sets the flag for LAND and MALLS to false. The demo data follows the seed.

### 2.3 Workflow

- `RequestRef` gains `requiresHrApproval: boolean`. It comes from the request's business unit at the time of each action. A missing unit counts as `true`.
- `transition()` handles APPROVE at `PENDING_LND`:
  - If `requiresHrApproval`, the request moves to `PENDING_HR` with the event `LND_APPROVED` (unchanged behaviour).
  - Otherwise, it moves to `APPROVED` with the event `FINAL_APPROVED` and sets `finalisedAt`. The "final approval" notification goes out as it does today.
- Requests already in `PENDING_HR` are left as they are. HR Head can still approve or reject them, whatever their unit.
- The self-approval rules stay as they are.

### 2.4 Places that show the route

- **Progress tracker** (`buildStations`): the HR Head station appears only when one of these is true:
  - the unit requires HR approval;
  - the request is in `PENDING_HR`;
  - there is an HR approval in the current round.
- **Status label for an APPROVED Malls/Land request:** "Approved" (unchanged).
- **History timeline:** a `FINAL_APPROVED` event raised by L&D reads "Final approval (L&D)".
- **PDF:** the HR Head approval block reads "Not required for {unit}" when it was skipped.
- **Email payload:** the route summary or recipients for `FINAL_APPROVED` don't change. Recipients are worked out from the event, not the stage.
- **Dashboard, reports and the "Pending HR Head" filters:** these need no change. Fewer requests will simply reach that status.
- **Admin roles page copy:** says HR Head approves E&C requests only.

### 2.5 Tests (TDD)

- **Unit tests, `transitions`:**
  - L&D approval goes to `PENDING_HR` when `requiresHrApproval` is true.
  - L&D approval goes to `APPROVED` with `FINAL_APPROVED` when it is false.
  - `PENDING_HR` can still be approved when the flag is false (in-flight requests).
- **Unit tests, `buildStations`:** the HR station is hidden for Malls/Land, and shown for in-flight or HR-approved requests.
- **Integration tests:** submitting and approving a Malls request through the service ends at APPROVED after L&D. An E&C request still reaches `PENDING_HR`. The admin switch changes the route for new approvals.

## 3. Visual system ("twilight")

Every colour is a CSS token in `src/app/globals.css`, so this round mostly redefines tokens and restyles shared components. Page code changes only where layout changes.

### 3.1 Colour tokens (light)

| Role | Value (approx.) | Notes |
|---|---|---|
| Ground | `oklch(0.975 0.005 260)` | Cool light grey |
| Surface | white | Cards, tables, dialogs |
| Shell (sidebar) | `oklch(0.2 0.06 265)` → `oklch(0.25 0.07 268)` gradient | Twilight navy from the photo's sky |
| Brand | `#E30613` / `oklch(0.58 0.235 27)` | WCT logo red. Used for primary buttons, the active nav marker, brand marks and focus accents on brand elements |
| Brand-soft | `oklch(0.96 0.03 25)` | Tinted backgrounds |
| Sky (info) | `oklch(0.64 0.13 262)` | Photo sky blue. Used for links, info, charts and the "pending" status |
| Ink / ink-2 / muted | navy-tinted greys | Text |

Statuses:
- Approved: green
- Pending: sky blue
- Returned: orange `oklch(0.7 0.16 55)`. Not red, so it doesn't clash with the brand.
- Cancelled: grey
- Draft: light grey

Destructive actions use the danger crimson as **outline** buttons with a confirmation step. Primary buttons are filled brand red with white text, which meets AA contrast (about 4.6:1).

Dark mode is kept:
- navy ground `oklch(0.17 0.035 265)`;
- surfaces one step lighter;
- brand red lifted to `oklch(0.66 0.21 27)`.

Every text/background pair is checked for WCAG AA contrast.

### 3.2 Shape, type and space

- **Corners:** radius 12px for cards and 10px for inputs and buttons.
- **Shadows:** a softer, layered set (`--shadow-sm/md/lg`).
- **Type:** Geist Sans stays. Figures use `font-variant-numeric: tabular-nums`. Page titles are 24/28 semibold; section titles 15/20 semibold.
- **Page header pattern** on every page: title, an optional one-line description, and actions on the right. Shared `PageHeader` component.
- **Tables:** sticky header, row hover, comfortable 44px rows, status pill, and empty states with an icon and a one-line hint.
- **Forms:**
  - Grouped sections in cards.
  - Labels above fields.
  - Clearer focus rings (2px sky ring).
  - Inline errors in danger red.

### 3.3 Shell

- **Desktop:** navy sidebar with the WCT logo on a white chip and nav groups. The active item has a red left marker and a lighter background.
- **Top bar:** page context, the theme toggle and the user menu.
- **Mobile:** the sidebar becomes a slide-over drawer.

### 3.4 Pages covered

Sign-in, dashboard, new/edit request form, request detail (tracker, actions, comments, timeline, revisions, L&D fields), my requests, approvals, history, reports, admin (overview, users, roles, organisation, notifications).

## 4. Motion

- Add the `motion` dependency.
  - Import from `motion/react` in client components.
  - Use `motion/react-client` for `motion.*` elements in server components.
- Put `<MotionConfig reducedMotion="user">` at the root providers.
- **Effects:**
  - Page content: fade in plus an 8px rise, spring with `visualDuration` 0.25 and `bounce` 0.
  - Sidebar active marker and tab underline: shared `layoutId`, made unique per instance.
  - Dialog and menu: Radix `forceMount` with `AnimatePresence`, opacity plus scale 0.97→1, about 0.18s.
  - Progress tracker: completed connectors grow with `scaleX` (a transform, not `width`).
  - Table/list rows: a stagger of 30ms for the first 8 rows on first render only.
  - Dashboard key figures: fade and rise.
  - Sign-in: the card rises in. The photo does a slow 1.04→1 settle using a transform.
- **Rules:**
  - Animate only transforms and opacity.
  - Keep durations between 150 and 300ms.
  - No animation that is only decoration.
  - Nothing slows down input.
  - With reduced motion on, transform animations are switched off.

## 5. Sign-in page

### 5.1 Layout

- **lg and up:** a two-column grid.
  - Left column, `minmax(0, 55%)`: the photo panel, using `object-fit: cover` with `object-position` centred on the mall entrance. A navy gradient at the bottom carries the WCT logo, "Training Requisition" and "WCT Holdings Berhad".
  - Right column: the sign-in panel on the ground colour, with a centred card holding the heading, the Microsoft button and any error message.
  - When `DEMO_LOGIN=true`, the demo accounts, grouped by role, appear below the card in a scrollable list.
- **Below lg:** the photo is a 34vh banner at the top and the form follows.

### 5.2 Image quality

- **Source:** the supplied photo, 355×284.
- **Upscale:** Real-ESRGAN ×4 gives 1420×1136, followed by a light sharpen check.
- **Exports:**
  - `public/brand/signin-paradigm-1420.avif`, `.webp` and `.jpg` (quality about 85);
  - 710-wide versions for small screens.
- **Delivery:** a `<picture>` element with `srcset` and `sizes="(min-width:1024px) 55vw, 100vw"`.
- **Expected sharpness:**
  - On a 1920×1080 screen, the panel is about 1056×1080. With cover it renders about 1350×1080, below the 1420×1136 source, so it is sharp at 1× DPR.
  - On 1440p or 2× DPR screens it will be mildly upscaled.
  - A higher-resolution original (at least 2400px wide) would fix that. This stays an open question for the stakeholder.
- **Clean-up:** the old `signin-bg*.jpg` files are deleted.

## 6. Verification

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:integration`.
- A Playwright screenshot pass of every page, in light and dark, at 390px and 1440px, plus the sign-in page at 1920×1080. Each screenshot is reviewed by eye.
- Contrast check on all token pairs.
- Final code review, then a bundle for the user to push. No direct push and no server changes. The auto-deploy runs the migration as part of the release (`scripts/deploy.sh`).

## 7. Open questions

- Is there a higher-resolution original of the Paradigm Mall photo (at least 2400px wide)?
