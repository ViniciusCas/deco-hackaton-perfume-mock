CREATE TYPE "public"."discovery_gap_kind" AS ENUM('rejection_summary', 'zero_result_query');--> statement-breakpoint
ALTER TABLE "discovery_catalog_gaps" ALTER COLUMN "summary" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "discovery_catalog_gaps" ADD COLUMN "kind" "discovery_gap_kind" DEFAULT 'rejection_summary' NOT NULL;--> statement-breakpoint
ALTER TABLE "discovery_catalog_gaps" ADD COLUMN "filters" jsonb;