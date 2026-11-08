ALTER TABLE "tenant" ADD COLUMN "plan_id" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "banned" boolean DEFAULT false NOT NULL;