---
name: WCT Training RQ
description: WCT's training requisition system at dusk. A twilight navy shell, white work cards, and WCT red reserved for whatever is waiting for you.
colors:
  wct-red: "oklch(0.578 0.233 27.6)"
  wct-red-pressed: "oklch(0.52 0.215 27)"
  wct-red-text: "oklch(0.52 0.21 27)"
  wct-red-wash: "oklch(0.962 0.024 22)"
  on-red: "oklch(1 0 0)"
  twilight-navy: "oklch(0.21 0.065 270)"
  dusk-horizon: "oklch(0.285 0.085 264)"
  lit-navy: "oklch(0.3 0.075 268)"
  shell-seam: "oklch(0.34 0.06 268)"
  shell-paper: "oklch(0.965 0.01 265)"
  shell-mist: "oklch(0.8 0.04 265)"
  signage-red: "oklch(0.7 0.19 25)"
  dusk-sky: "oklch(0.62 0.14 258)"
  dusk-sky-wash: "oklch(0.955 0.03 258)"
  dusk-sky-text: "oklch(0.45 0.14 262)"
  cool-ground: "oklch(0.975 0.006 265)"
  card-white: "oklch(1 0 0)"
  card-shade: "oklch(0.982 0.005 265)"
  ink: "oklch(0.22 0.045 268)"
  ink-two: "oklch(0.4 0.04 268)"
  muted-slate: "oklch(0.5 0.03 268)"
  hairline: "oklch(0.915 0.012 265)"
  firm-hairline: "oklch(0.855 0.018 265)"
  approved: "oklch(0.6 0.13 155)"
  approved-wash: "oklch(0.955 0.04 155)"
  approved-text: "oklch(0.42 0.1 155)"
  pending: "oklch(0.64 0.14 255)"
  pending-wash: "oklch(0.955 0.03 255)"
  pending-text: "oklch(0.45 0.13 260)"
  returned: "oklch(0.7 0.16 55)"
  returned-wash: "oklch(0.962 0.04 62)"
  returned-text: "oklch(0.49 0.13 50)"
  cancelled: "oklch(0.7 0.015 265)"
  cancelled-wash: "oklch(0.95 0.006 265)"
  cancelled-text: "oklch(0.47 0.02 265)"
  draft: "oklch(0.93 0.008 265)"
  draft-text: "oklch(0.45 0.02 265)"
  danger: "oklch(0.5 0.19 22)"
  danger-wash: "oklch(0.965 0.022 22)"
  focus: "oklch(0.58 0.15 258)"
  series-indigo: "#4338ca"
  series-magenta: "#be3d87"
  series-gold: "#a87b12"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.29
    letterSpacing: "-0.02em"
  figure:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.33
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
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.45
  caption:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.33
    fontFeature: "\"tnum\""
rounded:
  sm: "8px"
  md: "10px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  sm: "8px"
  md: "16px"
  panel-x: "24px"
  stack: "24px"
  gutter-mobile: "16px"
  gutter-tablet: "24px"
  gutter-desktop: "40px"
components:
  button-brand:
    backgroundColor: "{colors.wct-red}"
    textColor: "{colors.on-red}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 16px"
  button-brand-hover:
    backgroundColor: "{colors.wct-red-pressed}"
    textColor: "{colors.on-red}"
  button-primary:
    backgroundColor: "{colors.twilight-navy}"
    textColor: "{colors.shell-paper}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 16px"
  button-outline:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 16px"
  button-approve:
    backgroundColor: "{colors.approved}"
    textColor: "{colors.on-red}"
    rounded: "{rounded.md}"
    height: "40px"
  button-danger:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.danger}"
    rounded: "{rounded.md}"
    height: "40px"
  input:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 12px"
  panel:
    backgroundColor: "{colors.card-white}"
    rounded: "{rounded.lg}"
  status-badge-pending:
    backgroundColor: "{colors.pending-wash}"
    textColor: "{colors.pending-text}"
    rounded: "{rounded.full}"
    height: "24px"
  nav-item-active:
    textColor: "{colors.shell-paper}"
    rounded: "{rounded.md}"
    height: "40px"
  nav-badge:
    backgroundColor: "{colors.wct-red}"
    textColor: "{colors.on-red}"
    rounded: "{rounded.full}"
