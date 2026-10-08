"use client";

import { useEffect, useRef, useState } from "react";
import { PlanCanvas } from "./canvas";
import { PlanView, floorplanUrl } from "./plan-view";
import { ResourceFields } from "./resource-fields";
import { adminUrl } from "@/src/lib/admin-urls";
import {
  clampPosition,
  geometryFits,
  normalizeRotation,
  transferPlanAspect,
} from "@/src/lib/table-plan-geometry";
import {
  startHistory,
  commitHistory,
  undoHistory,
  redoHistory,
  type DraftHistory,
} from "@/src/lib/table-plan-history";
import { tablePlanSaveSchema } from "@/src/lib/table-plan-validation";
import type { PlanResource, PlanTable, TableGeometry, TablePlan } from "@/src/lib/table-plan-types";

type Draft = {
  plan: TablePlan;
  file: File | null;
  preview: string | null;
  action: "keep" | "replace" | "remove";
  acknowledged: boolean;
};
const initialDraft = (plan: TablePlan): Draft => ({
  plan,
  file: null,
  preview: null,
  action: "keep",
  acknowledged: false,
});
function boundHistory(history: DraftHistory<Draft>) {
  let past = history.past;
  while (past.length) {
    const files = new Set(
      [history.present, ...past, ...history.future]
        .map((d) => d.file)
        .filter((f): f is File => f !== null),
    );
    if (Array.from(files).reduce((sum, f) => sum + f.size, 0) <= 24 * 1024 * 1024) break;
    past = past.slice(1);
  }
  return { ...history, past };
}

function freshName(prefix: string, resources: PlanResource[]) {
  let n = 1;
  while (
    resources.some(
      (t) => !t.archived && t.name.toLocaleLowerCase("de-DE") === `${prefix}${n}`.toLowerCase(),
    )
  )
    n++;
  return `${prefix}${n}`;
}

