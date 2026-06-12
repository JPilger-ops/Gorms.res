import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const reservationStatusEnum = pgEnum("reservation_status", [
  "pending",
  "accepted",
  "declined",
  "cancelled",
]);

export const userRoleEnum = pgEnum("user_role", ["admin", "mitarbeiter"]);

export const availabilityStatusEnum = pgEnum("availability_status", [
  "bookable",
  "manual_review",
  "capacity_warning",
  "blocked",
]);

export const reservationSeasonEnum = pgEnum("reservation_season", ["summer", "winter"]);

export const outgoingEmailTypeEnum = pgEnum("outgoing_email_type", [
  "guest_receipt",
  "staff_notification",
  "guest_acceptance",
  "guest_decline",
  "guest_question",
  "staff_acceptance_notification",
]);

export const outgoingEmailSmtpStatusEnum = pgEnum("outgoing_email_smtp_status", ["sent", "failed"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("mitarbeiter"),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    index("users_role_idx").on(table.role),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionTokenHash: text("session_token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.sessionTokenHash),
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const reservationRequests = pgTable(
  "reservation_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestedDate: date("requested_date").notNull(),
    requestedTime: time("requested_time", { withTimezone: false }).notNull(),
    guestName: varchar("guest_name", { length: 160 }).notNull(),
    guestEmail: varchar("guest_email", { length: 320 }).notNull(),
    guestPhone: varchar("guest_phone", { length: 80 }).notNull(),
    guestCount: integer("guest_count").notNull(),
    message: text("message"),
    status: reservationStatusEnum("status").notNull().default("pending"),
    privacyAcknowledgedAt: timestamp("privacy_acknowledged_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("reservation_requests_requested_date_idx").on(table.requestedDate),
    index("reservation_requests_status_idx").on(table.status),
    index("reservation_requests_created_at_idx").on(table.createdAt),
  ],
);

export const reservationAvailabilityChecks = pgTable(
  "reservation_availability_checks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reservationRequestId: uuid("reservation_request_id")
      .notNull()
      .references(() => reservationRequests.id, { onDelete: "cascade" }),
    status: availabilityStatusEnum("status").notNull(),
    hardBlocked: boolean("hard_blocked").notNull().default(false),
    reasons: jsonb("reasons")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    warnings: jsonb("warnings")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    manualReviewReasons: jsonb("manual_review_reasons")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    acceptedGuestsInWindow: integer("accepted_guests_in_window").notNull().default(0),
    pendingGuestsInWindow: integer("pending_guests_in_window").notNull().default(0),
    requestedGuestCount: integer("requested_guest_count").notNull(),
    capacity: integer("capacity").notNull(),
    windowStart: time("window_start", { withTimezone: false }).notNull(),
    windowEnd: time("window_end", { withTimezone: false }).notNull(),
    latestReservationTime: time("latest_reservation_time", { withTimezone: false }).notNull(),
    season: reservationSeasonEnum("season").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("reservation_availability_checks_request_unique").on(table.reservationRequestId),
    index("reservation_availability_checks_status_idx").on(table.status),
    index("reservation_availability_checks_created_at_idx").on(table.createdAt),
  ],
);

export const reservationOutgoingEmails = pgTable(
  "reservation_outgoing_emails",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reservationRequestId: uuid("reservation_request_id")
      .notNull()
      .references(() => reservationRequests.id, { onDelete: "cascade" }),
    type: outgoingEmailTypeEnum("type").notNull(),
    recipient: varchar("recipient", { length: 320 }).notNull(),
    subject: varchar("subject", { length: 240 }).notNull(),
    body: text("body").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    sentByUserId: uuid("sent_by_user_id").references(() => users.id, { onDelete: "set null" }),
    smtpStatus: outgoingEmailSmtpStatusEnum("smtp_status").notNull(),
    smtpError: varchar("smtp_error", { length: 240 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("reservation_outgoing_emails_request_idx").on(table.reservationRequestId),
    index("reservation_outgoing_emails_type_idx").on(table.type),
    index("reservation_outgoing_emails_created_at_idx").on(table.createdAt),
  ],
);

export const reservationEvents = pgTable(
  "reservation_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    date: date("date").notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    publicNote: varchar("public_note", { length: 240 }),
    reservationsAllowed: boolean("reservations_allowed").notNull().default(false),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("reservation_events_date_idx").on(table.date),
    index("reservation_events_reservations_allowed_idx").on(table.reservationsAllowed),
  ],
);

export const blockedDays = pgTable(
  "blocked_days",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    date: date("date").notNull(),
    reason: varchar("reason", { length: 240 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("blocked_days_date_unique").on(table.date)],
);

export const appSettings = pgTable("app_settings", {
  key: varchar("key", { length: 120 }).primaryKey(),
  value: text("value").notNull(),
  isSecret: boolean("is_secret").notNull().default(false),
  updatedByUserId: uuid("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 160 }).notNull(),
    entityType: varchar("entity_type", { length: 120 }).notNull(),
    entityId: varchar("entity_id", { length: 160 }),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_log_user_id_idx").on(table.userId),
    index("audit_log_action_idx").on(table.action),
    index("audit_log_created_at_idx").on(table.createdAt),
  ],
);
