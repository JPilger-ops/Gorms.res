import assert from "node:assert/strict";
import {
  addCalendarDays,
  isIsoDate,
  isPastDate,
  isSunday,
  isTime,
  isTimeInRange,
  timeToMinutes,
  todayInTimeZone,
  zonedDateTimeToUtc,
} from "@/src/lib/dates";
import { normalizeHost, originHost } from "@/src/lib/hostnames.mjs";
import { HEIDEKOENIG_VENUE_ID, reservationRetentionDays } from "@/src/lib/venue-defaults.mjs";
import {
  createAcceptedReservationInternalIcs,
  createReservationRequestIcs,
} from "@/src/server/calendar";
import { isPublicHoliday } from "@/src/server/holidays";
import { assertCapacityStrategy, type VenueContext } from "@/src/server/venues";

const venue: VenueContext = {
  id: HEIDEKOENIG_VENUE_ID,
  slug: "heidekoenig",
  name: "Waldwirtschaft Heidekönig",
  shortName: "Heidekönig",
  timeZone: "Europe/Berlin",
  availabilityStrategy: "CAPACITY",
  isActive: true,
};

for (const [value, expected] of [
  ["00:00", 0],
  ["14:00", 840],
  ["14:00:00", 840],
  ["14:00:30", 840.5],
  ["14:00:01", 840 + 1 / 60],
  ["14:00:00.000001", 840 + 0.000001 / 60],
  ["23:59:59.999999", 23 * 60 + 59 + 59.999999 / 60],
] as const) {
  assert.equal(timeToMinutes(value), expected, `PostgreSQL time parsing: ${value}`);
}
for (const value of [
  "",
  "14",
  "1:00",
  "14:0",
  "24:00",
  "14:60",
  "14:00:60",
  "14:00:99",
  "14:00:-1",
  "14:00:00.",
  "14:00:00.1234567",
  "14:00:00Z",
  "14:00:00+02:00",
  " 14:00",
  "14:00\n",
]) {
  assert.equal(timeToMinutes(value), null, `Reject malformed time: ${JSON.stringify(value)}`);
}
assert.equal(isTime("14:00"), true);
assert.equal(isTime("14:00:00"), false, "Public/settings inputs remain HH:MM");
assert.equal(isTimeInRange("14:00", "11:30", "19:00"), true);
assert.equal(isTimeInRange("19:01", "11:30", "19:00"), false);
assert.equal(normalizeHost("Heidekönig.gorms.de:6043").ascii, "xn--heideknig-57a.gorms.de");
assert.equal(normalizeHost("xn--heideknig-57a.gorms.de").unicode, "heidekönig.gorms.de");
for (const invalid of [
  "",
  "evil/host",
  "host,evil",
  "https://login.gorms.de",
  "user@login.gorms.de",
]) {
  assert.equal(normalizeHost(invalid).ascii, "");
}
assert.equal(originHost("not an origin"), "");
assert.equal(originHost(null), null);
assert.equal(reservationRetentionDays(venue.id, "30", "90"), 30);
assert.equal(reservationRetentionDays(venue.id, "42", "90"), 42);
assert.equal(reservationRetentionDays(venue.id, undefined, "45"), 45);
assert.equal(reservationRetentionDays(venue.id, "invalid", "45"), 45);
assert.equal(reservationRetentionDays(venue.id, undefined, undefined), 30);
assert.equal(reservationRetentionDays("another-venue", undefined, "90"), 30);
assert.doesNotThrow(() => assertCapacityStrategy(venue));
assert.throws(() => assertCapacityStrategy({ ...venue, availabilityStrategy: "TABLES" }));
assert.throws(() => assertCapacityStrategy({ ...venue, isActive: false }));

const calendarData = {
  id: "fixture",
  date: "2026-06-19",
  time: "14:00",
  guestName: "Test",
  guestCount: 8,
  email: "test@example.invalid",
  phone: "012345678",
};
const originalTz = process.env.TZ;
for (const tz of ["UTC", "Europe/Berlin", "America/Los_Angeles", "Asia/Tokyo"]) {
  process.env.TZ = tz;
  assert.equal(timeToMinutes("14:00:30"), 840.5);
  assert.equal(isIsoDate("2026-02-30"), false);
  assert.equal(isIsoDate("2026-99-99"), false);
  assert.equal(isSunday("2026-06-14"), true);
  assert.equal(addCalendarDays("2026-03-28", 2), "2026-03-30");
  assert.equal(addCalendarDays("2026-10-24", 2), "2026-10-26");
  assert.equal(todayInTimeZone(venue.timeZone, new Date("2026-06-18T22:30:00Z")), "2026-06-19");
  assert.equal(isPastDate("2026-06-18", new Date("2026-06-18T22:30:00Z")), true);
  assert.equal(isPastDate("2026-06-19", new Date("2026-06-18T22:30:00Z")), false);
  assert.equal(
    zonedDateTimeToUtc("2026-06-19", "14:00", venue.timeZone).toISOString(),
    "2026-06-19T12:00:00.000Z",
  );
  assert.equal(
    zonedDateTimeToUtc("2026-01-19", "14:00", venue.timeZone).toISOString(),
    "2026-01-19T13:00:00.000Z",
  );
  assert.throws(() => zonedDateTimeToUtc("2026-03-29", "02:30", venue.timeZone));
  assert.throws(() => zonedDateTimeToUtc("2026-10-25", "02:30", venue.timeZone));
  assert.equal(isPublicHoliday("2026-06-04", "DE", "NRW").isHoliday, true);
  assert.equal(isPublicHoliday("2026-06-03", "DE", "NW").isHoliday, false);
  assert.equal(isPublicHoliday("2026-12-25", "DE", "NW").isHoliday, true);
  const request = createReservationRequestIcs(venue, calendarData);
  const accepted = createAcceptedReservationInternalIcs(venue, calendarData);
  assert.match(request, /DTSTART:20260619T120000Z/);
  assert.match(request, /UID:fixture@heidekoenig-reservations/);
  assert.match(request, /STATUS:TENTATIVE/);
  assert.match(accepted, /DTSTART:20260619T120000Z/);
  assert.match(accepted, /UID:fixture-accepted@heidekoenig-reservations/);
  assert.match(accepted, /STATUS:CONFIRMED/);
  assert.match(accepted, /DURATION:PT2H/);
}
if (originalTz === undefined) delete process.env.TZ;
else process.env.TZ = originalTz;
console.log(
  "Venue, hostname, retention, calendar and timezone checks passed (4 server timezones).",
);
