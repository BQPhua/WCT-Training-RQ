---
name: WCT Training RQ
description: WCT Berhad's training requisition system, built as a sales-gallery availability board where every request's status reads at a glance.
colors:
  brand: "oklch(0.7 0.105 72)"
  brand-hover: "oklch(0.66 0.11 70)"
  brand-fg: "oklch(0.21 0.04 258)"
  brand-text: "oklch(0.5 0.095 66)"
  brand-soft: "oklch(0.96 0.03 80)"
  shell: "oklch(0.225 0.048 259)"
  shell-2: "oklch(0.275 0.052 259)"
  shell-line: "oklch(0.32 0.045 259)"
  shell-fg: "oklch(0.95 0.01 255)"
  shell-muted: "oklch(0.76 0.03 258)"
  ground: "oklch(0.972 0.006 255)"
  surface: "oklch(1 0 0)"
  surface-2: "oklch(0.985 0.004 255)"
  ink: "oklch(0.235 0.035 258)"
  ink-2: "oklch(0.42 0.03 258)"
  muted: "oklch(0.52 0.022 258)"
  line: "oklch(0.912 0.01 255)"
  line-strong: "oklch(0.86 0.014 255)"
  st-approved: "oklch(0.6 0.13 155)"
  st-approved-soft: "oklch(0.95 0.04 155)"
  st-approved-text: "oklch(0.42 0.1 155)"
  st-pending: "oklch(0.8 0.15 86)"
  st-pending-soft: "oklch(0.96 0.06 92)"
  st-pending-text: "oklch(0.47 0.1 70)"
  st-returned: "oklch(0.66 0.17 32)"
  st-returned-soft: "oklch(0.955 0.035 32)"
  st-returned-text: "oklch(0.5 0.16 32)"
  st-cancelled: "oklch(0.7 0.015 258)"
  st-cancelled-soft: "oklch(0.95 0.006 258)"
  st-cancelled-text: "oklch(0.47 0.02 258)"
  st-draft: "oklch(0.93 0.008 258)"
  st-draft-text: "oklch(0.45 0.02 258)"
  danger: "oklch(0.56 0.19 27)"
  danger-soft: "oklch(0.96 0.03 27)"
  focus: "oklch(0.6 0.13 245)"
  series-1: "#2e5a9c"
  series-2: "#a8742a"
  series-3: "#c75b8e"
  grid: "oklch(0.93 0.008 255)"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  figure:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "-0.025em"
    fontFeature: "\"tnum\""
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.43
    fontFeature: "\"ss01\", \"cv11\""
  body-sm:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  button:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.43
  section-label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    letterSpacing: "0.08em"
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.08em"
  caption:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.33
    fontFeature: "\"tnum\""
rounded:
  swatch: "3px"
  tile: "5px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  full: "9999px"
spacing:
  board-gap: "6px"
  sm: "8px"
  md: "16px"
  panel-x: "20px"
  stack: "24px"
  gutter-mobile: "16px"
  gutter-tablet: "24px"
  gutter-desktop: "40px"
