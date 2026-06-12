import {
  checkReservationAvailability,
  type AvailabilityCheckResult,
  type ReservationAvailabilityInput,
} from "@/src/server/reservation-availability";

export type ReservationRuleInput = ReservationAvailabilityInput;

export type ReservationRuleResult = AvailabilityCheckResult & {
  allowed: boolean;
};

export async function validateReservationRules(
  input: ReservationRuleInput,
): Promise<ReservationRuleResult> {
  const result = await checkReservationAvailability(input);

  return {
    ...result,
    allowed: !result.hardBlocked,
  };
}
