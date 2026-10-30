CREATE TABLE "directory_sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"trigger" text NOT NULL,
	"triggered_by_id" uuid,
	"added" integer DEFAULT 0 NOT NULL,
	"updated" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"flagged" integer DEFAULT 0 NOT NULL,
	"ok" boolean,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "directory_seen_at" timestamp with time zone;--> statement-breakpoint
-- Only one sync may run at a time: at most one row without finished_at.
CREATE UNIQUE INDEX "one_running_directory_sync" ON "directory_sync_runs" ((finished_at IS NULL)) WHERE finished_at IS NULL;
