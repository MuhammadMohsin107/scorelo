CREATE TABLE "audit_scores" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_scores_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"audit_id" integer NOT NULL,
	"pillar" text NOT NULL,
	"sub_pillar" text,
	"score" integer NOT NULL,
	"checks_total" integer,
	"checks_passed" integer,
	"analyzed_count" integer,
	"healthy_count" integer,
	CONSTRAINT "audit_scores_score_range" CHECK ("audit_scores"."score" BETWEEN 0 AND 100),
	CONSTRAINT "audit_scores_pillar_valid" CHECK ("audit_scores"."pillar" IN ('seo', 'content', 'speed', 'cro', 'ai-discovery'))
);
--> statement-breakpoint
CREATE TABLE "audits" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audits_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"store_id" integer NOT NULL,
	"overall_score" integer NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audits_score_range" CHECK ("audits"."overall_score" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "findings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "findings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"audit_id" integer NOT NULL,
	"pillar" text NOT NULL,
	"sub_pillar" text NOT NULL,
	"title" text NOT NULL,
	"severity" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution_type" text,
	"affected_count" integer NOT NULL,
	"affected_label" text NOT NULL,
	"impact" text NOT NULL,
	"score_lift" integer DEFAULT 0 NOT NULL,
	"problem" text,
	"why" text NOT NULL,
	"recommendation" text NOT NULL,
	"evidence" text[] DEFAULT '{}'::text[] NOT NULL,
	"status_changed_at" timestamp with time zone,
	CONSTRAINT "findings_severity_valid" CHECK ("findings"."severity" IN ('critical', 'high', 'medium', 'low')),
	CONSTRAINT "findings_status_valid" CHECK ("findings"."status" IN ('open', 'reviewed', 'resolved', 'ignored')),
	CONSTRAINT "findings_pillar_valid" CHECK ("findings"."pillar" IN ('seo', 'content', 'speed', 'cro', 'ai-discovery'))
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "integrations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"store_id" integer NOT NULL,
	"provider" text NOT NULL,
	"status" text DEFAULT 'not_connected' NOT NULL,
	"account_detail" text,
	"last_synced_at" timestamp with time zone,
	"notice" text,
	CONSTRAINT "integrations_status_valid" CHECK ("integrations"."status" IN ('connected', 'needs_attention', 'not_connected'))
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stores_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_name" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"platform" text NOT NULL,
	"industry" text NOT NULL,
	"country" text NOT NULL,
	"timezone" text NOT NULL,
	"currency" text NOT NULL,
	"auto_analysis" boolean DEFAULT true NOT NULL,
	"analysis_frequency" text DEFAULT 'Weekly' NOT NULL,
	"crawl_scope" text DEFAULT 'Entire store' NOT NULL,
	"page_limit" integer DEFAULT 2000 NOT NULL,
	"include_blog" boolean DEFAULT true NOT NULL,
	"include_collections" boolean DEFAULT true NOT NULL,
	"respect_robots" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"job_title" text,
	"role" text DEFAULT 'Administrator' NOT NULL,
	"notify_analysis_complete" boolean DEFAULT true NOT NULL,
	"notify_critical_issues" boolean DEFAULT true NOT NULL,
	"notify_score_changes" boolean DEFAULT true NOT NULL,
	"notify_weekly_summary" boolean DEFAULT true NOT NULL,
	"notify_integration_alerts" boolean DEFAULT true NOT NULL,
	"notify_product_updates" boolean DEFAULT false NOT NULL,
	"density" text DEFAULT 'Comfortable' NOT NULL,
	"reduce_motion" boolean DEFAULT false NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_scores" ADD CONSTRAINT "audit_scores_audit_id_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audits" ADD CONSTRAINT "audits_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_audit_id_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "audit_scores_unique_idx" ON "audit_scores" USING btree ("audit_id","pillar",COALESCE("sub_pillar", ''));--> statement-breakpoint
CREATE INDEX "audits_store_run_idx" ON "audits" USING btree ("store_id","run_at");--> statement-breakpoint
CREATE INDEX "findings_audit_idx" ON "findings" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "findings_status_idx" ON "findings" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "integrations_store_provider_idx" ON "integrations" USING btree ("store_id","provider");