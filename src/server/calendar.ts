import { createEvent } from "ics";
import { zonedDateTimeToUtc } from "@/src/lib/dates";
import type { VenueContext } from "@/src/server/venues";

export type CalendarReservationData = {
  adminUrl?: string;
  email: string;
  guestCount: number;
  guestName: string;
  id: string;
  message?: string | null;
  phone: string;
  date: string;
  time: string;
};

export type AcceptedCalendarReservationData = CalendarReservationData & {
  acceptedByName?: string;
};

function parseDateTime(
  date: string,
  time: string,
  timeZone: string,
): [number, number, number, number, number] {
  const instant = zonedDateTimeToUtc(date, time.slice(0, 5), timeZone);
  return [
    instant.getUTCFullYear(),
    instant.getUTCMonth() + 1,
    instant.getUTCDate(),
    instant.getUTCHours(),
    instant.getUTCMinutes(),
  ];
}

function formatRequestCalendarDescription(input: CalendarReservationData) {
  return [
    "Reservierungsanfrage - noch nicht bestätigt",
    "",
    `Name: ${input.guestName}`,
    `Personen: ${input.guestCount}`,
    `E-Mail: ${input.email}`,
    `Telefon: ${input.phone}`,
    input.message ? `Nachricht: ${input.message}` : "Nachricht: -",
    "",
    "Status: Anfrage / nicht bestätigt",
    `Anfrage-ID: ${input.id}`,
    input.adminUrl ? `Admin-Link: ${input.adminUrl}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatAcceptedCalendarDescription(input: AcceptedCalendarReservationData) {
  return [
    "Bestätigte Reservierung",
    "",
    `Name: ${input.guestName}`,
    `Personen: ${input.guestCount}`,
    `E-Mail: ${input.email}`,
    `Telefon: ${input.phone}`,
    input.message ? `Nachricht: ${input.message}` : "Nachricht: -",
    input.acceptedByName ? `Bestätigt durch: ${input.acceptedByName}` : undefined,
    "",
    "Status: bestätigt",
    `Anfrage-ID: ${input.id}`,
    input.adminUrl ? `Admin-Link: ${input.adminUrl}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

export function createReservationRequestIcs(venue: VenueContext, input: CalendarReservationData) {
  const event = createEvent({
    calName: `${venue.name} Reservierungsanfragen`,
    description: formatRequestCalendarDescription(input),
    duration: { hours: 2 },
    productId: "gorms/heidekoenig-reservations",
    start: parseDateTime(input.date, input.time, venue.timeZone),
    startInputType: "utc",
    startOutputType: "utc",
    status: "TENTATIVE",
    title: `Reservierungsanfrage: ${input.guestName}, ${input.guestCount} Personen`,
    uid: `${input.id}@heidekoenig-reservations`,
  });

  if (event.error || !event.value) {
    throw new Error("ICS generation failed.");
  }

  return event.value;
}

export function createAcceptedReservationInternalIcs(
  venue: VenueContext,
  input: AcceptedCalendarReservationData,
) {
  const event = createEvent({
    calName: `${venue.name} Reservierungen`,
    description: formatAcceptedCalendarDescription(input),
    duration: { hours: 2 },
    productId: "gorms/heidekoenig-reservations",
    start: parseDateTime(input.date, input.time, venue.timeZone),
    startInputType: "utc",
    startOutputType: "utc",
    status: "CONFIRMED",
    title: `Bestätigte Reservierung: ${input.guestName}, ${input.guestCount} Personen`,
    uid: `${input.id}-accepted@heidekoenig-reservations`,
  });

  if (event.error || !event.value) {
    throw new Error("ICS generation failed.");
  }

  return event.value;
}
