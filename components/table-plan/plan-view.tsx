import type { CSSProperties } from "react";
import type { TablePlan } from "@/src/lib/table-plan-types";
import { adminUrl } from "@/src/lib/admin-urls";

export function floorplanUrl(plan: TablePlan) {
  return plan.background.asset
    ? adminUrl(
        `/admin/table-plan/${plan.area.id}/floorplan?asset=${plan.background.asset.id}`,
        plan.venueId,
      )
    : null;
}

export function PlanView({
  plan,
  imageUrl = floorplanUrl(plan),
}: {
  plan: TablePlan;
  imageUrl?: string | null;
}) {
  const bg = plan.background;
  return (
    <div
      className="table-plan-surface table-plan-view"
      style={{ aspectRatio: bg.aspectRatio }}
      role="img"
      aria-label={`Tischplan ${plan.area.name}`}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="table-plan-background"
          src={imageUrl}
          style={{
            opacity: bg.opacity,
            transform: `translate(${bg.x * 100}%, ${bg.y * 100}%) scale(${bg.scale})`,
          }}
        />
      ) : null}
      {plan.tables
        .filter((t) => !t.archived)
        .map((t) => (
          <div
            key={t.id}
            className="table-plan-table"
            data-inactive={!t.isActive}
            style={
              {
                left: `${t.layout.x * 100}%`,
                top: `${t.layout.y * 100}%`,
                width: `${t.layout.width * 100}%`,
                height: `${t.layout.height * 100}%`,
                borderRadius: t.layout.shape === "round" ? "50%" : "6px",
                transform: `translate(-50%, -50%) rotate(${t.layout.rotation}deg)`,
                zIndex: t.layout.zOrder + 1,
              } as CSSProperties
            }
          >
            <span>{t.name}</span>
            <small>
              {t.minGuests}–{t.maxGuests}
              {t.isWheelchairAccessible ? " ♿" : ""}
            </small>
          </div>
        ))}
    </div>
  );
}