components:
  button-brand:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.brand-fg}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 16px"
  button-brand-hover:
    backgroundColor: "{colors.brand-hover}"
    textColor: "{colors.brand-fg}"
  button-brand-lg:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.brand-fg}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 20px"
  button-primary:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.shell-fg}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.shell-2}"
    textColor: "{colors.shell-fg}"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 16px"
  button-outline-hover:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
  button-ghost:
    textColor: "{colors.ink-2}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: "32px"
    padding: "0 12px"
  button-approve:
    backgroundColor: "{colors.st-approved}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 16px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 12px"
  field-label:
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
  panel-header:
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    padding: "16px 20px"
  status-badge-approved:
    backgroundColor: "{colors.st-approved-soft}"
    textColor: "{colors.st-approved-text}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  status-badge-pending:
    backgroundColor: "{colors.st-pending-soft}"
    textColor: "{colors.st-pending-text}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  status-badge-returned:
    backgroundColor: "{colors.st-returned-soft}"
    textColor: "{colors.st-returned-text}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  status-badge-cancelled:
    backgroundColor: "{colors.st-cancelled-soft}"
    textColor: "{colors.st-cancelled-text}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  status-badge-draft:
    backgroundColor: "{colors.st-draft}"
    textColor: "{colors.st-draft-text}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  board-tile-approved:
    backgroundColor: "{colors.st-approved}"
    textColor: "{colors.surface}"
    rounded: "{rounded.tile}"
    width: "52px"
  board-tile-pending:
    backgroundColor: "{colors.st-pending}"
    rounded: "{rounded.tile}"
    width: "52px"
  board-tile-returned:
    backgroundColor: "{colors.st-returned}"
    textColor: "{colors.surface}"
    rounded: "{rounded.tile}"
    width: "52px"
  board-tile-cancelled:
    backgroundColor: "{colors.st-cancelled-soft}"
    textColor: "{colors.st-cancelled-text}"
    rounded: "{rounded.tile}"
    width: "52px"
  board-tile-draft:
    backgroundColor: "{colors.st-draft}"
    textColor: "{colors.st-draft-text}"
    rounded: "{rounded.tile}"
    width: "52px"
  nav-item:
    textColor: "{colors.shell-muted}"
    rounded: "{rounded.lg}"
    height: "40px"
    padding: "0 12px"
  nav-item-active:
    backgroundColor: "{colors.shell-2}"
    textColor: "{colors.shell-fg}"
    rounded: "{rounded.lg}"
    height: "40px"
  nav-badge:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.brand-fg}"
    rounded: "{rounded.full}"
    padding: "2px 6px"
  tooltip:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.shell-fg}"
    rounded: "{rounded.sm}"
    padding: "6px 10px"
  tab-active:
    textColor: "{colors.ink}"
    height: "40px"
    padding: "0 12px"
---

# Design System: WCT Training RQ

## Overview

**Creative North Star: "The Sales-Gallery Board"**

The app reads like the availability chart on the wall of a property sales gallery. The visitor takes in the whole year's requests at a glance and can see what is settled, what is on hold and what was turned back before reading any words. A deep ink-navy shell holds the navigation the way a gallery's dark joinery frames the board. Crisp white work cards sit on a cool, faintly blue-tinted ground. A single brass accent marks what to act on, and a fixed five-colour status vocabulary (approved green, pending amber, returned coral, cancelled slate, draft grey) carries meaning on every screen.

The density is that of a working tool. Panels are flat, sit on a 1px hairline and a whisper of shadow, and carry quiet sentence-case titles. Numbers always use tabular figures. Small, tracked, uppercase labels set in Geist name the fields the way a placard names a unit, and they echo the paper form WCT-F-4.18-2 that the system replaces. The world deliberately rejects the grey SaaS sidebar with one blue accent: the shell is navy, the accent is brass, and colour is spent on status, not decoration.

The brass is a placeholder. WCT will supply its official corporate colours and logo later, so every brand use goes through the swappable `--brand-*` tokens, and the "WCT" wordmark tile is a stand-in component. The printable PDF is a separate case: it reproduces the paper form's slate-and-Helvetica look (form evidence) rather than the app's world.

**Key Characteristics:**
- Ink-navy shell (sidebar, mobile header, tooltips, overlays) around white work panels on a cool ground.
- One swappable brass accent for "act here": primary action, awaiting counts, the approvals badge, rings on units waiting for you.
- A reserved status vocabulary of five tones, used as dots, badges, board tiles and tracker stations, and never for anything else.
- Geist Sans with tabular numerals throughout; 11px uppercase tracked placard labels.
- The month-row availability board is the signature element, and the transit-line progress tracker is its companion on detail pages.
- Full light and dark themes driven by the same token names.

## Colors

The palette is cool navy neutrals with one warm metal, plus a status vocabulary reserved for status alone. Light-mode values are normative in the frontmatter. Dark-mode values for the same token names are in `.impeccable/design.json` (`colorMeta.*.dark`) and in `src/app/globals.css` under `.dark`.

