"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";
import type { TablePlan } from "@/src/lib/table-plan-types";
import { adminUrl } from "@/src/lib/admin-urls";
import { PlanView } from "./plan-view";

const Editor = dynamic(() => import("./editor").then((m) => m.TablePlanEditor), {
  ssr: false,
  loading: () => (
    <p role="status" className="py-8 text-muted">
      Editor wird geladen …
    </p>
  ),
});
export function TablePlanWorkspace({ initialPlan }: { initialPlan: TablePlan }) {
  const [plan, setPlan] = useState(initialPlan);
  const [editing, setEditing] = useState(false);
  const live = plan.tables.filter((t) => !t.archived);
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            className="text-sm underline underline-offset-4"
            href={adminUrl("/admin/table-plan", plan.venueId)}
          >
            Bereiche
          </Link>
          <h2 className="mt-2 text-3xl font-semibold">{plan.area.name}</h2>
          <p className="mt-1 text-sm text-muted">
            {live.length} Tische · {plan.combinations.filter((c) => !c.archived).length}{" "}
            Kombinationen{plan.area.archived ? " · Archiviert" : ""}
          </p>
        </div>
        {!editing ? (
          <button type="button" className="primary-action" onClick={() => setEditing(true)}>
            Bearbeiten
          </button>
        ) : null}
      </header>
      {editing ? (
        <Editor
          initialPlan={plan}
          onClose={(next) => {
            setPlan(next);
            setEditing(false);
          }}
          onSaved={setPlan}
        />
      ) : (
        <>
          <PlanView plan={plan} />
          {!live.length ? (
            <p className="text-sm text-muted">Noch keine Tische angelegt.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {live.map((t) => (
                <li
                  className="flex flex-wrap justify-between gap-2 border-b border-border py-3 text-sm"
                  key={t.id}
                >
                  <span className="font-semibold">{t.name}</span>
                  <span>
                    {t.minGuests}–{t.maxGuests} Personen
                    {t.isWheelchairAccessible ? " · Rollstuhlgeeignet" : ""}
                    {!t.isActive ? " · Inaktiv" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
