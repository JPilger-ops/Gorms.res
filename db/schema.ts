import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
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

export const availabilityStrategyEnum = pgEnum("availability_strategy", ["CAPACITY", "TABLES"]);

export const venues = pgTable("venues", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  shortName: varchar("short_name", { length: 80 }).notNull(),
  timeZone: varchar("time_zone", { length: 80 }).notNull(),
  availabilityStrategy: availabilityStrategyEnum("availability_strategy").notNull(),
  isActive: boolean("is_active").notNull().default(false),
});

export const venueHosts = pgTable("venue_hosts", {
  host: varchar("host", { length: 253 }).primaryKey(),
  venueId: uuid("venue_id")
    .notNull()
    .references(() => venues.id, { onDelete: "restrict" }),
});

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
    venueId: uuid("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "restrict" }),
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
    index("reservation_requests_venue_date_idx").on(table.venueId, table.requestedDate),
    index("reservation_requests_venue_status_idx").on(table.venueId, table.status),
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
    venueId: uuid("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "restrict" }),
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
    index("reservation_events_venue_date_idx").on(table.venueId, table.date),
  ],
);

export const blockedDays = pgTable(
  "blocked_days",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    venueId: uuid("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "restrict" }),
    date: date("date").notNull(),
    reason: varchar("reason", { length: 240 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("blocked_days_venue_date_unique").on(table.venueId, table.date)],
);

export const appSettings = pgTable("app_settings", {
  key: varchar("key", { length: 120 }).primaryKey(),
  value: text("value").notNull(),
  isSecret: boolean("is_secret").notNull().default(false),
  updatedByUserId: uuid("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const venueSettings = pgTable(
  "venue_settings",
  {
    venueId: uuid("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "restrict" }),
    key: varchar("key", { length: 120 }).notNull(),
    value: text("value").notNull(),
    isSecret: boolean("is_secret").notNull().default(false),
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.venueId, table.key] })],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    venueId: uuid("venue_id").references(() => venues.id, { onDelete: "restrict" }),
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
    index("audit_log_venue_idx").on(table.venueId),
  ],
);

export const venueAreas = pgTable(
  "venue_areas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    venueId: uuid("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 80 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    isOnlineBookable: boolean("is_online_bookable").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    revision: integer("revision").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("venue_areas_live_name_unique")
      .on(t.venueId, sql`lower(${t.name})`)
      .where(sql`${t.archivedAt} is null`),
    index("venue_areas_venue_idx").on(t.venueId, t.sortOrder),
    check(
      "venue_areas_values",
      sql`length(btrim(${t.name})) > 0 and ${t.name} = btrim(${t.name}) and ${t.revision} >= 0 and ${t.sortOrder} >= 0`,
    ),
  ],
);

export const floorplanAssets = pgTable(
  "floorplan_assets",
  {
    id: uuid("id").primaryKey(),
    areaId: uuid("area_id")
      .notNull()
      .references(() => venueAreas.id, { onDelete: "restrict" }),
    filePath: varchar("file_path", { length: 360 }).notNull().unique(),
    mimeType: varchar("mime_type", { length: 30 }).notNull().default("image/png"),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    byteSize: integer("byte_size").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("floorplan_assets_id_area_unique").on(t.id, t.areaId),
    index("floorplan_assets_retired_idx").on(t.retiredAt),
    check(
      "floorplan_assets_values",
      sql`${t.mimeType} = 'image/png' and ${t.width} between 64 and 8192 and ${t.height} between 64 and 8192 and ${t.width}::bigint * ${t.height} <= 16777216 and ${t.byteSize} between 1 and 33554432`,
    ),
  ],
);

export const areaPlanLayouts = pgTable(
  "area_plan_layouts",
  {
    areaId: uuid("area_id")
      .primaryKey()
      .references(() => venueAreas.id, { onDelete: "restrict" }),
    floorplanAssetId: uuid("floorplan_asset_id"),
    aspectRatio: numeric("aspect_ratio", { precision: 16, scale: 10, mode: "number" })
      .notNull()
      .default(4 / 3),
    backgroundScale: numeric("background_scale", { precision: 12, scale: 8, mode: "number" })
      .notNull()
      .default(1),
    backgroundX: numeric("background_x", { precision: 12, scale: 8, mode: "number" })
      .notNull()
      .default(0),
    backgroundY: numeric("background_y", { precision: 12, scale: 8, mode: "number" })
      .notNull()
      .default(0),
    backgroundOpacity: numeric("background_opacity", { precision: 12, scale: 8, mode: "number" })
      .notNull()
      .default(1),
  },
  (t) => [
    foreignKey({
      columns: [t.floorplanAssetId, t.areaId],
      foreignColumns: [floorplanAssets.id, floorplanAssets.areaId],
      name: "area_plan_layouts_asset_area_fk",
    }).onDelete("restrict"),
    check(
      "area_plan_layouts_values",
      sql`${t.aspectRatio} between 0.0078125 and 128 and ${t.backgroundScale} between 0.25 and 4 and ${t.backgroundX} between -1 and 1 and ${t.backgroundY} between -1 and 1 and ${t.backgroundOpacity} between 0 and 1`,
    ),
  ],
);

