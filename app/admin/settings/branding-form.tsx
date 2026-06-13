"use client";

import { useActionState, useState } from "react";
import {
  removeFaviconAction,
  removeLogoAction,
  type SettingsActionState,
  updateBrandingSettingsAction,
  uploadFaviconAction,
  uploadLogoAction,
} from "@/app/admin/settings/actions";
import { FieldError, FormFeedback } from "@/components/ui/form-feedback";
import type { BrandingSettings } from "@/src/server/branding";

const initialState: SettingsActionState = {};

function UploadForm({
  accept,
  action,
  currentUrl,
  label,
  name,
  removeAction,
}: {
  accept: string;
  action: (previousState: SettingsActionState, formData: FormData) => Promise<SettingsActionState>;
  currentUrl?: string;
  label: string;
  name: "favicon" | "logo";
  removeAction: () => Promise<void>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <div className="admin-list-card min-w-0 space-y-4 p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-lg font-semibold">{label}</h4>
          <p className="mt-1 text-sm leading-6 text-muted">Maximal 2 MB. SVG ist nicht erlaubt.</p>
        </div>

        {currentUrl ? (
          <div className="flex h-20 w-28 items-center justify-center rounded-2xl border border-border bg-surface/80 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="" className="max-h-full max-w-full object-contain" src={currentUrl} />
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-surface/65 px-4 py-3 text-sm text-muted">
            Nicht gesetzt
          </div>
        )}
      </div>

      <FormFeedback state={state} />

      <form action={formAction} className="space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-semibold">{label}-Datei auswählen</span>
          <input
            accept={accept}
            className="glass-control w-full max-w-full px-4 py-3 text-sm outline-none"
            name={name}
            required
            type="file"
          />
        </label>

        <button
          className="primary-action w-full"
          disabled={pending}
          aria-busy={pending}
          type="submit"
        >
          {pending ? "Wird hochgeladen..." : `${label} hochladen`}
        </button>
      </form>

      {currentUrl ? (
        <form action={removeAction}>
          <button className="secondary-action w-full" type="submit">
            {label} entfernen
          </button>
        </form>
      ) : null}
    </div>
  );
}

export function BrandingForm({ branding }: { branding: BrandingSettings }) {
  const [state, formAction, pending] = useActionState(updateBrandingSettingsAction, initialState);
  const [accentColor, setAccentColor] = useState(branding.accentColor);

  return (
    <section className="glass-panel admin-panel space-y-5 p-4 sm:p-6">
      <div className="admin-settings-intro">
        <p className="eyebrow">Branding</p>
        <h3 className="mt-2 text-2xl font-semibold">Logo, Favicon und Akzentfarbe</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Dateien werden lokal im Upload-Volume gespeichert. Dateinamen werden serverseitig erzeugt;
          hochgeladene Originalnamen werden nicht übernommen.
        </p>
      </div>

      <form action={formAction} className="admin-settings-section">
        <div className="admin-settings-section-header">
          <h4 className="text-lg font-semibold">Akzentfarbe</h4>
          <p className="mt-2 text-sm leading-6 text-muted">
            Die Farbe steuert primäre Buttons, aktive Navigation und feine Highlights.
          </p>
        </div>

        <div className="admin-settings-section-body">
          <FormFeedback state={state} />

          <label className="block space-y-2">
            <span className="text-sm font-semibold">Akzentfarbe</span>
            <div className="grid min-w-0 gap-3 sm:grid-cols-[88px_minmax(0,1fr)]">
              <input
                className="glass-control h-12 w-full p-1 outline-none"
                onChange={(event) => setAccentColor(event.target.value)}
                type="color"
                value={accentColor}
              />
              <input
                className="glass-control min-h-12 w-full px-4 outline-none"
                name="accentColor"
                onChange={(event) => setAccentColor(event.target.value)}
                pattern="#[0-9a-fA-F]{6}"
                required
                type="text"
                value={accentColor}
              />
            </div>
            <FieldError messages={state.fieldErrors?.accentColor} />
          </label>

          <button
            className="secondary-action w-full sm:ml-auto sm:block sm:w-auto"
            disabled={pending}
            aria-busy={pending}
            type="submit"
          >
            {pending ? "Wird gespeichert..." : "Akzentfarbe speichern"}
          </button>
        </div>
      </form>

      <div className="grid gap-5 xl:grid-cols-2">
        <UploadForm
          accept="image/png,image/jpeg,image/webp"
          action={uploadLogoAction}
          currentUrl={branding.logoUrl}
          label="Logo"
          name="logo"
          removeAction={removeLogoAction}
        />

        <UploadForm
          accept="image/png,image/jpeg,image/webp,image/x-icon"
          action={uploadFaviconAction}
          currentUrl={branding.faviconUrl}
          label="Favicon"
          name="favicon"
          removeAction={removeFaviconAction}
        />
      </div>
    </section>
  );
}