### Primary
- **Gallery Brass** (`brand`): the swappable brand accent. It fills the "New training request" button, the wordmark tile, the Approvals count badge and the active-tab underline. It also draws the 2px ring around board units awaiting the viewer, colours the active nav icon and sets the page's `accent-color` (checkboxes, radios). Text on a brass fill is always **Brass Ink** (`brand-fg`), a dark navy, never white.
- **Burnished Brass** (`brand-hover`): the pressed-in hover state of brass fills.
- **Brass Text** (`brand-text`): a darker brass for inline links, the "Awaiting your action" KPI figure when it is non-zero, month labels on date chips, "Section n" numbers in form headings, and the text caret.
- **Brass Wash** (`brand-soft`): the avatar background and other light brass tints.

### Secondary
- **Gallery Ink-Navy** (`shell`): the sidebar, mobile header, mobile sheet, tooltips, the request reference chip and the primary (non-brand) button. At 50% it also dims the overlay behind dialogs.
- **Lit Navy** (`shell-2`): the active nav item background and shell hover (at 60%).
- **Shell Seam** (`shell-line`): dividers inside the shell, such as the line above the user menu and the mobile header border.
- **Shell Paper** (`shell-fg`) / **Shell Mist** (`shell-muted`): primary and secondary text on navy.

### Neutral
- **Cool Gallery Ground** (`ground`): the page background behind panels.
- **Card White** (`surface`): panels, inputs, menus, dialogs.
- **Card Shade** (`surface-2`): row hover, table header band, KPI hover, date chips.
- **Ink** (`ink`): headings and primary text. **Ink Two** (`ink-2`): field labels and secondary emphasis. **Muted Slate** (`muted`): descriptions, timestamps, meta lines.
- **Hairline** (`line`): panel borders, dividers, the board's month spine. **Firm Hairline** (`line-strong`): input and outline-button borders, the draft dot, upcoming tracker stations.
- **Signal Blue** (`focus`): the global 2px focus outline (2px offset) and input focus border with a 3px ring at 20%. Inside the navy shell, focus rings switch to brass.
- **Danger Red** (`danger`) / `danger-soft`: destructive buttons, required asterisks, field errors and sign-in errors. Danger red is for errors and destruction. It is not a status colour: a "returned" request is coral.

### Status Vocabulary (reserved)
Each status has a solid tone (dots, board tiles, tracker stations), a soft wash (badges, banners) and a text tone (badge text, inline status copy):
- **Settled Green** (`st-approved`, `-soft`, `-text`): Approved. It also fills the Approve button and the completed segments of the tracker line.
- **Booking Amber** (`st-pending`, `-soft`, `-text`): Pending HOD / Pending L&D / Pending HR Head, shown on the board legend as "In approval". It also colours the approver's decision callout (amber wash, amber 60% border) and the pulsing current tracker station.
- **Returned Coral** (`st-returned`, `-soft`, `-text`): Returned (sent back for amendment). The Reject button text is coral.
- **Withdrawn Slate** (`st-cancelled`, `-soft`, `-text`): Cancelled. On the board, cancelled units are a soft slate wash with a 135° hatch and an inset ring, so they read as void without colour.
- **Unlisted Grey** (`st-draft`, `st-draft-text`): Draft.

### Data Series
- **Series Navy / Series Brass / Series Rose** (`series-1`, `series-2`, `series-3`): chart colours for Reports (Land, E&C, Malls by business unit; single-series columns use Series Navy). They were validated all-pairs for colour-vision deficiency in light and dark, and they are kept clear of the status hues. **Chart Grid** (`grid`) draws the recessive gridlines.

### Named Rules
**The Reserved Status Rule.** Green, amber, coral, slate and grey mean approved, pending, returned, cancelled and draft. They are never used as chart series, decoration, brand or category colour, and a status is never shown in any other colour.

**The Swappable Brass Rule.** Brand colour enters only through `--brand-*` tokens. Never write a literal brass value, never invent a WCT logo, and treat the "WCT" tile in the wordmark as a placeholder component.

**The Brass Means Act Rule.** Brass marks where the viewer should act or what is waiting for them. Approving itself is green, rejecting is coral, and navigation chrome stays navy.

## Typography

**Display Font:** Geist Sans (self-hosted via the `geist` package, with `ui-sans-serif, system-ui, sans-serif` fallback)
**Body Font:** Geist Sans
**Label/Mono Font:** Geist Sans for labels. Geist Mono is loaded but is not a working voice in the UI.

