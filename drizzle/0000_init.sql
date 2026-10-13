CREATE TYPE "public"."action_type" AS ENUM('CREATE', 'SUBMIT', 'RESUBMIT', 'APPROVE', 'REJECT', 'CANCEL', 'COMMENT', 'EDIT_LND_FIELDS');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('PENDING', 'SENT', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('DRAFT', 'PENDING_HOD', 'PENDING_LND', 'PENDING_HR', 'RETURNED', 'APPROVED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."role_name" AS ENUM('LND', 'HR_HEAD', 'SYS_ADMIN');--> statement-breakpoint
CREATE TYPE "public"."training_type" AS ENUM('PLANNED', 'ADHOC');--> statement-breakpoint
CREATE TABLE "admin_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"change" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"original_name" text NOT NULL,
	"stored_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploaded_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attachments_stored_name_unique" UNIQUE("stored_name")
);
--> statement-breakpoint
CREATE TABLE "business_unit_admins" (
	"business_unit_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "business_unit_admins_business_unit_id_user_id_pk" PRIMARY KEY("business_unit_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "business_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_units_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"job_title" text,
	"department" text,
	"staff_no" text,
	"user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"business_unit_id" uuid NOT NULL,
	"hod_user_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid,
	"event" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "notification_status" DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ref_counters" (
	"year" integer PRIMARY KEY NOT NULL,
	"last_no" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" "action_type" NOT NULL,
	"from_status" "request_status",
	"to_status" "request_status",
	"sent_back_to" text,
	"remark" text,
	"notified" jsonb,
	"self_approved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"revision_no" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_assignments" (
	"user_id" uuid NOT NULL,
	"role" "role_name" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_assignments_user_id_role_pk" PRIMARY KEY("user_id","role")
);
--> statement-breakpoint
CREATE TABLE "training_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref_no" text,
	"status" "request_status" DEFAULT 'DRAFT' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"requester_id" uuid NOT NULL,
	"department_id" uuid,
	"business_unit_id" uuid,
	"training_type" "training_type",
	"title" text NOT NULL,
	"objective" text,
	"start_date" date,
	"end_date" date,
	"start_time" text,
	"end_time" text,
	"fee_per_pax" numeric(12, 2),
	"venue" text,
	"conducted_by" text,
	"hrdc_claimable" boolean,
	"hrdc_grant_no" text,
	"lnd_remarks" text,
	"submitted_at" timestamp with time zone,
	"finalised_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_requests_ref_no_unique" UNIQUE("ref_no")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entra_oid" text,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"job_title" text,
	"entra_department" text,
	"department_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_entra_oid_unique" UNIQUE("entra_oid"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_request_id_training_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."training_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_unit_admins" ADD CONSTRAINT "business_unit_admins_business_unit_id_business_units_id_fk" FOREIGN KEY ("business_unit_id") REFERENCES "public"."business_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_unit_admins" ADD CONSTRAINT "business_unit_admins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_request_id_training_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."training_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_request_id_training_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."training_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_business_unit_id_business_units_id_fk" FOREIGN KEY ("business_unit_id") REFERENCES "public"."business_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_hod_user_id_users_id_fk" FOREIGN KEY ("hod_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_request_id_training_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."training_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_actions" ADD CONSTRAINT "request_actions_request_id_training_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."training_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_actions" ADD CONSTRAINT "request_actions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_revisions" ADD CONSTRAINT "request_revisions_request_id_training_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."training_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_revisions" ADD CONSTRAINT "request_revisions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_requests" ADD CONSTRAINT "training_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_requests" ADD CONSTRAINT "training_requests_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_requests" ADD CONSTRAINT "training_requests_business_unit_id_business_units_id_fk" FOREIGN KEY ("business_unit_id") REFERENCES "public"."business_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachments_request_idx" ON "attachments" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "candidates_request_idx" ON "candidates" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "candidates_name_idx" ON "candidates" USING btree ("name");--> statement-breakpoint
CREATE INDEX "comments_request_idx" ON "comments" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "departments_name_lower_idx" ON "departments" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "notif_status_idx" ON "notification_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "actions_request_idx" ON "request_actions" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "revisions_request_no_idx" ON "request_revisions" USING btree ("request_id","revision_no");--> statement-breakpoint
CREATE INDEX "tr_status_idx" ON "training_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tr_requester_idx" ON "training_requests" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "tr_department_idx" ON "training_requests" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "tr_bu_idx" ON "training_requests" USING btree ("business_unit_id");--> statement-breakpoint
CREATE INDEX "users_name_idx" ON "users" USING btree ("name");