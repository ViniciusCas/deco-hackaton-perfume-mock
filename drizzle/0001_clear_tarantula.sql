CREATE TYPE "public"."note_position" AS ENUM('top', 'middle', 'base');--> statement-breakpoint
CREATE TABLE "product_accords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"strength" integer NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "product_accords_product_id_name_unique" UNIQUE("product_id","name")
);
--> statement-breakpoint
CREATE TABLE "product_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" "note_position" NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "product_notes_product_id_position_name_unique" UNIQUE("product_id","position","name")
);
--> statement-breakpoint
ALTER TABLE "product_accords" ADD CONSTRAINT "product_accords_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_notes" ADD CONSTRAINT "product_notes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;