**Character:** A single workhorse grotesk carries everything. Hierarchy comes from weight (400/500/600), size and the uppercase placard label, not from a second family. Stylistic sets `ss01` and `cv11` are on globally, and headings are balanced with a slight negative track.

### Hierarchy
- **Display** (600, 32px, 1.25, -0.025em): the sign-in hero statement only.
- **Headline** (600, 24px rising to 28px at ≥640px, -0.025em): page titles, the dashboard greeting and request titles on detail pages.
- **Figure** (600, 20px rising to 24px, tabular): KPI strip values such as "RM 31,420.00".
- **Title** (600, 15px): panel headers ("Availability board · 2026", "Awaiting your action"). Dialog titles step up to 18px.
- **Body** (400, 14px, 1.43): default UI text, table cells, list rows. Inputs use 15px below 640px so phones never zoom, and 14px above. Long prose is capped at 70ch.
- **Body small** (400, 13px): panel descriptions, list meta lines, hints, errors.
- **Caption** (400, 12px, tabular): timestamps, KPI labels, table header text.
- **Section label** (600, 13px, uppercase, 0.08em): request-form section headings, prefixed with the brass "Section n" number to mirror the paper form.
- **Label** (600, 11px, uppercase, 0.08em, ink-2): field labels, fieldset legends and the board's month labels (muted). A 10px variant appears on date-chip month abbreviations.

### Named Rules
**The Placard Label Rule.** A field is named in 11px semibold uppercase with 0.08em tracking, like a gallery placard. The style labels a control, a legend or a board row. It never floats above a heading as an eyebrow.

**The Tabular Figures Rule.** Every reference number, fee, count, date and time uses `tabular-nums` (tables get it automatically), so columns of figures line up like a price list.

## Layout

The app is a fixed 256px navy sidebar beside a scrolling work column, capped at 1280px. The main column is padded 16px on phones, 24px from 640px and 40px from 1024px, with 24px top padding on phones and 36px on desktop. Below 1024px the sidebar becomes a 56px sticky navy header with a menu button, the wordmark and a brass icon-only "New request" button, and navigation opens in a left sheet (288px, max 85vw).

Pages stack in 24px rhythm. Dashboard and detail pages split at 1280px into a fluid main column and a 380px right rail ("Awaiting your action", L&D assessment, attachments). Reports use a 300px rail. On phones, when items await the viewer, the awaiting panel moves above the board. The KPI strip is a single panel divided by hairlines: 2×2 on phones, 4 across from 1024px.

Panel interiors use a 20px horizontal inset with 16px vertical padding (24px on form sections at ≥640px). Board units sit on a 6px gap. Tables become stacked card lists below 640px, and a table keeps a minimum width of 820px inside a horizontal scroller above that.

## Elevation & Depth

The system is flat, with a hairline. Panels are defined by a 1px `line` border and the faintest two-layer shadow, so the white cards lift just off the cool ground. Real elevation appears only for things that float: menus and tooltips use the medium shadow, dialogs and the mobile sheet use the large one, and a board unit gains the medium shadow (plus a 2px lift) on hover. All shadows are tinted with ink-navy in light mode and become plain black at higher opacity in dark mode.

### Shadow Vocabulary
- **Resting** (`box-shadow: 0 1px 2px oklch(0.235 0.035 258 / 0.06), 0 1px 1px oklch(0.235 0.035 258 / 0.04)`): panels, inputs, outline and filled buttons.
- **Floating** (`box-shadow: 0 4px 14px -4px oklch(0.235 0.035 258 / 0.14), 0 2px 4px -2px oklch(0.235 0.035 258 / 0.08)`): dropdown menus, tooltips, board-unit hover, the skip link.
- **Modal** (`box-shadow: 0 18px 40px -12px oklch(0.235 0.035 258 / 0.28)`): dialogs and the navigation sheet.

### Named Rules
**The Placard, Not Pedestal Rule.** Cards rest on a hairline, not on a shadow. If something needs more than the resting shadow, it must be floating above the page (a menu, tooltip or dialog), not just important.

## Shapes