export function TablePlanEditor({
  initialPlan,
  onSaved,
  onClose,
}: {
  initialPlan: TablePlan;
  onSaved: (plan: TablePlan) => void;
  onClose: (plan: TablePlan) => void;
}) {
  const [baseline, setBaseline] = useState(initialPlan);
  const [history, setHistory] = useState(() => startHistory(initialDraft(initialPlan)));
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"tables" | "combinations" | "background">("tables");
  const [showArchived, setShowArchived] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [candidate, setCandidate] = useState<Draft | null>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const mounted = useRef(true);
  const draft = history.present;
  const plan = draft.plan;
  const dirty = draft.action !== "keep" || JSON.stringify(plan) !== JSON.stringify(baseline);
  const table = plan.tables.find((t) => t.id === selected);
  const combination = plan.combinations.find((c) => c.id === selected);
  const imageUrl = draft.preview ?? floorplanUrl(plan);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (candidate) dialog.current?.showModal();
    else dialog.current?.close();
  }, [candidate]);
  useEffect(() => {
    if (message) feedback.current?.scrollIntoView({ behavior: "auto", block: "nearest" });
  }, [message]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const links = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
      if (
        link &&
        link.origin === location.origin &&
        !link.download &&
        link.href !== location.href &&
        !window.confirm("Ungespeicherte Änderungen verwerfen?")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const forms = (e: SubmitEvent) => {
      if (
        (e.target as HTMLFormElement).querySelector('select[name="venueId"]') &&
        !window.confirm("Ungespeicherte Änderungen verwerfen?")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", links, true);
    document.addEventListener("submit", forms, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", links, true);
      document.removeEventListener("submit", forms, true);
    };
  }, [dirty]);

  const notify = (text: string, ok = false) => setMessage({ text, ok });
  const commit = (next: Draft) => {
    setHistory((h) => boundHistory(commitHistory(h, next)));
    setMessage(null);
  };
  const changePlan = (next: TablePlan) => commit({ ...draft, plan: next });
  const changeTable = (id: string, patch: Partial<PlanTable>) =>
    changePlan({ ...plan, tables: plan.tables.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  const changeGeometry = (id: string, geometry: TableGeometry) => {
    if (!geometryFits(geometry, plan.background.aspectRatio)) {
      notify("Diese Größe oder Drehung passt nicht in die Planfläche.");
      return;
    }
    changeTable(id, { layout: geometry });
  };

  function addTable() {
    const ratio = plan.background.aspectRatio;
    const width = Math.min(0.16, 0.16 / ratio);
    const next: PlanTable = {
      id: crypto.randomUUID(),
      name: freshName("T", plan.tables),
      minGuests: 1,
      maxGuests: 2,
      isActive: true,
      isOnlineBookable: false,
      isWheelchairAccessible: false,
      archived: false,
      layout: {
        shape: "square",
        x: 0.5,
        y: 0.5,
        width,
        height: width * ratio,
        rotation: 0,
        zOrder: Math.min(10000, plan.tables.length),
      },
    };
    changePlan({ ...plan, tables: [...plan.tables, next] });
    setSelected(next.id);
    setTab("tables");
  }

  function addCombination() {
    const members = plan.tables.filter((t) => !t.archived).slice(0, 2);
    if (members.length < 2) return;
    const next = {
      id: crypto.randomUUID(),
      name: freshName("K", plan.combinations),
      minGuests: 1,
      maxGuests: members.reduce((sum, t) => sum + t.maxGuests, 0),
      isActive: true,
      isOnlineBookable: false,
      isWheelchairAccessible: false,
      archived: false,
      memberIds: members.map((t) => t.id),
    };
    changePlan({ ...plan, combinations: [...plan.combinations, next] });
    setSelected(next.id);
  }

  async function chooseFloorplan(file?: File) {
    if (!file) return;
    if (!file.size || file.size > 8 * 1024 * 1024) {
      notify("Bitte ein Bild mit höchstens 8 MiB wählen.");
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      notify("Bitte PNG, JPEG oder WebP wählen.");
      return;
    }
    setBusy(true);
    try {
      const preview = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = reject;
        image.src = preview;
      });
      if (!mounted.current) return;
      if (
        Math.min(size.width, size.height) < 64 ||
        Math.max(size.width, size.height) > 8192 ||
        size.width * size.height > 16777216
      ) {
        notify("Das Bild muss 64 bis 8192 Pixel je Seite und höchstens 16 Megapixel haben.");
        return;
      }
      const ratio = size.width / size.height;
      const changed = Math.abs(ratio - plan.background.aspectRatio) > 1e-8;
      const next: Draft = {
        plan: {
          ...transferPlanAspect(plan, ratio),
          background: { ...transferPlanAspect(plan, ratio).background, asset: null },
        },
        file,
        preview,
        action: "replace",
        acknowledged: changed,
      };
      if (changed && plan.tables.length) setCandidate(next);
      else commit(next);
    } catch {
      if (mounted.current) notify("Das Bild konnte nicht gelesen werden.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  async function save() {
    const payload = {
      venueId: plan.venueId,
      baseRevision: baseline.area.revision,
      aspectChangeAcknowledged: draft.acknowledged,
      floorplanAction: draft.action,
      plan,
    };
    const parsed = tablePlanSaveSchema.safeParse(payload);
    if (!parsed.success) {
      notify(parsed.error.issues[0]?.message ?? "Bitte Plandaten prüfen.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.set("payload", JSON.stringify(payload));
      if (draft.file) form.set("floorplan", draft.file);
      const response = await fetch(
        adminUrl(`/admin/table-plan/${plan.area.id}/save`, plan.venueId),
        { method: "POST", body: form },
      );
      const data = await response.json();
      if (!response.ok) {
        notify(data.message ?? "Der Plan konnte nicht gespeichert werden.");
        return;
      }
      setBaseline(data.plan);
      setHistory(startHistory(initialDraft(data.plan)));
      onSaved(data.plan);
      notify("Tischplan gespeichert.", true);
    } catch {
      notify("Der Plan konnte nicht gespeichert werden. Ihr Entwurf bleibt erhalten.");
    } finally {
      setBusy(false);
    }
  }

  async function discard(close: boolean) {
    if (dirty && !window.confirm("Ungespeicherte Änderungen verwerfen?")) return;
    setBusy(true);
    try {
      const response = await fetch(
        adminUrl(`/admin/table-plan/${plan.area.id}/data`, plan.venueId),
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok) {
        notify(data.message ?? "Der aktuelle Plan konnte nicht geladen werden.");
        return;
      }
      setBaseline(data.plan);
      setHistory(startHistory(initialDraft(data.plan)));
      setSelected(null);
      onSaved(data.plan);
      if (close) onClose(data.plan);
      else notify("Gespeicherten Plan geladen.", true);
    } catch {
      notify("Der aktuelle Plan konnte nicht geladen werden. Ihr Entwurf bleibt erhalten.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="table-plan-editor" data-dirty={dirty}>
      <div className="table-plan-toolbar" aria-label="Tischplan-Werkzeuge">
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="secondary-action table-plan-icon"
            type="button"
            title="Rückgängig"
            aria-label="Rückgängig"
            disabled={!history.past.length || busy}
            onClick={() => {
              setHistory(undoHistory(history));
              setMessage(null);
            }}
          >
            ↶
          </button>
          <button
            className="secondary-action table-plan-icon"
            type="button"
            title="Wiederholen"
            aria-label="Wiederholen"
            disabled={!history.future.length || busy}
            onClick={() => {
              setHistory(redoHistory(history));
              setMessage(null);
            }}
          >
            ↷
          </button>
          <button
            className="secondary-action"
            type="button"
            disabled={busy || plan.tables.length >= 200}
            onClick={addTable}
          >
            + Tisch
          </button>
          <span role="status" className={`text-sm ${dirty ? "text-warning" : "text-muted"}`}>
            {dirty ? "Ungespeicherte Änderungen" : "Gespeichert"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="secondary-action"
            type="button"
            disabled={busy}
            onClick={() => discard(!dirty)}
          >
            {dirty ? "Verwerfen" : "Schließen"}
          </button>
          <button
            className="primary-action"
            type="button"
            disabled={busy || !dirty}
            aria-busy={busy}
            onClick={save}
          >
            Speichern
          </button>
        </div>
      </div>
      {message ? (
        <div
          ref={feedback}
          role={message.ok ? "status" : "alert"}
          className={`form-feedback ${message.ok ? "form-feedback-success" : "form-feedback-error"}`}
        >
          {message.text}
        </div>
      ) : null}
      <div className="table-plan-editor-grid">
        <div className="min-w-0">
          <PlanCanvas
            plan={plan}
            imageUrl={imageUrl}
            selectedId={table?.archived ? null : (table?.id ?? null)}
            onSelect={(id) => {
              setSelected(id);
              setTab("tables");
            }}
            onGeometry={changeGeometry}
            onError={notify}
            disabled={busy}
          />
        </div>
        <fieldset disabled={busy} className="table-plan-inspector">
          <legend className="sr-only">Planeigenschaften</legend>
          <div className="table-plan-tabs" role="tablist" aria-label="Planeigenschaften">
            {(
              [
                ["tables", "Tische"],
                ["combinations", "Kombinationen"],
                ["background", "Grundriss"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                id={`plan-tab-${value}`}
                aria-controls={`plan-panel-${value}`}
                aria-selected={tab === value}
                className="admin-filter-chip"
                data-active={tab === value}
                onClick={() => {
                  setTab(value);
                  setSelected(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id={`plan-panel-${tab}`}
            aria-labelledby={`plan-tab-${tab}`}
            className="mt-4 grid gap-4"
          >
            {tab !== "background" ? (
              <label className="text-sm">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                />{" "}
                Archivierte anzeigen
              </label>
            ) : null}
            {tab === "tables" ? (
              <>
                <div className="table-plan-resource-list">
                  {plan.tables
                    .filter((t) => showArchived || !t.archived)
                    .map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className="glass-nav-link flex min-h-11 items-center justify-between gap-2 px-3 py-2 text-sm"
                        data-active={selected === t.id}
                        onClick={() => setSelected(t.id)}
                      >
                        <span className="break-words font-semibold">{t.name}</span>
                        <span className="text-xs text-muted">
                          {t.archived
                            ? "Archiviert"
                            : !t.isActive
                              ? "Inaktiv"
                              : `${t.minGuests}–${t.maxGuests}`}
                        </span>
                      </button>
                    ))}
                </div>
                {table ? (
                  <>
                    <ResourceFields
                      resource={table}
                      onChange={(patch) => changeTable(table.id, patch)}
                    />
                    <label className="grid gap-1 text-sm font-semibold">
                      Form
                      <select
                        className="glass-control min-h-12 px-3"
                        value={table.layout.shape}
                        onChange={(e) => {
                          const shape = e.target.value as TableGeometry["shape"];
                          const g = {
                            ...table.layout,
                            shape,
                            height:
                              shape === "rectangle"
                                ? table.layout.height
                                : table.layout.width * plan.background.aspectRatio,
                          };
                          changeGeometry(table.id, g);
                        }}
                      >
                        <option value="round">Rund</option>
                        <option value="square">Quadratisch</option>
                        <option value="rectangle">Rechteckig</option>
                      </select>
                    </label>
                    <label className="grid gap-2 text-sm font-semibold">
                      Breite
                      <input
                        aria-label="Tischbreite"
                        type="range"
                        min={0.01}
                        max={0.6}
                        step={0.005}
                        value={table.layout.width}
                        onChange={(e) =>
                          changeGeometry(table.id, {
                            ...table.layout,
                            width: Number(e.target.value),
                            height:
                              table.layout.shape === "rectangle"
                                ? table.layout.height
                                : Number(e.target.value) * plan.background.aspectRatio,
                          })
                        }
                      />
                    </label>
                    {table.layout.shape === "rectangle" ? (
                      <label className="grid gap-2 text-sm font-semibold">
                        Höhe
                        <input
                          aria-label="Tischhöhe"
                          type="range"
                          min={0.01}
                          max={0.6}
                          step={0.005}
                          value={table.layout.height}
                          onChange={(e) =>
                            changeGeometry(table.id, {
                              ...table.layout,
                              height: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                    ) : null}
                    <label className="grid gap-1 text-sm font-semibold">
                      Drehung
                      <input
                        className="glass-control min-h-12 px-3"
                        aria-label="Tischdrehung"
                        type="number"
                        min={0}
                        max={359.999}
                        step={5}
                        value={table.layout.rotation}
                        onChange={(e) =>
                          changeGeometry(table.id, {
                            ...table.layout,
                            rotation: normalizeRotation(Number(e.target.value)),
                          })
                        }
                      />
                    </label>
                    <div className="flex gap-2" aria-label="Tisch verschieben">
                      {(
                        [
                          ["←", "Nach links", -0.01, 0],
                          ["↑", "Nach oben", 0, -0.01],
                          ["↓", "Nach unten", 0, 0.01],
                          ["→", "Nach rechts", 0.01, 0],
                        ] as const
                      ).map(([icon, label, x, y]) => (
                        <button
                          type="button"
                          title={label}
                          aria-label={label}
                          className="secondary-action table-plan-icon"
                          key={label}
                          onClick={() =>
                            changeGeometry(
                              table.id,
                              clampPosition(
                                { ...table.layout, x: table.layout.x + x, y: table.layout.y + y },
                                plan.background.aspectRatio,
                              ),
                            )
                          }
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => {
                        if (
                          !baseline.tables.some((t) => t.id === table.id) &&
                          !plan.combinations.some((c) => c.memberIds.includes(table.id))
                        ) {
                          changePlan({
                            ...plan,
                            tables: plan.tables.filter((t) => t.id !== table.id),
                          });
                          setSelected(null);
                        } else changeTable(table.id, { archived: !table.archived });
                      }}
                    >
                      {table.archived
                        ? "Wiederherstellen"
                        : baseline.tables.some((t) => t.id === table.id) ||
                            plan.combinations.some((c) => c.memberIds.includes(table.id))
                          ? "Archivieren"
                          : "Entfernen"}
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-muted">
                    {plan.tables.length ? "Kein Tisch ausgewählt." : "Noch keine Tische angelegt."}
                  </p>
                )}
              </>
            ) : null}
            {tab === "combinations" ? (
              <>
                <button
                  type="button"
                  className="secondary-action"
                  disabled={
                    plan.tables.filter((t) => !t.archived).length < 2 ||
                    plan.combinations.length >= 200
                  }
                  onClick={addCombination}
                >
                  + Kombination
                </button>
                <div className="table-plan-resource-list">
                  {plan.combinations
                    .filter((c) => showArchived || !c.archived)
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="glass-nav-link px-3 py-2 text-left text-sm"
                        data-active={selected === c.id}
                        onClick={() => setSelected(c.id)}
                      >
                        <span className="block font-semibold">
                          {c.name}
                          {c.archived ? " · Archiviert" : ""}
                        </span>
                        <span className="block text-xs text-muted">
                          {c.memberIds
                            .map((id) => plan.tables.find((t) => t.id === id)?.name)
                            .join(" + ")}
                        </span>
                      </button>
                    ))}
                </div>
                {combination ? (
                  <>
                    <ResourceFields
                      resource={combination}
                      onChange={(patch) =>
                        changePlan({
                          ...plan,
                          combinations: plan.combinations.map((c) =>
                            c.id === combination.id ? { ...c, ...patch } : c,
                          ),
                        })
                      }
                    />
                    <fieldset className="grid gap-2">
                      <legend className="mb-2 text-sm font-semibold">Mitgliedstische</legend>
                      {plan.tables.map((t) => (
                        <label key={t.id} className="text-sm">
                          <input
                            type="checkbox"
                            checked={combination.memberIds.includes(t.id)}
                            onChange={(e) =>
                              changePlan({
                                ...plan,
                                combinations: plan.combinations.map((c) =>
                                  c.id === combination.id
                                    ? {
                                        ...c,
                                        memberIds: e.target.checked
                                          ? [...c.memberIds, t.id]
                                          : c.memberIds.filter((id) => id !== t.id),
                                      }
                                    : c,
                                ),
                              })
                            }
                          />{" "}
                          {t.name}
                          {t.archived ? " (archiviert)" : !t.isActive ? " (inaktiv)" : ""}
                        </label>
                      ))}
                    </fieldset>
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => {
                        if (!baseline.combinations.some((c) => c.id === combination.id)) {
                          changePlan({
                            ...plan,
                            combinations: plan.combinations.filter((c) => c.id !== combination.id),
                          });
                          setSelected(null);
                        } else
                          changePlan({
                            ...plan,
                            combinations: plan.combinations.map((c) =>
                              c.id === combination.id ? { ...c, archived: !c.archived } : c,
                            ),
                          });
                      }}
                    >
                      {combination.archived
                        ? "Wiederherstellen"
                        : baseline.combinations.some((c) => c.id === combination.id)
                          ? "Archivieren"
                          : "Entfernen"}
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-muted">Keine Kombination ausgewählt.</p>
                )}
              </>
            ) : null}
            {tab === "background" ? (
              <>
                <label className="grid gap-2 text-sm font-semibold">
                  Grundriss wählen
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      chooseFloorplan(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Skalierung
                  <input
                    aria-label="Grundrissskalierung"
                    type="range"
                    min={0.25}
                    max={4}
                    step={0.05}
                    value={plan.background.scale}
                    onChange={(e) =>
                      changePlan({
                        ...plan,
                        background: { ...plan.background, scale: Number(e.target.value) },
                      })
                    }
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Deckkraft
                  <input
                    aria-label="Grundrissdeckkraft"
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={plan.background.opacity}
                    onChange={(e) =>
                      changePlan({
                        ...plan,
                        background: { ...plan.background, opacity: Number(e.target.value) },
                      })
                    }
                  />
                </label>
                <div className="flex flex-wrap gap-2" aria-label="Grundriss verschieben">
                  {(
                    [
                      ["←", "Grundriss nach links", -0.02, 0],
                      ["↑", "Grundriss nach oben", 0, -0.02],
                      ["↓", "Grundriss nach unten", 0, 0.02],
                      ["→", "Grundriss nach rechts", 0.02, 0],
                    ] as const
                  ).map(([icon, label, x, y]) => (
                    <button
                      className="secondary-action table-plan-icon"
                      type="button"
                      key={label}
                      title={label}
                      aria-label={label}
                      onClick={() =>
                        changePlan({
                          ...plan,
                          background: {
                            ...plan.background,
                            x: Math.max(-1, Math.min(1, plan.background.x + x)),
                            y: Math.max(-1, Math.min(1, plan.background.y + y)),
                          },
                        })
                      }
                    >
                      {icon}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() =>
                    changePlan({
                      ...plan,
                      background: { ...plan.background, scale: 1, x: 0, y: 0, opacity: 1 },
                    })
                  }
                >
                  Einpassen
                </button>
                {imageUrl ? (
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => {
                      const next = transferPlanAspect(plan, baseline.background.aspectRatio);
                      commit({
                        ...draft,
                        plan: { ...next, background: { ...next.background, asset: null } },
                        file: null,
                        preview: null,
                        action: "remove",
                        acknowledged: false,
                      });
                    }}
                  >
                    Grundriss entfernen
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        </fieldset>
      </div>
      <dialog
        className="table-plan-dialog"
        ref={dialog}
        onCancel={() => setCandidate(null)}
        aria-labelledby="aspect-change-title"
      >
        {candidate ? (
          <>
            <h3 id="aspect-change-title" className="text-xl font-semibold">
              Anderes Planformat
            </h3>
            <p className="mt-3 text-sm leading-6">
              Die Tischanordnung wird proportional und ohne Verzerrung übernommen. Bitte die
              Positionen zum neuen Grundriss anschließend überprüfen.
            </p>
            <div
              className="my-4 mx-auto"
              style={{ maxWidth: `min(100%, ${50 * candidate.plan.background.aspectRatio}vh)` }}
            >
              <PlanView plan={candidate.plan} imageUrl={candidate.preview} />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                autoFocus
                type="button"
                className="secondary-action"
                onClick={() => setCandidate(null)}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className="primary-action"
                onClick={() => {
                  commit(candidate);
                  setCandidate(null);
                }}
              >
                Proportional übernehmen
              </button>
            </div>
          </>
        ) : null}
      </dialog>
    </div>
  );
}
