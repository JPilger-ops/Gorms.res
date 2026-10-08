import {
  checkReservationAvailability,
  type AvailabilityCheckResult,
  type ReservationAvailabilityInput,
} from "@/src/server/reservation-availability";
import type { VenueContext } from "@/src/server/venues";

export type ReservationRuleInput = ReservationAvailabilityInput;

export type ReservationRuleResult = AvailabilityCheckResult & {
  allowed: boolean;
};

export async function validateReservationRules(
  venue: VenueContext,
  input: ReservationRuleInput,
): Promise<ReservationRuleResult> {
  const result = await checkReservationAvailability(venue, input);

  return {
    ...result,
    allowed: !result.hardBlocked,
  };
}