Corners are gently rounded and step down with scale. Panels and dialogs are 14px, nav items and menus 10px, buttons and inputs 8px, and tooltips and small chips 6px. Board units are deliberately squarer at 5px, and legend swatches and chart keys are 3px squares, so the board reads as a grid of units rather than a pile of cards. Status badges, legend filters, count badges and avatars are full pills or circles. Chart columns round only their top corners (4px).

The board unit has a fixed 5:4 aspect ratio. The progress tracker uses 29px circular stations with a 3px border, joined by a 3px rounded line. Borders are always 1px hairlines, except the 2px focus outline, the 2px brass "awaiting" ring and the 2px active-tab underline.

## Components

### Buttons
Compact and firm: medium weight, an 8px radius and a 1px press-down on `:active`. Icons are 16px Lucide strokes.
- **Shape:** gently rounded (8px). Sizes: 32px (sm, 13px text), 40px (md), 44px (lg, 15px text, used for the hero action and Sign in), icon-only 40px and 32px.
- **Brand:** brass fill, Brass Ink text, semibold, resting shadow. Reserved for the single "New training request" action per screen (and its mobile icon button).
- **Primary:** ink-navy fill with Shell Paper text, for strong neutral actions such as "Print PDF" and "Sign in with Microsoft". In dark mode it inverts to an ink fill with ground text.
- **Outline (default):** white surface, Firm Hairline border, ink text. Hover moves to Card Shade.
- **Ghost:** no fill, Ink Two text, with a 5% ink wash on hover ("View all").
- **Approve / Danger:** Settled Green and Danger Red fills with white semibold text. Hover darkens via `brightness(0.95)`.
- **Link:** Brass Text with an underline on hover.
- **Focus:** the global 2px Signal Blue outline at 2px offset. Disabled buttons drop to 50% opacity.

### Status Badges
- **Style:** a full pill (2px 10px padding) in 12px medium text, containing a 6px solid status dot and the status label ("Pending L&D"). The background is the status soft wash, the text is the status text tone, and it has a 1px inset ring of the solid tone at 30–50%.
- **State:** static. The badge always shows the exact stage, while the board legend groups the three pending stages as "In approval".

### Cards / Containers (Panel)
- **Corner Style:** 14px.
- **Background:** Card White on the Cool Gallery Ground.
- **Shadow Strategy:** resting shadow plus a 1px Hairline border (see Elevation & Depth).
- **Header:** a 15px semibold title with an optional 13px muted description and right-aligned actions, separated from the body by a hairline.
- **Internal Padding:** 20px × 16px. Lists inside panels run edge to edge with hairline dividers, with rows hovering to Card Shade. Panels are never nested.

### Inputs / Fields
- **Style:** 40px tall, white, with a 1px Firm Hairline border, 8px radius, resting shadow and 12px horizontal padding. Selects carry a drawn chevron, and textareas grow with their content up to 320px.
- **Focus:** the border turns Signal Blue with a 3px 20% blue ring.
- **Error:** shown only after interaction (`:user-invalid` or `aria-invalid`): a Danger Red border with a 3px 16% red ring, and a 13px red message below. Hints use 13px muted text.
- **Disabled:** 60% opacity with a not-allowed cursor.
- **Label:** the Placard Label above the control, with a red asterisk for required fields.

### Navigation
- **Sidebar:** the navy shell, with the wordmark at the top, nav in the middle and the user menu (avatar, name, department) at the bottom behind a Shell Seam divider. Items are 40px tall and 14px medium, with a 10px radius and an 18px Lucide icon. At rest they use Shell Mist text. On hover they get a 60% Lit Navy wash and Shell Paper text. The active item has a Lit Navy fill, Shell Paper text and a **brass icon**. The Approvals item carries a brass pill count with tabular figures, capped at "99+".
- **Mobile:** a 56px sticky navy header with a hamburger that opens the same sidebar in a left sheet.
- **Tabs:** 40px triggers in 14px medium muted text over a hairline. The active tab gets ink text and a 2px brass underline.
- **Tooltips / menus:** tooltips are navy with Shell Paper text in 12px, a 6px radius and an arrow. Menus are white, with a 10px radius, the floating shadow and items highlighted with a 5% ink wash.

