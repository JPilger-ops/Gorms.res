import Holidays from "date-holidays";
import { parseLocalDate } from "@/src/lib/dates";
import { normalizeHolidayState } from "@/src/server/settings";

export type HolidayCheckResult = {
  isHoliday: boolean;
  name?: string;
};

export function getHolidayProvider(country: string, state: string) {
  return new Holidays(country.toUpperCase(), normalizeHolidayState(country, state));
}

export function isPublicHoliday(date: string, country: string, state: string): HolidayCheckResult {
  const localDate = parseLocalDate(date);

  if (!localDate) {
    return { isHoliday: false };
  }

  const holidays = getHolidayProvider(country, state).isHoliday(localDate);
  const holidayList = holidays ? (Array.isArray(holidays) ? holidays : [holidays]) : [];
  const publicHoliday = holidayList.find((holiday) => holiday.type === "public");

  return {
    isHoliday: Boolean(publicHoliday),
    name: publicHoliday?.name,
  };
}
