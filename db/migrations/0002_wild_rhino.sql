CREATE TYPE "public"."availability_status" AS ENUM('bookable', 'manual_review', 'capacity_warning', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."outgoing_email_smtp_status" AS ENUM('sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."outgoing_email_type" AS ENUM('guest_receipt', 'staff_notification', 'guest_acceptance', 'guest_decline', 'guest_question', 'staff_acceptance_notification');--> statement-breakpoint
CREATE TYPE "public"."reservation_season" AS ENUM('summer', 'winter');--> statement-breakpoint
CREATE TABLE "reservation_availability_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_request_id" uuid NOT NULL,
	"status" "availability_status" NOT NULL,
	"hard_blocked" boolean DEFAULT false NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"manual_review_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"accepted_guests_in_window" integer DEFAULT 0 NOT NULL,
	"pending_guests_in_window" integer DEFAULT 0 NOT NULL,
	"requested_guest_count" integer NOT NULL,
	"capacity" integer NOT NULL,
	"window_start" time NOT NULL,
	"window_end" time NOT NULL,
	"latest_reservation_time" time NOT NULL,
	"season" "reservation_season" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"title" varchar(160) NOT NULL,
	"public_note" varchar(240),
	"reservations_allowed" boolean DEFAULT false NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservation_outgoing_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_request_id" uuid NOT NULL,
	"type" "outgoing_email_type" NOT NULL,
	"recipient" varchar(320) NOT NULL,
	"subject" varchar(240) NOT NULL,
	"body" text NOT NULL,
	"sent_at" timestamp with time zone,
	"sent_by_user_id" uuid,
	"smtp_status" "outgoing_email_smtp_status" NOT NULL,
	"smtp_error" varchar(240),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reservation_availability_checks" ADD CONSTRAINT "reservation_availability_checks_reservation_request_id_reservation_requests_id_fk" FOREIGN KEY ("reservation_request_id") REFERENCES "public"."reservation_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_events" ADD CONSTRAINT "reservation_events_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_outgoing_emails" ADD CONSTRAINT "reservation_outgoing_emails_reservation_request_id_reservation_requests_id_fk" FOREIGN KEY ("reservation_request_id") REFERENCES "public"."reservation_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_outgoing_emails" ADD CONSTRAINT "reservation_outgoing_emails_sent_by_user_id_users_id_fk" FOREIGN KEY ("sent_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reservation_availability_checks_request_unique" ON "reservation_availability_checks" USING btree ("reservation_request_id");--> statement-breakpoint
CREATE INDEX "reservation_availability_checks_status_idx" ON "reservation_availability_checks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reservation_availability_checks_created_at_idx" ON "reservation_availability_checks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "reservation_events_date_idx" ON "reservation_events" USING btree ("date");--> statement-breakpoint
CREATE INDEX "reservation_events_reservations_allowed_idx" ON "reservation_events" USING btree ("reservations_allowed");--> statement-breakpoint
CREATE INDEX "reservation_outgoing_emails_request_idx" ON "reservation_outgoing_emails" USING btree ("reservation_request_id");--> statement-breakpoint
CREATE INDEX "reservation_outgoing_emails_type_idx" ON "reservation_outgoing_emails" USING btree ("type");--> statement-breakpoint
CREATE INDEX "reservation_outgoing_emails_created_at_idx" ON "reservation_outgoing_emails" USING btree ("created_at");