export const physicalTables = pgTable(
  "physical_tables",
  {
    id: uuid("id").primaryKey(),
    areaId: uuid("area_id")
      .notNull()
      .references(() => venueAreas.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 80 }).notNull(),
    minGuests: integer("min_guests").notNull(),
    maxGuests: integer("max_guests").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    isOnlineBookable: boolean("is_online_bookable").notNull().default(false),
    isWheelchairAccessible: boolean("is_wheelchair_accessible").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("physical_tables_id_area_unique").on(t.id, t.areaId),
    uniqueIndex("physical_tables_live_name_unique")
      .on(t.areaId, sql`lower(${t.name})`)
      .where(sql`${t.archivedAt} is null`),
    check(
      "physical_tables_values",
      sql`${t.minGuests} between 1 and 1000 and ${t.maxGuests} between ${t.minGuests} and 1000 and length(btrim(${t.name})) > 0 and ${t.name} = btrim(${t.name})`,
    ),
  ],
);

export const tableLayouts = pgTable(
  "table_layouts",
  {
    tableId: uuid("table_id")
      .primaryKey()
      .references(() => physicalTables.id, { onDelete: "restrict" }),
    shape: varchar("shape", { length: 12 }).notNull(),
    x: numeric("x", { precision: 12, scale: 8, mode: "number" }).notNull(),
    y: numeric("y", { precision: 12, scale: 8, mode: "number" }).notNull(),
    width: numeric("width", { precision: 12, scale: 8, mode: "number" }).notNull(),
    height: numeric("height", { precision: 12, scale: 8, mode: "number" }).notNull(),
    rotation: numeric("rotation", { precision: 7, scale: 3, mode: "number" }).notNull().default(0),
    zOrder: integer("z_order").notNull().default(0),
  },
  (t) => [
    check(
      "table_layouts_values",
      sql`${t.shape} in ('round', 'square', 'rectangle') and ${t.x} between 0 and 1 and ${t.y} between 0 and 1 and ${t.width} between 0.0001 and 1 and ${t.height} between 0.0001 and 1 and ${t.rotation} >= 0 and ${t.rotation} < 360 and ${t.zOrder} between 0 and 10000`,
    ),
  ],
);

export const tableCombinations = pgTable(
  "table_combinations",
  {
    id: uuid("id").primaryKey(),
    areaId: uuid("area_id")
      .notNull()
      .references(() => venueAreas.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 80 }).notNull(),
    minGuests: integer("min_guests").notNull(),
    maxGuests: integer("max_guests").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    isOnlineBookable: boolean("is_online_bookable").notNull().default(false),
    isWheelchairAccessible: boolean("is_wheelchair_accessible").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("table_combinations_id_area_unique").on(t.id, t.areaId),
    uniqueIndex("table_combinations_live_name_unique")
      .on(t.areaId, sql`lower(${t.name})`)
      .where(sql`${t.archivedAt} is null`),
    check(
      "table_combinations_values",
      sql`${t.minGuests} between 1 and 1000 and ${t.maxGuests} between ${t.minGuests} and 1000 and length(btrim(${t.name})) > 0 and ${t.name} = btrim(${t.name})`,
    ),
  ],
);

export const tableCombinationMembers = pgTable(
  "table_combination_members",
  {
    combinationId: uuid("combination_id").notNull(),
    tableId: uuid("table_id").notNull(),
    areaId: uuid("area_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.combinationId, t.tableId] }),
    foreignKey({
      columns: [t.combinationId, t.areaId],
      foreignColumns: [tableCombinations.id, tableCombinations.areaId],
      name: "combination_members_combination_area_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.tableId, t.areaId],
      foreignColumns: [physicalTables.id, physicalTables.areaId],
      name: "combination_members_table_area_fk",
    }).onDelete("restrict"),
    index("combination_members_table_idx").on(t.tableId),
  ],
);
