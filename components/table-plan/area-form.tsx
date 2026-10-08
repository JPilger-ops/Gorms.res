"use client";

import { useActionState } from "react";
import { saveAreaAction, type AreaActionState } from "@/app/admin/table-plan/actions";
import { VenueField } from "@/components/admin/venue-context";
import type { PlanArea } from "@/src/lib/table-plan-types";

export function AreaForm({ area }: { area?: PlanArea }) {
  const [state, action, pending] = useActionState(saveAreaAction, {} as AreaActionState);
  return (
    <form action={action} className="grid gap-3">
      <VenueField />
      {area ? (
        <>
          <input type="hidden" name="id" value={area.id} />
          <input type="hidden" name="baseRevision" value={area.revision} />
        </>
      ) : null}
      <label className="grid gap-1 text-sm font-semibold">
        Name
        <input
          className="glass-control min-h-12 px-3"
          name="name"
          maxLength={80}
          required
          defaultValue={area?.name}
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold">
        Reihenfolge
        <input
          className="glass-control min-h-12 px-3"
          name="sortOrder"
          type="number"
          min={0}
          max={10000}
          defaultValue={area?.sortOrder ?? 0}
          required
        />
      </label>
      <div className="flex flex-wrap gap-3 text-sm">
        <label>
          <input type="checkbox" name="isActive" defaultChecked={area?.isActive ?? true} /> Aktiv
        </label>
        <label>
          <input
            type="checkbox"
            name="isOnlineBookable"
            defaultChecked={area?.isOnlineBookable ?? false}
          />{" "}
          Online verwendbar
        </label>
        {area ? (
          <label>
            <input type="checkbox" name="archived" defaultChecked={area.archived} /> Archiviert
          </label>
        ) : null}
      </div>
      {state.message ? (
        <p
          role={state.success ? "status" : "alert"}
          className={state.success ? "text-success text-sm" : "field-error"}
        >
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        className="secondary-action justify-self-start"
        aria-busy={pending}
        disabled={pending}
      >
        {area ? "Bereich speichern" : "Bereich hinzufügen"}
      </button>
    </form>
  );
}
