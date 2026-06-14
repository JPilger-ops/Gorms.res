import { and, desc, eq, inArray } from "drizzle-orm";
import {
  blockedDays,
  reservationAvailabilityChecks,
  reservationEvents,
  reservationRequests,
} from "@/db/schema";
import {
  isIsoDate,
  isPastDate,
  isSunday,
  isTime,
  parseLocalDate,
  timeToMinutes,
} from "@/src/lib/dates";
import { db } from "@/src/server/db";
import { isPublicHoliday } from "@/src/server/holidays";
import {
  getBusinessSettings,
  getLatestReservationTimeForDate,
  getLatestReservationTimeForSeason,
  getSeasonForDate,
  minutesToTime,
  type ReservationSeason,
} from "@/src/server/settings";

export type AvailabilityStatus = "bookable" | "manual_review" | "capacity_warning" | "blocked";

export type ReservationAvailabilityInput = {
  date: string;
  guestCount: number;
  time: string;
};

export type AvailabilityCheckResult = {
  acceptedGuestsInWindow: number;
  capacity: number;
  hardBlocked: boolean;
  latestReservationTime: string;
  manualReviewReasons: string[];
  pendingGuestsInWindow: number;
  reasons: string[];
  requestedGuestCount: number;
  season: ReservationSeason;
  status: AvailabilityStatus;
  warnings: string[];
  windowEnd: string;
  windowStart: string;
};

export type AvailabilityCheckSnapshotInput = AvailabilityCheckResult & {
  reservationRequestId: string;
};

export type ReservationSlot = {
  hardBlocked: boolean;
  label: string;
  manualReviewReasons: string[];
  reasons: string[];
  status: AvailabilityStatus;
  time: string;
  warnings: string[];
};

function isTimeInInclusiveRange(value: string, earliest: string, latest: string) {
  const requested = timeToMinutes(value);
  const earliestMinutes = timeToMinutes(earliest);
  const latestMinutes = timeToMinutes(latest);

  if (requested === null || earliestMinutes === null || latestMinutes === null) {
    return false;
  }

  return requested >= earliestMinutes && requested <= latestMinutes;
}

function getDayLabel(day: number) {
  return ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"][day];
}

function getWindow(time: string, durationMinutes: number) {
  const start = timeToMinutes(time) ?? 0;
  const end = start + durationMinutes;

  return {
    endMinutes: end,
    startMinutes: start,
    windowEnd: minutesToTime(end),
    windowStart: minutesToTime(start),
  };
}

function windowsOverlap(
  firstStart: number,
  firstEnd: number,
  secondStart: number,
  secondEnd: number,
) {
  return firstStart < secondEnd && secondStart < firstEnd;
}

function clampSlotGuestCount(value: number, maxGuestsPerRequest: number) {
  if (!Number.isInteger(value)) {
    return 1;
  }

  return Math.min(Math.max(value, 1), maxGuestsPerRequest);
}

async function getGuestsInWindow({
  date,
  durationMinutes,
  windowEndMinutes,
  windowStartMinutes,
}: {
  date: string;
  durationMinutes: number;
  windowEndMinutes: number;
  windowStartMinutes: number;
}) {
  if (!isIsoDate(date)) {
    return {
      acceptedGuestsInWindow: 0,
      pendingGuestsInWindow: 0,
    };
  }

  const reservations = await db
    .select({
      guestCount: reservationRequests.guestCount,
      requestedTime: reservationRequests.requestedTime,
      status: reservationRequests.status,
    })
    .from(reservationRequests)
    .where(
      and(
        eq(reservationRequests.requestedDate, date),
        inArray(reservationRequests.status, ["accepted", "pending"]),
      ),
    );

  let acceptedGuestsInWindow = 0;
  let pendingGuestsInWindow = 0;

  for (const reservation of reservations) {
    const existingStart = timeToMinutes(reservation.requestedTime);

    if (existingStart === null) {
      continue;
    }

    const existingEnd = existingStart + durationMinutes;

    if (!windowsOverlap(windowStartMinutes, windowEndMinutes, existingStart, existingEnd)) {
      continue;
    }

    if (reservation.status === "accepted") {
      acceptedGuestsInWindow += reservation.guestCount;
    }

    if (reservation.status === "pending") {
      pendingGuestsInWindow += reservation.guestCount;
    }
  }

  return {
    acceptedGuestsInWindow,
    pendingGuestsInWindow,
  };
}

