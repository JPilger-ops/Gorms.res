import { AdminShell } from "@/components/admin/admin-shell";
import { BrandingForm } from "@/app/admin/settings/branding-form";
import { RetentionCleanupForm } from "@/app/admin/settings/retention-cleanup-form";
import { SettingsForm } from "@/app/admin/settings/settings-form";
import { SmtpSettingsForm } from "@/app/admin/settings/smtp-form";
import { requirePermission } from "@/src/server/guards";
import { getBrandingSettings } from "@/src/server/branding";
import { getAdminSettings, getSmtpSettingsForUi } from "@/src/server/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requirePermission("settings:manage");
  const [branding, settings, smtpSettings] = await Promise.all([
    getBrandingSettings(),
    getAdminSettings(),
    getSmtpSettingsForUi(),
  ]);

  return (
    <AdminShell session={session}>
      <div className="space-y-6">
        <div className="glass-panel p-5 sm:p-7">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="eyebrow">Einstellungen</p>
              <h2 className="mt-2 text-3xl font-semibold">Betrieb und Datenschutz</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-muted">
              Diese Seite enthält nicht-sensitive Einstellungen. SMTP-Zugangsdaten und Branding
              werden in eigenen Schritten getrennt verwaltet.
            </p>
          </div>
        </div>

        <SettingsForm settings={settings} />
        <RetentionCleanupForm />
        <SmtpSettingsForm currentUserEmail={session.email} settings={smtpSettings} />
        <BrandingForm branding={branding} />
      </div>
    </AdminShell>
  );
}
