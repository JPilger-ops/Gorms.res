import { createEvent } from "ics";

export type CalendarReservationData = {
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

function parseDateTime(date: string, time: string): [number, number, number, number, number] {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return [year, month, day, hour, minute];
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
  ].join("\n");
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
  ]
    .filter(Boolean)
    .join("\n");
}

export function createReservationRequestIcs(input: CalendarReservationData) {
  const event = createEvent({
    calName: "Waldwirtschaft Heidekönig Reservierungsanfragen",
    description: formatRequestCalendarDescription(input),
    duration: { hours: 2 },
    productId: "gorms/heidekoenig-reservations",
    start: parseDateTime(input.date, input.time),
    startInputType: "local",
    status: "TENTATIVE",
    title: `Reservierungsanfrage: ${input.guestName}, ${input.guestCount} Personen`,
    uid: `${input.id}@heidekoenig-reservations`,
  });

  if (event.error || !event.value) {
    throw new Error("ICS generation failed.");
  }

  return event.value;
}

export function createAcceptedReservationInternalIcs(input: AcceptedCalendarReservationData) {
  const event = createEvent({
    calName: "Waldwirtschaft Heidekönig Reservierungen",
    description: formatAcceptedCalendarDescription(input),
    duration: { hours: 2 },
    productId: "gorms/heidekoenig-reservations",
    start: parseDateTime(input.date, input.time),
    startInputType: "local",
    status: "CONFIRMED",
    title: `Bestätigte Reservierung: ${input.guestName}, ${input.guestCount} Personen`,
    uid: `${input.id}-accepted@heidekoenig-reservations`,
  });

  if (event.error || !event.value) {
    throw new Error("ICS generation failed.");
  }

  return event.value;
}