---

# Design System: WCT Training RQ

## Overview

**Creative North Star: "WCT at dusk"**

The app takes its world from the Paradigm Mall photo on the sign-in page: a twilight sky over WCT's buildings, with red signage lit against it. The sky becomes the shell, a deep indigo-navy rail that lifts slightly toward the horizon. The red signage becomes the single signal that something is yours to act on. Work happens on white cards over a cool, faintly blue ground, the way the lit windows read against the evening.

This is an operating tool, used between other work and often on a phone from an email link. Density is that of a working app: flat cards on a hairline with a soft layered shadow, sentence-case labels, tabular figures everywhere. Colour does jobs, not decoration. Red marks action, sky marks waiting and information, and a fixed status vocabulary carries meaning on every screen.

Motion is short and carries state: a page arrives with a 260ms fade and rise, the active nav pill and tab underline glide to their new place, dialogs and menus scale in and out, completed legs of the approval route fill one after another, and anything waiting for you radiates a red beacon twice. With reduced motion on, all of it is removed.

**Key Characteristics:**
- Twilight navy rail (sidebar, mobile header, drawer) around white work cards on a cool ground.
- WCT red (#E30613) only for "act here": the main action on a screen, the awaiting count and its beacon, the approvals badge, the active tab underline, ringed board units.
- Sky blue (from the photo) for pending, links, info notes, selection, focus and the demo banner.
- A reserved status vocabulary: approved green, pending sky, returned orange, cancelled slate, draft grey.
- Geist Sans with tabular numerals; sentence-case labels; 12px card corners.
- Full light and dark themes driven by the same token names, every text pair checked by `scripts/check-contrast.mjs`.

## Colors

The palette is cool twilight neutrals, one brand red and one sky blue, plus a status vocabulary reserved for status. Light values are in the frontmatter. Dark values for the same tokens are in `src/app/globals.css` under `.dark` and in `.impeccable/design.json`.

### Primary
- **WCT Red** (`--brand`, #E30613): the WCT logo red. Fills the one primary action per screen ("New Training Requisition", "Review & submit", "Sign in with Microsoft"), the approvals badge and the awaiting beacon, and draws the active tab underline and the ring on board units waiting for you. Text on red is always white (4.86:1).
- **Pressed Red** (`--brand-hover`): hover and pressed state of red fills.
- **Red Text** (`--brand-text`): the "Awaiting your action" figure when non-zero.
- **Signage Red** (`--shell-accent`): a lifted red for the active nav icon on the navy rail.

### Secondary
- **Twilight Navy** (`--shell`) to **Dusk Horizon** (`--shell-dusk`): the rail's vertical gradient and the mobile header. Also the neutral strong button (`primary`), tooltips and the reference chip.
- **Shell Paper** / **Shell Mist** (`--shell-fg`, `--shell-muted`): text on navy.
- **Dusk Sky** (`--info`, `-soft`, `-text`): links, info notes, the demo banner, selected options, checkboxes (`accent-color`), text selection, avatars and form section numbers.

### Neutral
- **Cool Ground** (`--ground`): the page behind cards. **Card White** (`--surface`): cards, inputs, menus, dialogs. **Card Shade** (`--surface-2`): table header band, row hover.
- **Ink**, **Ink Two**, **Muted Slate**: headings and primary text, labels, meta lines.
- **Hairline** / **Firm Hairline**: card borders and dividers; input and outline-button borders.
- **Focus Sky** (`--focus`): the 2px focus outline and the 3px input focus ring. On the navy rail the outline is Shell Paper.
- **Danger** (`--danger`, `-soft`): errors, required asterisks and destructive outline buttons. Darker than WCT Red and never used as a fill, so it never reads as the brand action.

### Status Vocabulary (reserved)
- **Approved** green: approved status, the Approve button, completed tracker legs.
- **Pending** sky: Pending HOD / BU Admin / L&D / HR Head, the current tracker station (with a soft pulse).
- **Returned** orange: returned for amendment, the Reject button text.
- **Cancelled** slate and **Draft** grey.

### Data Series
- **Indigo / Magenta / Gold** (`--series-1..3`): Land, E&C, Malls in charts; single series use indigo. Validated with the dataviz palette validator in light (white) and dark (#1a2033), clear of the status hues and of WCT red.

### Named Rules
**The Red Means Act Rule.** Red appears only where the viewer should act or where something is waiting for them. Links, selections, notes and decoration are sky or ink, never red.
**The Reserved Status Rule.** Green, sky, orange, slate and grey mean approved, pending, returned, cancelled and draft, and nothing else.

## Typography

**Font:** Geist Sans (self-hosted via the `geist` package), with `ui-sans-serif, system-ui` fallback. One family carries everything. Hierarchy comes from size and weight.

- **Display** (600, 26px): the sign-in heading.
- **Headline** (600, 24px rising to 28px at 640px, -0.02em): page titles, the dashboard greeting, request titles.
- **Figure** (600, 20px to 24px, tabular): key figures such as "RM 86,440.00".
- **Title** (600, 15px): card headers and form section titles. Dialog titles step up to 18px.
- **Body** (400, 14px): default text. Inputs use 15px below 640px so phones never zoom.
- **Label** (500, 13px, sentence case): field labels and legends.
- **Caption** (400, 12px, tabular): timestamps, table headers.

**The Tabular Figures Rule.** Every reference number, fee, count, date and time uses tabular figures.

## Layout

A fixed 256px twilight rail beside a scrolling work column capped at 1320px. The column is padded 16px on phones, 24px from 640px and 40px from 1024px. Below 1024px the rail becomes a 56px navy header with a menu button, the logo and a red icon-only "New request" button; navigation opens as a left drawer that slides in.

Pages stack in a 24px rhythm. The dashboard and detail pages split at 1280px into a fluid main column and a 380px side column. Below 1280px the request form's actions are pinned to the bottom of the screen. Tables scroll sideways inside their card on narrow screens; request lists switch to stacked cards below 640px.

**The sign-in page** is a split screen from 1024px: the Paradigm Mall photo fills 55% of the width (cover, centred on the entrance) with a navy fade carrying the logo and "Training Requisition"; the sign-in column sits on the ground colour. Below 1024px the photo is a 34vh banner.

## Elevation & Depth

Flat cards on a hairline with a soft, layered shadow (`--shadow-sm`: 1–3px). Menus use `--shadow-md`; dialogs and the drawer `--shadow-lg`. The pinned form action bar casts an upward shadow and blurs what scrolls beneath it. Dark mode uses deeper, darker shadows. Dialog overlays are the navy shell at 55% with a 2px blur.

## Shapes

12px corners for cards and dialogs, 10px for buttons and inputs, full pills for status badges, the approvals badge and demo account chips. Form section numbers sit in 28px sky circles. The route tracker uses 29px stations joined by 3px legs.

## Components

- **Buttons:** `brand` (red, the one action), `primary` (navy, neutral strong), `outline`, `ghost`, `approve` (green), `danger` (red outline, always behind a confirmation). 40px tall (44px large); press scales to 0.98.
- **Inputs:** 40px, 10px corners, firm hairline border, sky focus ring.
- **Status badge:** 24px pill with a dot, wash background and text tone from the status vocabulary.
- **Nav:** 40px items; the active item is a translucent white pill that glides between items (Motion `layoutId`), with a signage-red icon. The approvals count is a red pill that radiates twice on arrival.
- **Tabs:** text tabs with a red 2px underline that glides to the active tab.
- **Route tracker:** stations for each approval on the request's own route (three or four approvals: Land and Malls end at L&D, E&C goes on to HR Head). Completed legs fill one after another.
- **Key figures:** one card divided by hairlines; the awaiting figure is red with a beacon when non-zero.
- **Availability board:** this year's requests as status-coloured tiles by month; units waiting for you carry a red ring.
- **Dialogs, menus, drawer:** scale or slide in and out (Motion presence over Radix).

## Do's and Don'ts

- **Do** use red only for the main action and for what is waiting for the viewer.
- **Do** use sky for links, notes, selection and anything informational.
- **Do** keep motion to 150–300ms, transform and opacity only, and conveying state.
- **Do** run `node scripts/check-contrast.mjs` after changing any colour token.
- **Don't** use red for links, decoration, chart series or status.
- **Don't** add coloured side borders, gradient text or glass effects.
- **Don't** add a second accent colour; the world has red and sky.
- **Don't** animate layout properties (width, height, top, left) for new motion.
