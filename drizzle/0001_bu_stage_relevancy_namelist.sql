ALTER TYPE "public"."request_status" ADD VALUE 'PENDING_BU' BEFORE 'PENDING_LND';--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "kind" text DEFAULT 'SUPPORTING' NOT NULL;--> statement-breakpoint
ALTER TABLE "training_requests" ADD COLUMN "relevancy" text;--> statement-breakpoint
ALTER TABLE "training_requests" ADD COLUMN "participant_count" integer;