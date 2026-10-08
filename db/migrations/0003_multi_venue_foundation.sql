CREATE TYPE "public"."availability_strategy" AS ENUM('CAPACITY', 'TABLES');--> statement-breakpoint
CREATE TABLE "venue_hosts" (
	"host" varchar(253) PRIMARY KEY NOT NULL,
	"venue_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_settings" (
	"venue_id" uuid NOT NULL,
	"key" varchar(120) NOT NULL,
	"value" text NOT NULL,
	"is_secret" boolean DEFAULT false NOT NULL,
	"updated_by_user_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venue_settings_venue_id_key_pk" PRIMARY KEY("venue_id","key")
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"short_name" varchar(80) NOT NULL,
	"time_zone" varchar(80) NOT NULL,
	"availability_strategy" "availability_strategy" NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	CONSTRAINT "venues_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
DROP INDEX "blocked_days_date_unique";--> statement-breakpoint
INSERT INTO "venues" ("id", "slug", "name", "short_name", "time_zone", "availability_strategy", "is_active")
VALUES ('00000000-0000-4000-8000-000000000001', 'heidekoenig', 'Waldwirtschaft Heidekönig', 'Heidekönig', 'Europe/Berlin', 'CAPACITY', true);--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "venue_id" uuid;--> statement-breakpoint
ALTER TABLE "blocked_days" ADD COLUMN "venue_id" uuid;--> statement-breakpoint
ALTER TABLE "reservation_events" ADD COLUMN "venue_id" uuid;--> statement-breakpoint
ALTER TABLE "reservation_requests" ADD COLUMN "venue_id" uuid;--> statement-breakpoint
UPDATE "blocked_days" SET "venue_id" = '00000000-0000-4000-8000-000000000001';--> statement-breakpoint
UPDATE "reservation_events" SET "venue_id" = '00000000-0000-4000-8000-000000000001';--> statement-breakpoint
UPDATE "reservation_requests" SET "venue_id" = '00000000-0000-4000-8000-000000000001';--> statement-breakpoint
ALTER TABLE "blocked_days" ALTER COLUMN "venue_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reservation_events" ALTER COLUMN "venue_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reservation_requests" ALTER COLUMN "venue_id" SET NOT NULL;--> statement-breakpoint
UPDATE "audit_log" SET "venue_id" = '00000000-0000-4000-8000-000000000001'
WHERE "entity_type" IN ('reservation_request', 'blocked_day', 'reservation_event', 'app_settings');--> statement-breakpoint
INSERT INTO "venue_settings" ("venue_id", "key", "value", "is_secret", "updated_by_user_id", "updated_at")
SELECT '00000000-0000-4000-8000-000000000001', "key", "value", "is_secret", "updated_by_user_id", "updated_at"
FROM "app_settings" WHERE "key" IN (
  'app_name', 'block_mondays', 'block_public_holidays', 'block_sundays', 'block_tuesdays',
  'earliest_reservation_time', 'holiday_country', 'holiday_state', 'indoor_capacity',
  'latest_reservation_buffer_minutes', 'latest_reservation_time', 'manual_review_guest_threshold',
  'max_guests_per_request', 'reservation_slot_minutes', 'standard_occupancy_minutes',
  'summer_kitchen_acceptance_until', 'summer_season_end', 'summer_season_start', 'winter_kitchen_acceptance_until',
  'guest_email_subject_template', 'internal_email_subject_template', 'reservation_notification_email',
  'imprint_url', 'privacy_contact_email', 'privacy_notice_text', 'privacy_policy_url', 'public_site_url',
  'reservation_retention_days', 'smtp_from_address', 'smtp_from_name', 'smtp_host', 'smtp_password', 'smtp_port', 'smtp_user',
  'branding_accent_color', 'branding_logo_file', 'branding_favicon_file'
);--> statement-breakpoint
DELETE FROM "app_settings" WHERE "key" IN (SELECT "key" FROM "venue_settings" WHERE "venue_id" = '00000000-0000-4000-8000-000000000001');--> statement-breakpoint
ALTER TABLE "venue_hosts" ADD CONSTRAINT "venue_hosts_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_settings" ADD CONSTRAINT "venue_settings_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_settings" ADD CONSTRAINT "venue_settings_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocked_days" ADD CONSTRAINT "blocked_days_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_events" ADD CONSTRAINT "reservation_events_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_requests" ADD CONSTRAINT "reservation_requests_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_venue_idx" ON "audit_log" USING btree ("venue_id");--> statement-breakpoint
CREATE UNIQUE INDEX "blocked_days_venue_date_unique" ON "blocked_days" USING btree ("venue_id","date");--> statement-breakpoint
CREATE INDEX "reservation_events_venue_date_idx" ON "reservation_events" USING btree ("venue_id","date");--> statement-breakpoint
CREATE INDEX "reservation_requests_venue_date_idx" ON "reservation_requests" USING btree ("venue_id","requested_date");--> statement-breakpoint
CREATE INDEX "reservation_requests_venue_status_idx" ON "reservation_requests" USING btree ("venue_id","status");
