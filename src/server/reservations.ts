import { and, count, desc, eq, type SQL } from "drizzle-orm";
import { auditLog, reservationAvailabilityChecks, reservationRequests } from "@/db/schema";
import type { ReservationRequestInput } from "@/src/lib/reservation-validation";
import type { UpdateReservationStatusInput } from "@/src/lib/reservation-status-validation";
import { db } from "@/src/server/db";
import type { AuthenticatedSession } from "@/src/server/guards";
import {
  checkReservationAvailability,
  type AvailabilityCheckResult,
} from "@/src/server/reservation-availability";
import { detectSpecialRequests } from "@/src/server/special-requests";
import type { VenueContext } from "@/src/server/venues";

export const reservationStatuses = ["pending", "accepted", "declined", "cancelled"] as const;

export type ReservationStatus = (typeof reservationStatuses)[number];

export type ReservationStatusFilter = ReservationStatus | "all";

export type CreateReservationResult =
  | {
      availability: AvailabilityCheckResult;
      ok: true;
      id: string;
      emailData: ReservationRequestInput & { id: string };
    }
  | {
      ok: false;
      reasons: string[];
    };

export function normalizeReservationStatusFilter(value: unknown): ReservationStatusFilter {
  const status = Array.isArray(value) ? value[0] : value;

  if (status === "all" || reservationStatuses.includes(status as ReservationStatus)) {
    return status as ReservationStatusFilter;
  }

  return "all";
}

export async function getAdminReservationRequests(
  venue: VenueContext,
  { status }: { status: ReservationStatusFilter },
) {
  const filters: SQL[] = [eq(reservationRequests.venueId, venue.id)];

  if (status !== "all") {
    filters.push(eq(reservationRequests.status, status));
  }

  const where = filters.length ? and(...filters) : undefined;

  const [reservations, totalRows, statusRows] = await Promise.all([
    db
      .select({
        createdAt: reservationRequests.createdAt,
        guestCount: reservationRequests.guestCount,
        guestEmail: reservationRequests.guestEmail,
        guestName: reservationRequests.guestName,
        guestPhone: reservationRequests.guestPhone,
        id: reservationRequests.id,
        message: reservationRequests.message,
        requestedDate: reservationRequests.requestedDate,
        requestedTime: reservationRequests.requestedTime,
        status: reservationRequests.status,
      })
      .from(reservationRequests)
      .where(where)
      .orderBy(desc(reservationRequests.createdAt))
      .limit(100),
    db.select({ count: count() }).from(reservationRequests).where(where),
    db
      .select({
        count: count(),
        status: reservationRequests.status,
      })
      .from(reservationRequests)
      .where(eq(reservationRequests.venueId, venue.id))
      .groupBy(reservationRequests.status),
  ]);

  const countsByStatus = Object.fromEntries(
    reservationStatuses.map((reservationStatus) => [
      reservationStatus,
      statusRows.find((row) => row.status === reservationStatus)?.count ?? 0,
    ]),
  ) as Record<ReservationStatus, number>;

  return {
    countsByStatus,
    reservations,
    total: totalRows[0]?.count ?? 0,
  };
}

export async function createReservationRequest(
  venue: VenueContext,
  input: ReservationRequestInput,
): Promise<CreateReservationResult> {
  const baseAvailability = await checkReservationAvailability(venue, {
    date: input.date,
    guestCount: input.guestCount,
    time: input.time,
  });
  const specialRequests = detectSpecialRequests(input.message, input.guestCount);
  const availability: AvailabilityCheckResult = {
    ...baseAvailability,
    manualReviewReasons: [
      ...baseAvailability.manualReviewReasons,
      ...specialRequests.manualReviewReasons,
    ],
    status:
      baseAvailability.status === "bookable" && specialRequests.hasSpecialRequest
        ? "manual_review"
        : baseAvailability.status,
  };

  if (availability.hardBlocked) {
    return {
      ok: false,
      reasons: availability.reasons,
    };
  }

  const reservation = await db.transaction(async (tx) => {
    const [createdReservation] = await tx
      .insert(reservationRequests)
      .values({
        venueId: venue.id,
        requestedDate: input.date,
        requestedTime: input.time,
        guestName: input.guestName,
        guestEmail: input.email,
        guestPhone: input.phone,
        guestCount: input.guestCount,
        message: input.message,
        status: "pending",
        privacyAcknowledgedAt: new Date(),
      })
      .returning({ id: reservationRequests.id });

    await tx.insert(reservationAvailabilityChecks).values({
      acceptedGuestsInWindow: availability.acceptedGuestsInWindow,
      capacity: availability.capacity,
      hardBlocked: availability.hardBlocked,
      latestReservationTime: availability.latestReservationTime,
      manualReviewReasons: availability.manualReviewReasons,
      pendingGuestsInWindow: availability.pendingGuestsInWindow,
      reasons: availability.reasons,
      requestedGuestCount: availability.requestedGuestCount,
      reservationRequestId: createdReservation.id,
      season: availability.season,
      status: availability.status,
      warnings: availability.warnings,
      windowEnd: availability.windowEnd,
      windowStart: availability.windowStart,
    });

    return createdReservation;
  });

  return {
    availability,
    ok: true,
    id: reservation.id,
    emailData: {
      ...input,
      id: reservation.id,
    },
  };
}

export async function updateReservationStatus(
  venue: VenueContext,
  input: UpdateReservationStatusInput,
  session: AuthenticatedSession,
) {
  const [currentReservation] = await db
    .select({ id: reservationRequests.id, status: reservationRequests.status })
    .from(reservationRequests)
    .where(and(eq(reservationRequests.id, input.id), eq(reservationRequests.venueId, venue.id)))
    .limit(1);

  if (!currentReservation) {
    return {
      ok: false as const,
      message: "Reservierungsanfrage wurde nicht gefunden.",
    };
  }

  if (currentReservation.status === input.status) {
    return {
      ok: true as const,
      changed: false as const,
    };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(reservationRequests)
      .set({
        status: input.status,
        updatedAt: new Date(),
      })
      .where(and(eq(reservationRequests.id, input.id), eq(reservationRequests.venueId, venue.id)));

    await tx.insert(auditLog).values({
      userId: session.userId,
      action: "reservation.status_update",
      venueId: venue.id,
      entityType: "reservation_request",
      entityId: input.id,
      metadata: {
        from: currentReservation.status,
        reason: input.reason,
        to: input.status,
      },
    });
  });

  return {
    ok: true as const,
    changed: true as const,
  };
}
