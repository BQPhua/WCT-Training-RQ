import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ---------- Enums ----------
export const requestStatusEnum = pgEnum("request_status", [
  "DRAFT",
  "PENDING_HOD",
  "PENDING_BU",
  "PENDING_LND",
  "PENDING_HR",
  "RETURNED",
  "APPROVED",
  "CANCELLED",
]);
export const trainingTypeEnum = pgEnum("training_type", ["PLANNED", "ADHOC"]);
export const roleNameEnum = pgEnum("role_name", ["LND", "HR_HEAD", "SYS_ADMIN"]);
export const actionTypeEnum = pgEnum("action_type", [
  "CREATE",
  "SUBMIT",
  "RESUBMIT",
  "APPROVE",
  "REJECT",
  "CANCEL",
  "COMMENT",
  "EDIT_LND_FIELDS",
]);
export const notificationStatusEnum = pgEnum("notification_status", ["PENDING", "SENT", "FAILED"]);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ---------- Microsoft 365 staff sync ----------
export const directorySyncRuns = pgTable("directory_sync_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  trigger: text("trigger").notNull(), // "cron" | "manual"
  triggeredById: uuid("triggered_by_id"),
  added: integer("added").notNull().default(0),
  updated: integer("updated").notNull().default(0),
  skipped: integer("skipped").notNull().default(0),
  flagged: integer("flagged").notNull().default(0),
  ok: boolean("ok"),
  error: text("error"),
});
export type DirectorySyncRun = typeof directorySyncRuns.$inferSelect;

// ---------- Organisation ----------
export const businessUnits = pgTable("business_units", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  /** E&C needs HR Head's final approval; Land and Malls are finalised by L&D. */
  requiresHrApproval: boolean("requires_hr_approval").notNull().default(true),
  /** Off: HOD approval goes straight to L&D (BU Admins are still kept informed). */
  requiresBuAdmin: boolean("requires_bu_admin").notNull().default(true),
  /** Optional short descriptions shown under each step on the Approval flow tab (≤ 40 chars). */
  stepNotes: jsonb("step_notes").$type<Partial<Record<"REQUESTER" | "HOD" | "BU" | "LND" | "HR", string>>>().notNull().default({}),
  createdAt: createdAt(),
});

export const departments = pgTable(
  "departments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    businessUnitId: uuid("business_unit_id")
      .notNull()
      .references(() => businessUnits.id),
    hodUserId: uuid("hod_user_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("departments_name_lower_idx").on(sql`lower(${t.name})`)],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entraOid: text("entra_oid").unique(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    jobTitle: text("job_title"),
    entraDepartment: text("entra_department"),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    /** Last time the Microsoft 365 sync found this person (null: never seen by a sync). */
    directorySeenAt: timestamp("directory_seen_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("users_name_idx").on(t.name)],
);

export const businessUnitAdmins = pgTable(
  "business_unit_admins",
  {
    businessUnitId: uuid("business_unit_id")
      .notNull()
      .references(() => businessUnits.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.businessUnitId, t.userId] })],
);

export const roleAssignments = pgTable(
  "role_assignments",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleNameEnum("role").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.role] })],
);

// ---------- Requests ----------
export const trainingRequests = pgTable(
  "training_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    refNo: text("ref_no").unique(),
    status: requestStatusEnum("status").notNull().default("DRAFT"),
    version: integer("version").notNull().default(1),
    requesterId: uuid("requester_id")
      .notNull()
      .references(() => users.id),
    departmentId: uuid("department_id").references(() => departments.id),
    businessUnitId: uuid("business_unit_id").references(() => businessUnits.id),
    trainingType: trainingTypeEnum("training_type"),
    title: text("title").notNull(),
    objective: text("objective"),
    relevancy: text("relevancy"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    startTime: text("start_time"),
    endTime: text("end_time"),
    feePerPax: numeric("fee_per_pax", { precision: 12, scale: 2 }),
    /** Typed-name count, or the number entered for an attached name list. */
    participantCount: integer("participant_count"),
    venue: text("venue"),
    conductedBy: text("conducted_by"),
    hrdcClaimable: boolean("hrdc_claimable"),
    hrdcGrantNo: text("hrdc_grant_no"),
    lndRemarks: text("lnd_remarks"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    finalisedAt: timestamp("finalised_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("tr_status_idx").on(t.status),
    index("tr_requester_idx").on(t.requesterId),
    index("tr_department_idx").on(t.departmentId),
    index("tr_bu_idx").on(t.businessUnitId),
  ],
);

export const candidates = pgTable(
  "candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => trainingRequests.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
    name: text("name").notNull(),
    email: text("email"),
    jobTitle: text("job_title"),
    department: text("department"),
    staffNo: text("staff_no"),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [index("candidates_request_idx").on(t.requestId), index("candidates_name_idx").on(t.name)],
);

export const requestActions = pgTable(
  "request_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => trainingRequests.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id),
    action: actionTypeEnum("action").notNull(),
    fromStatus: requestStatusEnum("from_status"),
    toStatus: requestStatusEnum("to_status"),
    sentBackTo: text("sent_back_to"),
    remark: text("remark"),
    notified: jsonb("notified").$type<{ name: string; email: string }[]>(),
    selfApproved: boolean("self_approved").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("actions_request_idx").on(t.requestId)],
);

export const requestRevisions = pgTable(
  "request_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => trainingRequests.id, { onDelete: "cascade" }),
    revisionNo: integer("revision_no").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    createdById: uuid("created_by_id").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("revisions_request_no_idx").on(t.requestId, t.revisionNo)],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => trainingRequests.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("comments_request_idx").on(t.requestId)],
);

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => trainingRequests.id, { onDelete: "cascade" }),
    originalName: text("original_name").notNull(),
    storedName: text("stored_name").notNull().unique(),
    /** SUPPORTING (brochure, quotation) or NAME_LIST (participant list for > 8 people). */
    kind: text("kind").notNull().default("SUPPORTING"),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    uploadedById: uuid("uploaded_by_id")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("attachments_request_idx").on(t.requestId)],
);

