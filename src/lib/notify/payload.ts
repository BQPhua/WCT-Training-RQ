import { env } from "@/lib/env";
import { formatDateRange } from "@/lib/format";
import { EVENT_LABEL, STATUS_LABEL, type Person, type Status, type WorkflowEvent } from "@/lib/workflow";

export interface NotificationPayload {
  event: WorkflowEvent["kind"];
  refNo: string;
  title: string;
  status: Status;
  statusLabel: string;
  requester: { name: string; email: string };
  actor: { name: string; email: string };
  remark: string | null;
  to: string[];
  cc: string[];
  subject: string;
  messageHtml: string;
  link: string;
}

export interface PayloadInput {
  event: WorkflowEvent;
  request: { id: string; refNo: string | null; title: string; status: Status; startDate?: string | null; endDate?: string | null; venue?: string | null };
  requester: Person;
  actor: Person;
  recipients: { to: Person[]; cc: Person[] };
  remark?: string | null;
  /** Business unit name (Land, E&C, Malls) for BU Admin wording. */
  businessUnit?: string | null;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function eventLabel(e: WorkflowEvent): string {
  if (e.kind === "REJECTED") return "Rejected (returned to requester)";
  return EVENT_LABEL[e.kind];
}

function headline(e: WorkflowEvent, actor: string, bu: string | null | undefined): string {
  const buAdmin = bu ? `${bu} BU Admin` : "BU Admin";
  switch (e.kind) {
    case "SUBMITTED":
    case "RESUBMITTED":
      return `${actor} has submitted a training request for your approval.`;
    case "HOD_APPROVED":
      return e.toStatus === "PENDING_LND"
        ? `The Department HOD (${actor}) has approved this training request. It is now with the L&D Team for review.`
        : `The Department HOD (${actor}) has approved this training request. It is now with the ${buAdmin} for approval.`;
    case "BU_APPROVED":
      return `The ${buAdmin} (${actor}) has approved this training request. It is now with the L&D Team for review.`;
    case "LND_APPROVED":
      return `The L&D Team (${actor}) has reviewed and approved this training request. It now awaits HR Head final approval.`;
    case "FINAL_APPROVED":
      return e.fromStatus === "PENDING_LND"
        ? `This training request has received final approval from the L&D Team (${actor}).`
        : `This training request has received final approval from the HR Head (${actor}).`;
    case "REJECTED":
      return `${actor} has rejected this training request and returned it to the requester for amendment.`;
    case "CANCELLED":
      return `${actor} has cancelled this training request.`;
    case "COMMENTED":
      return `${actor} added a comment on this training request.`;
  }
}

/** Build the JSON body sent to the Power Automate flow. All user text is HTML-escaped. */
export function buildPayload(i: PayloadInput): NotificationPayload {
  const ref = i.request.refNo ?? "Draft";
  const link = `${env.APP_URL}/requests/${i.request.id}`;
  const label = eventLabel(i.event);
  const rows: [string, string][] = [
    ["Reference", ref],
    ["Training", i.request.title],
    ["Requester", i.requester.name],
    ["Training Dates", formatDateRange(i.request.startDate ?? null, i.request.endDate ?? null)],
    ["Venue", i.request.venue ?? "—"],
    ["Status", STATUS_LABEL[i.request.status]],
  ];
  const remarkBlock = i.remark
    ? `<p style="margin:16px 0 4px;font-weight:600;color:#0f172a">${i.event.kind === "COMMENTED" ? "Comment" : "Remark"}</p>
       <div style="padding:12px 14px;background:#f8fafc;border-left:3px solid #1e3a5f;color:#334155;white-space:pre-wrap">${escapeHtml(i.remark)}</div>`
    : "";

  const messageHtml = `
<div style="font-family:Segoe UI,Arial,sans-serif;max-width:600px;color:#0f172a">
  <div style="background:#ffffff;padding:12px 20px;border:1px solid #e2e8f0;border-bottom:0;border-radius:8px 8px 0 0">
    <img src="${env.APP_URL}/brand/wct-logo.png" alt="WCT" width="59" height="36" style="display:block;height:36px;width:59px;border:0">
  </div>
  <div style="background:#1e3a5f;color:#fff;padding:16px 20px">
    <div style="font-size:12px;letter-spacing:.08em;opacity:.8">WCT HR FORMS · TRAINING RQ</div>
    <div style="font-size:18px;font-weight:600;margin-top:4px">${escapeHtml(label)}</div>
  </div>
  <div style="border:1px solid #e2e8f0;border-top:0;padding:20px;border-radius:0 0 8px 8px">
    <p style="margin:0 0 16px">${escapeHtml(headline(i.event, i.actor.name, i.businessUnit))}</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px">
      ${rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:6px 0;color:#64748b;width:120px">${k}</td><td style="padding:6px 0;font-weight:500">${escapeHtml(v)}</td></tr>`,
        )
        .join("")}
    </table>
    ${remarkBlock}
    <p style="margin:24px 0 8px"><a href="${link}" style="background:#1e3a5f;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;display:inline-block;font-weight:600">Open request</a></p>
    <p style="font-size:12px;color:#94a3b8;margin-top:24px">All approvals are made in the Training RQ system. This is an automated message; please do not reply.</p>
  </div>
</div>`.trim();

  return {
    event: i.event.kind,
    refNo: ref,
    title: i.request.title,
    status: i.request.status,
    statusLabel: STATUS_LABEL[i.request.status],
    requester: { name: i.requester.name, email: i.requester.email },
    actor: { name: i.actor.name, email: i.actor.email },
    remark: i.remark ?? null,
    to: i.recipients.to.map((p) => p.email),
    cc: i.recipients.cc.map((p) => p.email),
    subject: `[Training RQ] ${ref} – ${label}: ${i.request.title}`,
    messageHtml,
    link,
  };
}
