import { createEvent } from "ics";
import type { ReservationEmailData } from "@/src/server/email";

function parseDateTime(date: string, time: string): [number, number, number, number, number] {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return [year, month, day, hour, minute];
}

function formatCalendarDescription(input: ReservationEmailData) {
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

export function createReservationRequestIcs(input: ReservationEmailData) {
  const event = createEvent({
    calName: "Waldwirtschaft Heidekönig Reservierungsanfragen",
    description: formatCalendarDescription(input),
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
