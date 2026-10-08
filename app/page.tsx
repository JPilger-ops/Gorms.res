import { PublicReservationPage } from "@/components/reservation/public-reservation-page";
import { SetupMaintenancePage } from "@/components/reservation/setup-maintenance-page";
import { requirePublicHost } from "@/src/server/guards";
import { getSetupStatus } from "@/src/server/setup";

import { getAdminSettings } from "@/src/server/settings";

export async function generateMetadata() {
  const venue = await requirePublicHost();
  const settings = await getAdminSettings(venue);
  return {
    title: { absolute: settings.appName },
    description: `Reservierungsanfragen für ${settings.appName}.`,
    applicationName: `${settings.appName} Reservierungen`,
  };
}

export const dynamic = "force-dynamic";

export default async function Home() {
  const venue = await requirePublicHost();

  const setupStatus = await getSetupStatus();

  if (!setupStatus.setupCompleted) {
    return <SetupMaintenancePage />;
  }

  return <PublicReservationPage venue={venue} />;
}
