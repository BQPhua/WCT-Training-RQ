ALTER TABLE "business_units" ADD COLUMN "requires_hr_approval" boolean DEFAULT true NOT NULL;--> statement-breakpoint
-- Land and Malls requests are finalised by L&D; E&C (and any other unit) keeps HR Head as the final approver.
UPDATE "business_units" SET "requires_hr_approval" = false WHERE "code" IN ('LAND', 'MALLS');
