import React from "react";
import fs from "node:fs";
import path from "node:path";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { effectiveParticipants, formatDateMY, formatDateRange, formatDateTimeMY, formatMYR, formatTime12, totalFees } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/workflow";
import type { PdfData } from "./types";

const INK = "#0f172a";
const SLATE = "#334155";
const LABEL = "#475569";
const LINE = "#94a3b8";
const SOFT = "#cbd5e1";
const PANEL = "#f1f5f9";

/** WCT logo for the form header; omitted (text only) if the file is missing. */
const LOGO: Buffer | null = (() => {
  try {
    return fs.readFileSync(path.join(process.cwd(), "public/brand/wct-logo.png"));
  } catch {
    return null;
  }
})();

const s = StyleSheet.create({
  page: { paddingTop: 26, paddingBottom: 40, paddingHorizontal: 40, fontFamily: "Helvetica", fontSize: 9, color: INK },
  header: { flexDirection: "row", borderWidth: 2, borderColor: INK, marginBottom: 6 },
  headerLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 12 },
  logo: { height: 38, width: 66, objectFit: "contain" },
  company: { fontFamily: "Helvetica-Bold", fontSize: 18, letterSpacing: 0.5 },
  formName: { fontFamily: "Helvetica-Bold", fontSize: 11, color: SLATE, marginTop: 3, letterSpacing: 0.4 },
  headerRight: { width: 165, backgroundColor: PANEL, borderLeftWidth: 1, borderLeftColor: SOFT, paddingVertical: 10, paddingHorizontal: 12, alignItems: "flex-end", justifyContent: "center" },
  meta: { fontFamily: "Helvetica-Bold", fontSize: 8.5, color: SLATE, marginBottom: 2 },
  sysRef: { flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: LABEL, marginBottom: 7 },
  section: { borderWidth: 1, borderColor: SOFT, borderRadius: 4, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, marginBottom: 7 },
  sectionTitle: { fontFamily: "Helvetica-Bold", fontSize: 9.5, letterSpacing: 0.6, paddingBottom: 4, borderBottomWidth: 1.5, borderBottomColor: INK, marginBottom: 6 },
  label: { fontFamily: "Helvetica-Bold", fontSize: 7.5, color: LABEL, letterSpacing: 0.3, marginBottom: 3 },
  value: { fontSize: 9.5, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: LINE, minHeight: 15 },
  row: { flexDirection: "row", gap: 14, marginBottom: 6 },
  col: { flex: 1 },
  intro: { fontSize: 8.5, color: SLATE, marginBottom: 6 },
  checkRow: { flexDirection: "row", gap: 22, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 3, paddingVertical: 4, paddingHorizontal: 8, marginBottom: 7 },
  check: { flexDirection: "row", alignItems: "center", gap: 6 },
  box: { width: 10, height: 10, borderWidth: 1, borderColor: SLATE, borderRadius: 1.5, alignItems: "center", justifyContent: "center" },
  tick: { fontFamily: "Helvetica-Bold", fontSize: 8, marginTop: -1 },
  checkLabel: { fontFamily: "Helvetica-Bold", fontSize: 9 },
  table: { borderWidth: 1, borderColor: SOFT },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: SOFT, minHeight: 16 },
  th: { backgroundColor: PANEL, fontFamily: "Helvetica-Bold", fontSize: 7.5, color: SLATE, paddingVertical: 4, paddingHorizontal: 6 },
  numCell: { width: 22, borderRightWidth: 1, borderRightColor: SOFT, alignItems: "center", justifyContent: "center", color: LABEL, fontFamily: "Helvetica-Bold" },
  nameCell: { flex: 1, paddingHorizontal: 6, justifyContent: "center", borderRightWidth: 1, borderRightColor: SOFT },
  signRow: { flexDirection: "row", gap: 12 },
  signBox: { flex: 1, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 4, padding: 8 },
  signTitle: { fontFamily: "Helvetica-Bold", fontSize: 8, marginBottom: 6 },
  digital: { fontSize: 8.5, color: INK, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: LINE, borderStyle: "dashed", marginBottom: 4, minHeight: 16, justifyContent: "flex-end" },
  commentBox: { borderWidth: 1, borderColor: LINE, borderStyle: "dashed", borderRadius: 3, padding: 5, minHeight: 24, marginBottom: 5, fontSize: 8 },
  small: { fontSize: 7.5, color: LABEL },
  trail: { marginTop: 2, paddingHorizontal: 2 },
  trailHead: { flexDirection: "row", backgroundColor: PANEL, borderBottomWidth: 1, borderBottomColor: SOFT },
  trailRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  tc: { paddingVertical: 2.5, paddingHorizontal: 5, fontSize: 7.8 },
  footer: { position: "absolute", left: 40, right: 40, bottom: 22, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: LABEL },
  watermark: { position: "absolute", top: 360, left: 40, right: 40, textAlign: "center", fontFamily: "Helvetica-Bold", fontSize: 46, color: "#e2643f", opacity: 0.13, transform: "rotate(-30deg)" },
});

