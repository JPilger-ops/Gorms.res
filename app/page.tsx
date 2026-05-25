import { PublicReservationPage } from "@/components/reservation/public-reservation-page";
import { SetupMaintenancePage } from "@/components/reservation/setup-maintenance-page";
import { requirePublicHost } from "@/src/server/guards";
import { getSetupStatus } from "@/src/server/setup";

export const dynamic = "force-dynamic";

export default async function Home() {
  await requirePublicHost();

  const setupStatus = await getSetupStatus();

  if (!setupStatus.setupCompleted) {
    return <SetupMaintenancePage />;
  }

  return <PublicReservationPage />;
}
