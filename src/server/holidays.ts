import Holidays from "date-holidays";
import { isIsoDate, zonedDateTimeToUtc } from "@/src/lib/dates";
import { normalizeHolidayState } from "@/src/server/settings";

export type HolidayCheckResult = {
  isHoliday: boolean;
  name?: string;
};

export function getHolidayProvider(country: string, state: string) {
  return new Holidays(country.toUpperCase(), normalizeHolidayState(country, state));
}

export function isPublicHoliday(
  date: string,
  country: string,
  state: string,
  timeZone = "Europe/Berlin",
): HolidayCheckResult {
  if (!isIsoDate(date)) {
    return { isHoliday: false };
  }

  const provider = getHolidayProvider(country, state);
  provider.setTimezone(timeZone);
  const holidays = provider.isHoliday(zonedDateTimeToUtc(date, "12:00", timeZone));
  const holidayList = holidays ? (Array.isArray(holidays) ? holidays : [holidays]) : [];
  const publicHoliday = holidayList.find((holiday) => holiday.type === "public");

  return {
    isHoliday: Boolean(publicHoliday),
    name: publicHoliday?.name,
  };
}
