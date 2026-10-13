import { z } from "zod";

const trimmed = (max: number, label: string) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} must be at most ${max} characters`);
const optionalTrimmed = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const MONEY = /^\d{1,10}(\.\d{1,2})?$/;

export const candidateSchema = z.object({
  name: trimmed(120, "Candidate name"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.email("Invalid email").optional()),
  jobTitle: optionalTrimmed(120),
  department: optionalTrimmed(120),
  staffNo: optionalTrimmed(30),
  userId: z.uuid().optional().nullable().transform((v) => v ?? undefined),
});
export type CandidateInput = z.input<typeof candidateSchema>;
export type CandidateData = z.output<typeof candidateSchema>;

function noDuplicateCandidates(list: CandidateData[], ctx: z.RefinementCtx) {
  const seen = new Set<string>();
  list.forEach((c, i) => {
    const key = c.email ? `e:${c.email.toLowerCase()}` : `n:${c.name.trim().toLowerCase()}`;
    if (seen.has(key)) {
      ctx.addIssue({ code: "custom", message: "Duplicate candidate", path: [i, "name"] });
    }
    seen.add(key);
  });
}

const candidatesList = (min: number) =>
  z
    .array(candidateSchema)
    .min(min, "Add at least one candidate")
    .max(8, "A maximum of 8 candidates is allowed")
    .superRefine(noDuplicateCandidates);

export const requestFormSchema = z
  .object({
    trainingType: z.enum(["PLANNED", "ADHOC"], { error: "Select Planned or Ad Hoc training" }),
    title: trimmed(200, "Training title"),
    objective: trimmed(2000, "Objective"),
    startDate: z.string().regex(DATE, "Start date is required"),
    endDate: z.string().regex(DATE, "End date is required"),
    startTime: z.string().regex(TIME, "Start time is required"),
    endTime: z.string().regex(TIME, "End time is required"),
    feePerPax: z.string().trim().regex(MONEY, "Enter a valid amount (max 2 decimal places)"),
    venue: trimmed(200, "Venue"),
    conductedBy: trimmed(200, "Conducted by"),
    candidates: candidatesList(1),
  })
  .superRefine((v, ctx) => {
    if (v.endDate < v.startDate) {
      ctx.addIssue({ code: "custom", message: "End date cannot be before start date", path: ["endDate"] });
    }
    if (v.endTime <= v.startTime) {
      ctx.addIssue({ code: "custom", message: "End time must be after start time", path: ["endTime"] });
    }
  });
export type RequestFormInput = z.input<typeof requestFormSchema>;

/** Drafts: only the title is mandatory; anything provided must still be well-formed. */
export const draftSchema = z.object({
  trainingType: z.enum(["PLANNED", "ADHOC"]).optional(),
  title: trimmed(200, "Training title"),
  objective: optionalTrimmed(2000),
  startDate: z.string().regex(DATE).optional().or(z.literal("").transform(() => undefined)),
  endDate: z.string().regex(DATE).optional().or(z.literal("").transform(() => undefined)),
  startTime: z.string().regex(TIME).optional().or(z.literal("").transform(() => undefined)),
  endTime: z.string().regex(TIME).optional().or(z.literal("").transform(() => undefined)),
  feePerPax: z.string().trim().regex(MONEY).optional().or(z.literal("").transform(() => undefined)),
  venue: optionalTrimmed(200),
  conductedBy: optionalTrimmed(200),
  candidates: candidatesList(0),
});
export type DraftInput = z.input<typeof draftSchema>;
export type DraftData = z.output<typeof draftSchema>;

export const actionSchema = z.object({
  requestId: z.uuid(),
  version: z.number().int().positive(),
  type: z.enum(["SUBMIT", "RESUBMIT", "APPROVE", "REJECT", "CANCEL"]),
  remark: z.string().max(2000).optional(),
  sendBackTo: z.enum(["REQUESTER", "HOD", "LND", "HR"]).optional(),
  notify: z.array(z.enum(["REQUESTER", "HOD", "LND"])).optional(),
});
export type ActionSchemaInput = z.infer<typeof actionSchema>;

export const lndFieldsSchema = z.object({
  hrdcClaimable: z.boolean().optional().nullable(),
  hrdcGrantNo: z.string().trim().max(50).optional().nullable(),
  lndRemarks: z.string().trim().max(1000).optional().nullable(),
});
export type LndFieldsInput = z.input<typeof lndFieldsSchema>;

export const commentSchema = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty").max(2000),
});