### Availability Board (signature)
The year's requests appear as units on a sales-gallery availability chart: one row per submission month (latest on top), and one unit per request labelled with the last four digits of its reference number.
- **Rows:** a 44px right-aligned month label (11px uppercase tracked, muted, such as "SEPT"), a 1px Hairline spine, an auto-fill grid of units (minimum 52px, 6px gap) and, from 640px, a right-hand tally ("3 requests / 2 approved", with the approved count in Settled Green).
- **Units:** 5:4 aspect ratio, 5px radius, 11px semibold tabular number. Approved and returned units have solid fills with white numbers. Pending units have a solid amber fill with a dark amber-brown number. Cancelled units have a hatched slate wash. Drafts are grey. A unit waiting for the viewer gets a 2px brass ring offset 2px from the surface, explained by a legend line under the board. On hover a unit lifts 2px with the floating shadow. Each unit is a link with a full accessible label and a navy tooltip (reference number, title, requester, status, start date).
- **Legend filter:** pill toggles (32px, 13px) with a 10px status swatch, the label and a tabular count. Pressing one inverts it to an ink fill and dims every other unit to 20% opacity and full desaturation.
- **Motion:** units arrive with the `tile` animation (fade, scale from 0.86 and de-blur over 520ms on `cubic-bezier(0.16, 1, 0.3, 1)`), staggered 60ms per row and 14ms per unit with a 700ms cap.

### Progress Tracker
A transit-line tracker on the request detail page, horizontal from 640px and vertical below that. Five stations: Submitted, Department HOD, L&D review, HR Head, Approved. Done stations are filled green with a check, and the line between done stations turns green. The current station has an amber wash, an amber border, a centre dot and a slow 2.4s pulse ring. Returned stations are filled coral with a return arrow, cancelled stations are slate with a cross, and upcoming stations are white with a Firm Hairline border and muted labels. Under each station: the actor's name (13px) and a tabular timestamp, or "Waiting" / "Amend & resubmit" in amber text.

### KPI Strip
One panel split into four hairline-divided placards: a 12px muted label over a tabular Figure. The whole cell is a link that shades to Card Shade on hover and reveals a sliding arrow. The "Awaiting your action" value turns Brass Text when it is non-zero.

## Do's and Don'ts

### Do:
- **Do** reach every colour through its token name (`brand`, `shell`, `st-pending-soft`, and so on) so the light/dark themes and the future WCT palette swap stay one-line changes.
- **Do** show status with the full trio for the tone: a solid dot or tile, the soft wash for badges and banners, and the text tone for words.
- **Do** label form fields with the Placard Label (11px, 600, uppercase, 0.08em, Ink Two) and keep the paper form's vocabulary ("Proposed Candidates", "Conducted By", "Fees (MYR)").
- **Do** set every number in tabular figures, and format money as "RM 31,420.00" and dates as dd/MM/yyyy.
- **Do** keep one brass "New training request" action per screen, top right on desktop and an icon button in the mobile header.
- **Do** keep tap targets at 40px or more (44px for the primary action on phones) and use 15px input text below 640px.
- **Do** respect `prefers-reduced-motion`. Animation already collapses to 1ms globally, and new motion must use the same `cubic-bezier(0.16, 1, 0.3, 1)` ease.
- **Do** use `series-1/2/3` for charts and keep chart gridlines on the `grid` token.

### Don't:
- **Don't** use green, amber, coral, slate or draft grey for anything except request status, including chart series, category tags and decoration.
- **Don't** hard-code a brass or gold value, design a WCT logo, or replace the placeholder wordmark with anything but the official asset.
- **Don't** turn the shell into a grey sidebar with a blue accent. The shell is ink-navy, and blue appears only as the focus ring.
- **Don't** put white text on brass or amber fills. Use Brass Ink on brass and the dark amber-brown on pending units.
- **Don't** nest panels or add shadows beyond the resting shadow to in-page cards.
- **Don't** put a small uppercase label or kicker above a heading. The placard style names fields, legends and board rows only.
- **Don't** use Danger Red for a returned request. Returned is coral; danger is for errors and destructive actions.