function Value({ children }: { children?: React.ReactNode }) {
  return <Text style={s.value}>{children || " "}</Text>;
}

function Check({ checked, label }: { checked: boolean; label: string }) {
  return (
    <View style={s.check}>
      <View style={s.box}>{checked ? <Text style={s.tick}>X</Text> : null}</View>
      <Text style={s.checkLabel}>{label}</Text>
    </View>
  );
}

export function TrainingRqDocument({ d }: { d: PdfData }) {
  const slots = Array.from({ length: 8 }, (_, i) => d.candidates[i]);
  const extra = d.candidates.slice(8);
  const participants = effectiveParticipants(d, d.candidates.length);
  const total = totalFees(d.feePerPax, participants);
  const hr = d.approvals.find((a) => a.stage === "HR Head" && a.decision === "Approved");
  const lnd = [...d.approvals].reverse().find((a) => a.stage === "L&D Team");
  const reviewComment = [d.lndRemarks, lnd?.remark, hr?.remark].filter(Boolean).join("\n");

  return (
    <Document title={`${d.refNo ?? "Draft"} – Training Requisition Form`} author="WCT Training RQ" subject="WCT-F-4.18-2 Training Requisition Form">
      <Page size="A4" style={s.page}>
        {d.status !== "APPROVED" && (
          <Text style={s.watermark} fixed>
            NOT FINAL – {STATUS_LABEL[d.status].toUpperCase()}
          </Text>
        )}

        <View style={s.header}>
          <View style={s.headerLeft}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
            {LOGO && <Image style={s.logo} src={{ data: LOGO, format: "png" }} />}
            <View>
              <Text style={s.company}>WCT BERHAD</Text>
              <Text style={s.formName}>TRAINING REQUISITION FORM</Text>
            </View>
          </View>
          <View style={s.headerRight}>
            <Text style={s.meta}>Ref No: WCT-F-4.18-2</Text>
            <Text style={s.meta}>Revision: REV2</Text>
            <Text style={s.meta}>Date: 20/03/2024</Text>
          </View>
        </View>
        <View style={s.sysRef}>
          <Text>System reference: {d.refNo ?? "Draft"}</Text>
          <Text>Status: {STATUS_LABEL[d.status]}</Text>
        </View>

        <View style={s.section} wrap={false}>
          <Text style={s.sectionTitle}>SECTION 1: GENERAL DETAILS</Text>
          <Text style={s.label}>TO:</Text>
          <View style={{ marginBottom: 6 }}>
            <Value>Human Resources and Administration Department</Value>
          </View>
          <View style={[s.row, { marginBottom: 0 }]}>
            <View style={s.col}>
              <Text style={s.label}>FROM (REQUESTER):</Text>
              <Value>{d.requesterName}</Value>
            </View>
            <View style={s.col}>
              <Text style={s.label}>DEPARTMENT:</Text>
              <Value>
                {d.departmentName ?? ""}
                {d.businessUnitName ? ` (${d.businessUnitName})` : ""}
              </Value>
            </View>
          </View>
        </View>

        <View style={s.section} wrap={false}>
          <Text style={s.sectionTitle}>SECTION 2: TRAINING PROGRAM DETAILS</Text>
          <Text style={s.intro}>I would like to propose the following staff to attend the training program detailed below:</Text>
          <View style={s.checkRow}>
            <Check checked={d.trainingType === "PLANNED"} label="Planned Training" />
            <Check checked={d.trainingType === "ADHOC"} label="Ad Hoc Training" />
          </View>
          <View style={{ marginBottom: 6 }}>
            <Text style={s.label}>PROPOSED TRAINING PROGRAM&apos;S TITLE / SUBJECT:</Text>
            <Value>{d.title}</Value>
          </View>
          <View style={{ marginBottom: 6 }}>
            <Text style={s.label}>OBJECTIVE:</Text>
            <Value>{d.objective}</Value>
          </View>
          <View style={{ marginBottom: 6 }}>
            <Text style={s.label}>RELEVANCY:</Text>
            <Value>{d.relevancy}</Value>
          </View>
          <View style={s.row}>
            <View style={s.col}>
              <Text style={s.label}>TRAINING DATES:</Text>
              <Value>{formatDateRange(d.startDate, d.endDate)}</Value>
            </View>
            <View style={s.col}>
              <Text style={s.label}>TIME:</Text>
              <Value>{d.startTime ? `${formatTime12(d.startTime)} – ${formatTime12(d.endTime)}` : ""}</Value>
            </View>
            <View style={s.col}>
              <Text style={s.label}>FEES (MYR):</Text>
              <Value>
                {formatMYR(total)} ({participants} × {formatMYR(d.feePerPax)})
              </Value>
            </View>
          </View>
          <View style={[s.row, { marginBottom: 0 }]}>
            <View style={{ flex: 2 }}>
              <Text style={s.label}>VENUE:</Text>
              <Value>{d.venue}</Value>
            </View>
            <View style={s.col}>
              <Text style={s.label}>CONDUCTED BY:</Text>
              <Value>{d.conductedBy}</Value>
            </View>
          </View>
        </View>

        <View style={s.section} wrap={false}>
          <Text style={s.sectionTitle}>SECTION 3: PROPOSED CANDIDATES</Text>
          {d.nameList ? (
            <Text style={[s.value, { borderBottomWidth: 0 }]}>
              Refer to attached name list: {d.nameList.fileName} ({participants} participants)
            </Text>
          ) : (
          <View style={s.table}>
            <View style={s.tr}>
              <Text style={[s.th, { width: 22 }]}>#</Text>
              <Text style={[s.th, { flex: 1 }]}>CANDIDATE NAME</Text>
              <Text style={[s.th, { width: 22 }]}>#</Text>
              <Text style={[s.th, { flex: 1 }]}>CANDIDATE NAME</Text>
            </View>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[s.tr, i === 3 ? { borderBottomWidth: 0 } : {}]}>
                <View style={s.numCell}>
                  <Text>{i + 1}</Text>
                </View>
                <View style={s.nameCell}>
                  <Text>{slots[i]?.name ?? ""}</Text>
                </View>
                <View style={s.numCell}>
                  <Text>{i + 5}</Text>
                </View>
                <View style={[s.nameCell, { borderRightWidth: 0 }]}>
                  <Text>{slots[i + 4]?.name ?? ""}</Text>
                </View>
              </View>
            ))}
          </View>
          )}
          {extra.length > 0 && <Text style={[s.small, { marginTop: 4 }]}>Additional: {extra.map((c) => c.name).join(", ")}</Text>}
        </View>

        <View style={s.section} wrap={false}>
          <Text style={s.sectionTitle}>SECTION 4: SIGN-OFF & APPROVALS</Text>
          <View style={s.signRow}>
            <View style={s.signBox}>
              <Text style={s.signTitle}>REQUESTED BY:</Text>
              <View style={s.digital}>
                <Text>{d.submittedAt ? `${d.requesterName} (digitally submitted)` : ""}</Text>
              </View>
              <Text style={s.label}>NAME & SIGNATURE</Text>
              <Text style={[s.label, { marginTop: 4 }]}>DATE: {d.submittedAt ? formatDateMY(d.submittedAt) : ""}</Text>
            </View>
            <View style={s.signBox}>
              <Text style={s.signTitle}>REVIEW & COMMENT BY HR & ADMIN:</Text>
              <View style={s.commentBox}>
                <Text>
                  {reviewComment}
                  {d.hrdcClaimable !== null ? `${reviewComment ? "\n" : ""}HRD Corp claimable: ${d.hrdcClaimable ? "Yes" : "No"}${d.hrdcGrantNo ? ` (${d.hrdcGrantNo})` : ""}` : ""}
                </Text>
              </View>
              <View style={[s.digital, { minHeight: 14 }]}>
                <Text>{hr ? `${hr.name} (digitally approved)` : ""}</Text>
              </View>
              <Text style={s.label}>NAME & SIGNATURE</Text>
              <Text style={[s.label, { marginTop: 4 }]}>DATE: {hr ? formatDateMY(hr.at) : ""}</Text>
            </View>
          </View>

        </View>

        {d.approvals.length > 0 && (
          <View style={s.trail}>
            <Text style={[s.label, { marginBottom: 4 }]} minPresenceAhead={30}>DIGITAL APPROVAL TRAIL</Text>
            <View style={s.trailHead}>
              <Text style={[s.tc, { width: 84, fontFamily: "Helvetica-Bold" }]}>Stage</Text>
              <Text style={[s.tc, { width: 110, fontFamily: "Helvetica-Bold" }]}>Name</Text>
              <Text style={[s.tc, { width: 62, fontFamily: "Helvetica-Bold" }]}>Decision</Text>
              <Text style={[s.tc, { width: 96, fontFamily: "Helvetica-Bold" }]}>Date & time</Text>
              <Text style={[s.tc, { flex: 1, fontFamily: "Helvetica-Bold" }]}>Remark</Text>
            </View>
            {d.approvals.map((a, i) => (
              <View key={i} style={s.trailRow} wrap={false}>
                <Text style={[s.tc, { width: 84 }]}>{a.stage}</Text>
                <Text style={[s.tc, { width: 110 }]}>{a.name}</Text>
                <Text style={[s.tc, { width: 62 }]}>{a.decision}</Text>
                <Text style={[s.tc, { width: 96 }]}>{formatDateTimeMY(a.at)}</Text>
                <Text style={[s.tc, { flex: 1 }]}>{a.remark ?? ""}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.footer} fixed>
          <Text>WCT BERHAD • Quality Management System</Text>
          <Text>Ref: WCT-F-4.18-2 (REV2)</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
