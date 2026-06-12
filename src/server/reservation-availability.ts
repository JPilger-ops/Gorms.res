import { eq } from "drizzle-orm";
import { reservationAvailabilityChecks } from "@/db/schema";
import { db } from "@/src/server/db";
import type { AvailabilityStatus } from "@/src/server/reservation-rules";
import type { ReservationSeason } from "@/src/server/settings";

export type AvailabilityCheckSnapshotInput = {
  acceptedGuestsInWindow: number;
  capacity: number;
  hardBlocked: boolean;
  latestReservationTime: string;
  manualReviewReasons: string[];
  pendingGuestsInWindow: number;
  reasons: string[];
  requestedGuestCount: number;
  reservationRequestId: string;
  season: ReservationSeason;
  status: AvailabilityStatus;
  warnings: string[];
  windowEnd: string;
  windowStart: string;
};

export async function saveAvailabilityCheckSnapshot(input: AvailabilityCheckSnapshotInput) {
  const [snapshot] = await db
    .insert(reservationAvailabilityChecks)
    .values({
      acceptedGuestsInWindow: input.acceptedGuestsInWindow,
      capacity: input.capacity,
      hardBlocked: input.hardBlocked,
      latestReservationTime: input.latestReservationTime,
      manualReviewReasons: input.manualReviewReasons,
      pendingGuestsInWindow: input.pendingGuestsInWindow,
      reasons: input.reasons,
      requestedGuestCount: input.requestedGuestCount,
      reservationRequestId: input.reservationRequestId,
      season: input.season,
      status: input.status,
      warnings: input.warnings,
      windowEnd: input.windowEnd,
      windowStart: input.windowStart,
    })
    .onConflictDoUpdate({
      target: reservationAvailabilityChecks.reservationRequestId,
      set: {
        acceptedGuestsInWindow: input.acceptedGuestsInWindow,
        capacity: input.capacity,
        hardBlocked: input.hardBlocked,
        latestReservationTime: input.latestReservationTime,
        manualReviewReasons: input.manualReviewReasons,
        pendingGuestsInWindow: input.pendingGuestsInWindow,
        reasons: input.reasons,
        requestedGuestCount: input.requestedGuestCount,
        season: input.season,
        status: input.status,
        warnings: input.warnings,
        windowEnd: input.windowEnd,
        windowStart: input.windowStart,
      },
    })
    .returning();

  return snapshot;
}

export async function getAvailabilityCheckForReservation(reservationRequestId: string) {
  return db.query.reservationAvailabilityChecks.findFirst({
    where: eq(reservationAvailabilityChecks.reservationRequestId, reservationRequestId),
  });
}
