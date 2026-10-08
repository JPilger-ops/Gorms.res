export type TableShape = "round" | "square" | "rectangle";

export type TableGeometry = {
  shape: TableShape;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zOrder: number;
};

export type PlanResource = {
  id: string;
  name: string;
  minGuests: number;
  maxGuests: number;
  isActive: boolean;
  isOnlineBookable: boolean;
  isWheelchairAccessible: boolean;
  archived: boolean;
};

export type PlanTable = PlanResource & { layout: TableGeometry };
export type PlanCombination = PlanResource & { memberIds: string[] };
export type PlanArea = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  isOnlineBookable: boolean;
  archived: boolean;
  revision: number;
};
export type FloorplanInfo = { id: string; width: number; height: number };
export type PlanBackground = {
  aspectRatio: number;
  scale: number;
  x: number;
  y: number;
  opacity: number;
  asset: FloorplanInfo | null;
};
export type TablePlan = {
  venueId: string;
  area: PlanArea;
  background: PlanBackground;
  tables: PlanTable[];
  combinations: PlanCombination[];
};

export type TablePlanSave = {
  venueId: string;
  baseRevision: number;
  aspectChangeAcknowledged: boolean;
  floorplanAction: "keep" | "replace" | "remove";
  plan: TablePlan;
};

export const TELEGRAPH_VENUE_ID = "00000000-0000-4000-8000-000000000002";
export const DEFAULT_PLAN_ASPECT_RATIO = 4 / 3;

export class TablePlanError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "TablePlanError";
  }
}