export async function checkReservationAvailability(
  input: ReservationAvailabilityInput,
): Promise<AvailabilityCheckResult> {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const manualReviewReasons: string[] = [];
  const settings = await getBusinessSettings();
  const season = isIsoDate(input.date) ? getSeasonForDate(input.date, settings) : "summer";
  const latestReservationTime = isIsoDate(input.date)
    ? getLatestReservationTimeForDate(input.date, settings)
    : getLatestReservationTimeForSeason(settings, season);
  const window = getWindow(
    isTime(input.time) ? input.time : settings.earliestReservationTime,
    settings.standardOccupancyMinutes,
  );

  if (!isIsoDate(input.date)) {
    reasons.push("Das Datum ist ungültig.");
  } else if (isPastDate(input.date)) {
    reasons.push("Das Datum liegt in der Vergangenheit.");
  }

  if (!isTime(input.time)) {
    reasons.push("Die Uhrzeit ist ungültig.");
  } else if (
    !isTimeInInclusiveRange(input.time, settings.earliestReservationTime, latestReservationTime)
  ) {
    reasons.push(
      `Reservierungen sind zwischen ${settings.earliestReservationTime} und ${latestReservationTime} möglich.`,
    );
  }

  if (!Number.isInteger(input.guestCount) || input.guestCount < 1) {
    reasons.push("Die Personenanzahl ist ungültig.");
  } else if (input.guestCount > settings.maxGuestsPerRequest) {
    reasons.push(`Maximal ${settings.maxGuestsPerRequest} Personen pro Anfrage möglich.`);
  } else if (input.guestCount >= settings.manualReviewGuestThreshold) {
    manualReviewReasons.push(
      `Anfragen ab ${settings.manualReviewGuestThreshold} Personen benötigen eine manuelle Prüfung.`,
    );
  }

  if (isIsoDate(input.date)) {
    const day = parseLocalDate(input.date)?.getDay();

    if (typeof day === "number") {
      if (settings.blockMondays && day === 1) {
        reasons.push(`${getDayLabel(day)}e sind für Reservierungsanfragen gesperrt.`);
      }

      if (settings.blockTuesdays && day === 2) {
        reasons.push(`${getDayLabel(day)}e sind für Reservierungsanfragen gesperrt.`);
      }
    }

    if (settings.blockSundays && isSunday(input.date)) {
      reasons.push(
        "Wir sind sonntags geöffnet, nehmen aber keine Reservierungen an. Kommen Sie gern einfach vorbei.",
      );
    }

    if (settings.blockPublicHolidays) {
      const holiday = isPublicHoliday(input.date, settings.holidayCountry, settings.holidayState);

      if (holiday.isHoliday) {
        reasons.push(
          `Wir sind an Feiertagen geöffnet, nehmen aber keine Reservierungen an. Kommen Sie gern einfach vorbei.`,
        );
      }
    }

    const [blockedDay, blockingEvent] = await Promise.all([
      db.query.blockedDays.findFirst({
        columns: {
          reason: true,
        },
        where: eq(blockedDays.date, input.date),
      }),
      db.query.reservationEvents.findFirst({
        columns: {
          publicNote: true,
          title: true,
        },
        where: and(
          eq(reservationEvents.date, input.date),
          eq(reservationEvents.reservationsAllowed, false),
        ),
      }),
    ]);

    if (blockedDay) {
      reasons.push(
        blockedDay.reason
          ? `Dieser Tag ist gesperrt: ${blockedDay.reason}`
          : "Dieser Tag ist gesperrt.",
      );
    }

    if (blockingEvent) {
      reasons.push(
        blockingEvent.publicNote ||
          `${blockingEvent.title} - an diesem Tag nehmen wir keine normalen Reservierungen an. Kommen Sie gern einfach vorbei.`,
      );
    }
  }

  const { acceptedGuestsInWindow, pendingGuestsInWindow } = await getGuestsInWindow({
    date: input.date,
    durationMinutes: settings.standardOccupancyMinutes,
    windowEndMinutes: window.endMinutes,
    windowStartMinutes: window.startMinutes,
  });

  if (Number.isInteger(input.guestCount) && input.guestCount > 0 && reasons.length === 0) {
    const confirmedTotal = acceptedGuestsInWindow + input.guestCount;
    const operationalTotal = acceptedGuestsInWindow + pendingGuestsInWindow + input.guestCount;

    if (confirmedTotal > settings.indoorCapacity) {
      warnings.push(
        `Mit bereits bestätigten Anfragen wären ${confirmedTotal} von ${settings.indoorCapacity} Plätzen belegt.`,
      );
    } else if (operationalTotal > settings.indoorCapacity) {
      warnings.push(
        `Mit offenen Anfragen wären ${operationalTotal} von ${settings.indoorCapacity} Plätzen angefragt.`,
      );
    }
  }

  const hardBlocked = reasons.length > 0;
  const status: AvailabilityStatus = hardBlocked
    ? "blocked"
    : warnings.length > 0
      ? "capacity_warning"
      : manualReviewReasons.length > 0
        ? "manual_review"
        : "bookable";

  return {
    acceptedGuestsInWindow,
    capacity: settings.indoorCapacity,
    hardBlocked,
    latestReservationTime,
    manualReviewReasons,
    pendingGuestsInWindow,
    reasons,
    requestedGuestCount: input.guestCount,
    season,
    status,
    warnings,
    windowEnd: window.windowEnd,
    windowStart: window.windowStart,
  };
}

