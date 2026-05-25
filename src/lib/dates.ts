const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isIsoDate(value: string) {
  if (!datePattern.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return date.toISOString().slice(0, 10) === value;
}

export function isTime(value: string) {
  return timePattern.test(value);
}

export function parseLocalDate(value: string) {
  if (!isIsoDate(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function isPastDate(value: string, today = new Date()) {
  const date = parseLocalDate(value);

  if (!date) {
    return true;
  }

  const currentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return date < currentDate;
}

export function isSunday(value: string) {
  return parseLocalDate(value)?.getDay() === 0;
}

export function timeToMinutes(value: string) {
  if (!isTime(value)) {
    return null;
  }

  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
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
