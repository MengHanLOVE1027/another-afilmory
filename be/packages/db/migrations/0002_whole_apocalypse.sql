CREATE TABLE "billing_usage_event" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"event_type" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit" text DEFAULT 'count' NOT NULL,
	"metadata" jsonb DEFAULT 'null'::jsonb,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_usage_event" ADD CONSTRAINT "billing_usage_event_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_billing_usage_event_tenant" ON "billing_usage_event" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_billing_usage_event_type" ON "billing_usage_event" USING btree ("event_type");