export async function getReservationSlotsForDate({
  date,
  guestCount,
}: {
  date: string;
  guestCount: number;
}) {
  const settings = await getBusinessSettings();
  const slotGuestCount = clampSlotGuestCount(guestCount, settings.maxGuestsPerRequest);
  const season = isIsoDate(date) ? getSeasonForDate(date, settings) : "summer";
  const latestReservationTime = isIsoDate(date)
    ? getLatestReservationTimeForDate(date, settings)
    : getLatestReservationTimeForSeason(settings, season);
  const earliestMinutes = timeToMinutes(settings.earliestReservationTime);
  const latestMinutes = timeToMinutes(latestReservationTime);

  if (earliestMinutes === null || latestMinutes === null || earliestMinutes > latestMinutes) {
    return {
      date,
      latestReservationTime,
      season,
      slots: [] satisfies ReservationSlot[],
    };
  }

  const slots: ReservationSlot[] = [];

  for (
    let slotMinutes = earliestMinutes;
    slotMinutes <= latestMinutes;
    slotMinutes += settings.reservationSlotMinutes
  ) {
    const time = minutesToTime(slotMinutes);
    const availability = await checkReservationAvailability({
      date,
      guestCount: slotGuestCount,
      time,
    });

    slots.push({
      hardBlocked: availability.hardBlocked,
      label: time,
      manualReviewReasons: availability.manualReviewReasons,
      reasons: availability.reasons,
      status: availability.status,
      time,
      warnings: availability.warnings,
    });
  }

  return {
    date,
    guestCount: slotGuestCount,
    latestReservationTime,
    season,
    slots,
  };
}

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
    orderBy: [desc(reservationAvailabilityChecks.createdAt)],
    where: eq(reservationAvailabilityChecks.reservationRequestId, reservationRequestId),
  });
}
