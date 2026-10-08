const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
const databaseTimePattern = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(\.\d{1,6})?)?$/;

export function isIsoDate(value: string) {
  if (!datePattern.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isTime(value: string) {
  return timePattern.test(value);
}

export function parseLocalDate(value: string) {
  if (!isIsoDate(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function todayInTimeZone(timeZone = "Europe/Berlin", now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addCalendarDays(value: string, days: number) {
  const date = parseLocalDate(value);
  if (!date) throw new Error("Invalid calendar date.");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isPastDate(value: string, today = new Date(), timeZone = "Europe/Berlin") {
  return !isIsoDate(value) || value < todayInTimeZone(timeZone, today);
}

export function isSunday(value: string) {
  return parseLocalDate(value)?.getUTCDay() === 0;
}

export function zonedDateTimeToUtc(date: string, time: string, timeZone: string) {
  if (!isIsoDate(date) || !isTime(time)) throw new Error("Invalid calendar date/time.");
  const wallTime = new Date(`${date}T${time}:00.000Z`).getTime();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const asWallTime = (instant: number) => {
    const parts = formatter.formatToParts(new Date(instant));
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    return Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second"),
    );
  };
  // Check both sides of a DST transition; never silently choose an ambiguous local time.
  const candidates = new Set<number>();
  for (const offsetHours of [-24, 0, 24]) {
    const probe = wallTime + offsetHours * 60 * 60 * 1000;
    const candidate = wallTime - (asWallTime(probe) - probe);
    if (asWallTime(candidate) === wallTime) candidates.add(candidate);
  }
  if (candidates.size !== 1) throw new Error("Ambiguous or nonexistent venue-local time.");
  return new Date([...candidates][0]);
}

export function timeToMinutes(value: string) {
  const match = databaseTimePattern.exec(value);
  if (!match || match[0] !== value) {
    return null;
  }

  const [, hours, minutes, seconds = "0", fraction = ""] = match;
  return Number(hours) * 60 + Number(minutes) + Number(seconds + fraction) / 60;
}

export function isTimeInRange(value: string, earliest: string, latest: string) {
  const requested = timeToMinutes(value);
  const earliestMinutes = timeToMinutes(earliest);
  const latestMinutes = timeToMinutes(latest);

  if (requested === null || earliestMinutes === null || latestMinutes === null) {
    return false;
  }

  return requested >= earliestMinutes && requested <= latestMinutes;
}
