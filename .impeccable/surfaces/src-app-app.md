---
version: 1
slug: "src-app-app"
primary_target: "src/app/(app)"
related_targets: []
---

Scope: the whole authenticated app shell (dashboard, request form, request detail, lists, history, reports, admin) plus the sign-in page. Visitor mode: Operate.
Audience/job: approvers (HOD, L&D, HR Head), often arriving from an email link on a phone, judge a request and act; requesters raise and track; HR searches history.
Constraints: standard web controls; brand colour lives in swappable tokens (official WCT logo and colours come later); WCAG AA.

## Direction contract
THESIS: The status of every request is readable at a glance, the way a sales gallery's availability chart shows every unit. Refuses the grey SaaS sidebar with one blue accent.
OWN-WORLD: A deep ink-navy shell (#0f1d33-ish) with a brass/gold accent (#b8893b-ish, the swappable "brand" token) on crisp white work cards over a cool, faintly tinted ground. Status colours are fixed: approved green, pending amber, returned coral, cancelled slate, draft grey. Workhorse sans (Geist) with tabular numerals and small uppercase tracked labels like a gallery placard.
STORY: The visitor sees what waits for them, opens it, sees exactly where it sits on the line, and acts or tracks with full context.
FIRST VIEWPORT: Ink sidebar left (nav and Approvals badge). Main area: greeting, then a KPI strip of four tiles, then the "Availability board" (this year's requests as a grid of status-coloured tiles with a legend) beside "Awaiting your action". The primary action is "New request" (brass) at the top right.
FORM: candidate 6 of 7 (property sales-gallery availability chart); seed key 0fd5cbdb (degraded roll, no challengers).
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
