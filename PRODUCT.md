# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Approvers (primary, most frequent):** Department HODs, the L&D Team and the HR Head. They arrive from a Power Automate email/Teams link, often between other work and sometimes on a phone. They need to judge a request quickly and approve, or reject with a remark and choose where it goes back to.
- **Requesters:** any WCT staff member raising a training request for themselves or their team, a few times a year.
- **Business Unit Admins (Land, E&C, Malls):** FYI only; they track requests in their BU.
- **System Admins (HR):** maintain departments, HODs, BU Admins and role holders.

## Product Purpose

Digitalise WCT Berhad's Training Requisition Form (WCT-F-4.18-2 REV2) into an internal system with a fixed approval chain: Requester → Department HOD → BU Admin → L&D Team, where L&D gives final approval for Land and Malls and E&C goes on to the HR Head (a per-business-unit setting). It has status tracking, a full audit trail, searchable history and a printable PDF matching the paper form. Success means approvers act in seconds, nobody has to ask "where is my request?", and HR can find any past request.

## Positioning

An internal WCT HR form, not a product sold to anyone. It must feel like a trustworthy company system that is faster and clearer than the paper form it replaces.

## Operating Context

- Microsoft 365 company: staff sign in with Microsoft (Entra ID). Notifications are sent by Power Automate to Outlook/Teams, and every decision is made inside the app.
- Served at `https://hrforms.wct.my/WCT-Training-RQ/` alongside other HR forms.
- The paper form's vocabulary must remain recognisable: "Planned / Ad Hoc Training", "Proposed Candidates", "Conducted By", "Fees (MYR)", "Sign-off & Approvals".
- Malaysian context: MYR currency, dd/MM/yyyy dates, Asia/Kuala_Lumpur time, HRD Corp claimability.

## Capabilities and Constraints

- Statuses: Draft, Pending HOD, Pending L&D, Pending HR Head, Returned, Approved, Cancelled.
- L&D and the HR Head choose the stage a rejection is sent back to and who is notified. The BU Admin is always notified on rejections.
- Up to 8 candidates, picked from the Microsoft 365 directory. Up to 5 attachments.
- Stack (existing): Next.js 16, Tailwind CSS 4, Radix primitives, PostgreSQL. No external CDNs at runtime (self-hosted fonts).

## Brand Commitments

- WCT will supply an official logo and corporate colours later. Until then, use a placeholder "WCT" wordmark and keep brand colour in swappable tokens. Do not invent a WCT logo.
- The source PDF form uses a navy/slate corporate look (form evidence, not a binding palette).

## Evidence on Hand

- `WCT Berhad Training Requisition Form.pdf` (the user's upload), the layout the PDF export must reproduce.
- There are no real request data, user photos or testimonials. Demo seed data is synthetic and labelled as demo (`@demo.wct.my`).

## Product Principles

1. The next action is always obvious: whoever holds the request sees what to do first.
2. Status is never ambiguous: every screen shows where a request is and who holds it.
3. Every decision leaves a trace: who, when, why and who was told.
4. Faithful to the form: the digital record maps one-to-one onto WCT-F-4.18-2.

## Accessibility & Inclusion

WCAG 2.1 AA contrast and full keyboard operation. Approvers on phones need tap targets of at least 44px and readable type without zooming.
