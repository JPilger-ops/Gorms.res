"use client";

import type { PlanResource } from "@/src/lib/table-plan-types";

export function ResourceFields({
  resource,
  onChange,
}: {
  resource: PlanResource;
  onChange: (patch: Partial<PlanResource>) => void;
}) {
  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-sm font-semibold">
        Name
        <input
          className="glass-control min-h-12 px-3"
          aria-label="Ressourcenname"
          maxLength={80}
          value={resource.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-sm font-semibold">
          Min. Personen
          <input
            className="glass-control min-h-12 min-w-0 px-3"
            type="number"
            min={1}
            max={1000}
            value={resource.minGuests}
            onChange={(e) => onChange({ minGuests: Number(e.target.value) })}
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Max. Personen
          <input
            className="glass-control min-h-12 min-w-0 px-3"
            type="number"
            min={1}
            max={1000}
            value={resource.maxGuests}
            onChange={(e) => onChange({ maxGuests: Number(e.target.value) })}
          />
        </label>
      </div>
      <label className="text-sm">
        <input
          type="checkbox"
          checked={resource.isActive}
          onChange={(e) => onChange({ isActive: e.target.checked })}
        />{" "}
        Aktiv
      </label>
      <label className="text-sm">
        <input
          type="checkbox"
          checked={resource.isOnlineBookable}
          onChange={(e) => onChange({ isOnlineBookable: e.target.checked })}
        />{" "}
        Online verwendbar
      </label>
      <label className="text-sm">
        <input
          type="checkbox"
          checked={resource.isWheelchairAccessible}
          onChange={(e) => onChange({ isWheelchairAccessible: e.target.checked })}
        />{" "}
        Rollstuhlgeeignet
      </label>
    </div>
  );
}
