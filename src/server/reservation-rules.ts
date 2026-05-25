import { eq } from "drizzle-orm";
import { blockedDays } from "@/db/schema";
import { isIsoDate, isPastDate, isSunday, isTime, isTimeInRange } from "@/src/lib/dates";
import { db } from "@/src/server/db";
import { isPublicHoliday } from "@/src/server/holidays";
import { getBusinessSettings } from "@/src/server/settings";

export type ReservationRuleInput = {
  date: string;
  guestCount: number;
  time: string;
};

export type ReservationRuleResult = {
  allowed: boolean;
  reasons: string[];
};

export async function validateReservationRules(
  input: ReservationRuleInput,
): Promise<ReservationRuleResult> {
  const reasons: string[] = [];
  const settings = await getBusinessSettings();

  if (!isIsoDate(input.date)) {
    reasons.push("Das Datum ist ungültig.");
  } else if (isPastDate(input.date)) {
    reasons.push("Das Datum liegt in der Vergangenheit.");
  }

  if (!isTime(input.time)) {
    reasons.push("Die Uhrzeit ist ungültig.");
  } else if (
    !isTimeInRange(input.time, settings.earliestReservationTime, settings.latestReservationTime)
  ) {
    reasons.push(
      `Reservierungen sind zwischen ${settings.earliestReservationTime} und ${settings.latestReservationTime} möglich.`,
    );
  }

  if (!Number.isInteger(input.guestCount) || input.guestCount < 1) {
    reasons.push("Die Personenanzahl ist ungültig.");
  } else if (input.guestCount > settings.maxGuestsPerRequest) {
    reasons.push(`Maximal ${settings.maxGuestsPerRequest} Personen pro Anfrage möglich.`);
  }

  if (isIsoDate(input.date)) {
    if (settings.blockSundays && isSunday(input.date)) {
      reasons.push("Sonntage sind für Reservierungsanfragen gesperrt.");
    }

    const holiday = isPublicHoliday(input.date, settings.holidayCountry, settings.holidayState);

    if (holiday.isHoliday) {
      reasons.push(`${holiday.name ?? "Feiertage"} sind für Reservierungsanfragen gesperrt.`);
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
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  };
}
