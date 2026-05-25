import { and, count, desc, eq, type SQL } from "drizzle-orm";
import { reservationRequests } from "@/db/schema";
import type { ReservationRequestInput } from "@/src/lib/reservation-validation";
import { db } from "@/src/server/db";
import { validateReservationRules } from "@/src/server/reservation-rules";

export const reservationStatuses = ["pending", "accepted", "declined", "cancelled"] as const;

export type ReservationStatus = (typeof reservationStatuses)[number];

export type ReservationStatusFilter = ReservationStatus | "all";

export type CreateReservationResult =
  | {
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

export async function getAdminReservationRequests({ status }: { status: ReservationStatusFilter }) {
  const filters: SQL[] = [];

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
  input: ReservationRequestInput,
): Promise<CreateReservationResult> {
  const ruleResult = await validateReservationRules({
    date: input.date,
    guestCount: input.guestCount,
    time: input.time,
  });

  if (!ruleResult.allowed) {
    return {
      ok: false,
      reasons: ruleResult.reasons,
    };
  }

  const [reservation] = await db
    .insert(reservationRequests)
    .values({
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

  return {
    ok: true,
    id: reservation.id,
    emailData: {
      ...input,
      id: reservation.id,
    },
  };
}
