---
version: 1
slug: "src-app-app"
primary_target: "src/app/(app)"
related_targets: ["src/app/signin"]
---

Scope: the whole authenticated app shell (dashboard, request form, request detail, lists, history, reports, admin) plus the sign-in page. Visitor mode: Operate.
Audience/job: approvers (HOD, BU Admin, L&D, HR Head), often arriving from an email link on a phone, judge a request and act; requesters raise and track; HR searches history.
Constraints: standard web controls; WCT logo red (#E30613) is the brand; WCAG AA; Land/Malls routes end at L&D, E&C at HR Head; motion via the `motion` library, state-carrying only, reduced-motion respected.

## Direction contract
THESIS: WCT at dusk. The Paradigm Mall photo's twilight sky becomes the shell and WCT's red signage becomes the one signal that says "this is yours to act on". Refuses the grey SaaS sidebar with a blue accent, and the old brass placeholder.
OWN-WORLD: Twilight navy shell (deep indigo-navy, a faint vertical dusk gradient), cool near-white ground, white work cards with 12px corners and soft layered shadow. WCT red for primary actions, the active nav pill's icon, awaiting counts and the beacon. Sky blue for pending/info and links. Status: approved green, pending sky, returned orange, cancelled slate, draft grey. Geist, tabular figures, sentence-case labels.
STORY: The visitor sees what waits for them, opens it, sees where it sits on its route (3 or 4 approvals), and acts with full context.
FIRST VIEWPORT: Navy rail left with an animated active pill; top bar with page title, theme and user menu; dashboard greeting, one key-figures strip, analytics, availability board last. "New request" in red, top right.
SIGNATURE: the dusk beacon: items awaiting the viewer carry a small red beacon that pulses once on arrival; the route tracker fills like lights coming on along a street.
FINISH: screenshots light/dark at 390 and 1440, DESIGN.md rewritten from the built world.
