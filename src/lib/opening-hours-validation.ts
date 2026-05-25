import { z } from "zod";
import { isTime, timeToMinutes } from "@/src/lib/dates";

export const openingHoursSchema = z
  .object({
    earliestReservationTime: z.string().refine(isTime, "Bitte eine gültige Startzeit eingeben."),
    latestReservationTime: z.string().refine(isTime, "Bitte eine gültige Endzeit eingeben."),
  })
  .refine(
    (value) => {
      const earliest = timeToMinutes(value.earliestReservationTime);
      const latest = timeToMinutes(value.latestReservationTime);

      return earliest !== null && latest !== null && earliest < latest;
    },
    {
      message: "Die Startzeit muss vor der Endzeit liegen.",
      path: ["latestReservationTime"],
    },
  );

export type OpeningHoursInput = z.infer<typeof openingHoursSchema>;
