import { and, eq } from "drizzle-orm";
import { blockedDays, reservationEvents } from "@/db/schema";
import {
  isIsoDate,
  isPastDate,
  isSunday,
  isTime,
  isTimeInRange,
  parseLocalDate,
} from "@/src/lib/dates";
import { db } from "@/src/server/db";
import { isPublicHoliday } from "@/src/server/holidays";
import {
  getBusinessSettings,
  getLatestReservationTimeForDate,
  getSeasonForDate,
  type ReservationSeason,
} from "@/src/server/settings";

export type AvailabilityStatus = "bookable" | "manual_review" | "capacity_warning" | "blocked";

export type ReservationRuleInput = {
  date: string;
  guestCount: number;
  time: string;
};

export type ReservationRuleResult = {
  allowed: boolean;
  latestReservationTime?: string;
  manualReviewReasons: string[];
  reasons: string[];
  season?: ReservationSeason;
  status: AvailabilityStatus;
  warnings: string[];
};

export async function validateReservationRules(
  input: ReservationRuleInput,
): Promise<ReservationRuleResult> {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const manualReviewReasons: string[] = [];
  const settings = await getBusinessSettings();
  const season = isIsoDate(input.date) ? getSeasonForDate(input.date, settings) : undefined;
  const latestReservationTime =
    isIsoDate(input.date) && season
      ? getLatestReservationTimeForDate(input.date, settings)
      : undefined;

  if (!isIsoDate(input.date)) {
    reasons.push("Das Datum ist ungültig.");
  } else if (isPastDate(input.date)) {
    reasons.push("Das Datum liegt in der Vergangenheit.");
  }

  if (!isTime(input.time)) {
    reasons.push("Die Uhrzeit ist ungültig.");
  } else if (
    latestReservationTime &&
    !isTimeInRange(input.time, settings.earliestReservationTime, latestReservationTime)
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

    if (settings.blockMondays && day === 1) {
      reasons.push("Montage sind für Reservierungsanfragen gesperrt.");
    }

    if (settings.blockTuesdays && day === 2) {
      reasons.push("Dienstage sind für Reservierungsanfragen gesperrt.");
    }

    if (settings.blockSundays && isSunday(input.date)) {
      reasons.push("Sonntage sind für Reservierungsanfragen gesperrt.");
    }

    if (settings.blockPublicHolidays) {
      const holiday = isPublicHoliday(input.date, settings.holidayCountry, settings.holidayState);

      if (holiday.isHoliday) {
        reasons.push(`${holiday.name ?? "Feiertage"} sind für Reservierungsanfragen gesperrt.`);
      }
    }

    const blockedDay = await db.query.blockedDays.findFirst({
      where: eq(blockedDays.date, input.date),
      columns: {
        reason: true,
      },
    });

    if (blockedDay) {
      reasons.push(
        blockedDay.reason
          ? `Dieser Tag ist gesperrt: ${blockedDay.reason}`
          : "Dieser Tag ist gesperrt.",
      );
    }

    const blockingEvent = await db.query.reservationEvents.findFirst({
      where: and(
        eq(reservationEvents.date, input.date),
        eq(reservationEvents.reservationsAllowed, false),
      ),
      columns: {
        publicNote: true,
        title: true,
      },
    });

    if (blockingEvent) {
      reasons.push(
        blockingEvent.publicNote ||
          `${blockingEvent.title} - an diesem Tag sind keine Reservierungsanfragen möglich.`,
      );
    }
  }

  const status: AvailabilityStatus =
    reasons.length > 0 ? "blocked" : manualReviewReasons.length > 0 ? "manual_review" : "bookable";

  return {
    allowed: reasons.length === 0,
    latestReservationTime,
    manualReviewReasons,
    reasons,
    season,
    status,
    warnings,
  };
}
