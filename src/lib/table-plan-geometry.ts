import type { TableGeometry, TablePlan } from "./table-plan-types";

export const roundCoordinate = (value: number) => Math.round(value * 1e8) / 1e8;
export const normalizeRotation = (value: number) =>
  (Math.round((((value % 360) + 360) % 360) * 1000) / 1000) % 360;

export function rotatedHalfExtents(g: TableGeometry, aspect: number) {
  const angle = (g.rotation * Math.PI) / 180;
  const c = Math.abs(Math.cos(angle));
  const s = Math.abs(Math.sin(angle));
  if (g.shape === "round") return { x: g.width / 2, y: g.height / 2 };
  return {
    x: (g.width * c + (g.height / aspect) * s) / 2,
    y: (g.height * c + g.width * aspect * s) / 2,
  };
}

export function geometryFits(g: TableGeometry, aspect: number) {
  const e = rotatedHalfExtents(g, aspect);
  const tolerance = 1e-7;
  const square = g.shape === "rectangle" || Math.abs(g.width - g.height / aspect) < tolerance;
  return (
    square &&
    g.x - e.x >= -tolerance &&
    g.x + e.x <= 1 + tolerance &&
    g.y - e.y >= -tolerance &&
    g.y + e.y <= 1 + tolerance
  );
}

export function clampPosition(g: TableGeometry, aspect: number): TableGeometry {
  const e = rotatedHalfExtents(g, aspect);
  return {
    ...g,
    x: roundCoordinate(Math.min(1 - e.x, Math.max(e.x, g.x))),
    y: roundCoordinate(Math.min(1 - e.y, Math.max(e.y, g.y))),
  };
}

// Uniform physical scaling, not independent stretching of normalized X/Y axes.
export function transferPlanAspect(plan: TablePlan, newAspect: number): TablePlan {
  const oldAspect = plan.background.aspectRatio;
  const scale = Math.min(1, oldAspect / newAspect);
  const offsetX = (1 - scale) / 2;
  const offsetY = (1 - (scale * newAspect) / oldAspect) / 2;
  return {
    ...plan,
    background: { ...plan.background, aspectRatio: newAspect, scale: 1, x: 0, y: 0 },
    tables: plan.tables.map((t) => ({
      ...t,
      layout: {
        ...t.layout,
        x: roundCoordinate(offsetX + scale * t.layout.x),
        y: roundCoordinate(offsetY + ((scale * newAspect) / oldAspect) * t.layout.y),
        width: roundCoordinate(scale * t.layout.width),
        height: roundCoordinate(((scale * newAspect) / oldAspect) * t.layout.height),
      },
    })),
  };
}