// ---------- Infrastructure ----------
export const notificationLogs = pgTable(
  "notification_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id").references(() => trainingRequests.id, { onDelete: "set null" }),
    event: text("event").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: notificationStatusEnum("status").notNull().default("PENDING"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [index("notif_status_idx").on(t.status)],
);

export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id")
    .notNull()
    .references(() => users.id),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  change: jsonb("change").$type<Record<string, unknown>>().notNull(),
  createdAt: createdAt(),
});

export const refCounters = pgTable("ref_counters", {
  year: integer("year").primaryKey(),
  lastNo: integer("last_no").notNull().default(0),
});

// ---------- Relations (for relational queries) ----------
export const usersRelations = relations(users, ({ one, many }) => ({
  department: one(departments, { fields: [users.departmentId], references: [departments.id] }),
  roles: many(roleAssignments),
}));
export const departmentsRelations = relations(departments, ({ one }) => ({
  businessUnit: one(businessUnits, { fields: [departments.businessUnitId], references: [businessUnits.id] }),
  hod: one(users, { fields: [departments.hodUserId], references: [users.id] }),
}));
export const businessUnitsRelations = relations(businessUnits, ({ many }) => ({
  departments: many(departments),
  admins: many(businessUnitAdmins),
}));
export const businessUnitAdminsRelations = relations(businessUnitAdmins, ({ one }) => ({
  businessUnit: one(businessUnits, { fields: [businessUnitAdmins.businessUnitId], references: [businessUnits.id] }),
  user: one(users, { fields: [businessUnitAdmins.userId], references: [users.id] }),
}));
export const roleAssignmentsRelations = relations(roleAssignments, ({ one }) => ({
  user: one(users, { fields: [roleAssignments.userId], references: [users.id] }),
}));
export const trainingRequestsRelations = relations(trainingRequests, ({ one, many }) => ({
  requester: one(users, { fields: [trainingRequests.requesterId], references: [users.id] }),
  department: one(departments, { fields: [trainingRequests.departmentId], references: [departments.id] }),
  businessUnit: one(businessUnits, { fields: [trainingRequests.businessUnitId], references: [businessUnits.id] }),
  candidates: many(candidates),
  actions: many(requestActions),
  revisions: many(requestRevisions),
  comments: many(comments),
  attachments: many(attachments),
}));
export const candidatesRelations = relations(candidates, ({ one }) => ({
  request: one(trainingRequests, { fields: [candidates.requestId], references: [trainingRequests.id] }),
}));
export const requestActionsRelations = relations(requestActions, ({ one }) => ({
  request: one(trainingRequests, { fields: [requestActions.requestId], references: [trainingRequests.id] }),
  actor: one(users, { fields: [requestActions.actorId], references: [users.id] }),
}));
export const requestRevisionsRelations = relations(requestRevisions, ({ one }) => ({
  request: one(trainingRequests, { fields: [requestRevisions.requestId], references: [trainingRequests.id] }),
}));
export const commentsRelations = relations(comments, ({ one }) => ({
  request: one(trainingRequests, { fields: [comments.requestId], references: [trainingRequests.id] }),
  author: one(users, { fields: [comments.authorId], references: [users.id] }),
}));
export const attachmentsRelations = relations(attachments, ({ one }) => ({
  request: one(trainingRequests, { fields: [attachments.requestId], references: [trainingRequests.id] }),
  uploadedBy: one(users, { fields: [attachments.uploadedById], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type Department = typeof departments.$inferSelect;
export type BusinessUnit = typeof businessUnits.$inferSelect;
export type TrainingRequest = typeof trainingRequests.$inferSelect;
export type Candidate = typeof candidates.$inferSelect;
export type RequestAction = typeof requestActions.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type NotificationLog = typeof notificationLogs.$inferSelect;
