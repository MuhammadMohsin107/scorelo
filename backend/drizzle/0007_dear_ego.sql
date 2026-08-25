ALTER TABLE "audits" ADD COLUMN "source" text DEFAULT 'engine' NOT NULL;--> statement-breakpoint
ALTER TABLE "audits" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "audits" ADD CONSTRAINT "audits_source_valid" CHECK ("audits"."source" IN ('engine', 'seed'));