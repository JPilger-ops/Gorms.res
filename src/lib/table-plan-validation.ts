import { z } from "zod";
import { geometryFits } from "./table-plan-geometry";
import { TablePlanError } from "./table-plan-types";

const name = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .transform((s) => s.normalize("NFC"));
const fraction = z.number().finite().min(0).max(1);
const resource = z
  .object({
    id: z.uuid(),
    name,
    minGuests: z.number().int().min(1).max(1000),
    maxGuests: z.number().int().min(1).max(1000),
    isActive: z.boolean(),
    isOnlineBookable: z.boolean(),
    isWheelchairAccessible: z.boolean(),
    archived: z.boolean(),
  })
  .strict();

export const areaInputSchema = z
  .object({
    id: z.uuid().optional(),
    baseRevision: z.number().int().min(0).optional(),
    name,
    sortOrder: z.number().int().min(0).max(10000),
    isActive: z.boolean(),
    isOnlineBookable: z.boolean(),
    archived: z.boolean(),
  })
  .strict();

export const tablePlanSchema = z
  .object({
    venueId: z.uuid(),
    area: areaInputSchema
      .required({ id: true })
      .extend({ revision: z.number().int().min(0) })
      .omit({ baseRevision: true }),
    background: z
      .object({
        aspectRatio: z
          .number()
          .finite()
          .min(1 / 128)
          .max(128),
        scale: z.number().finite().min(0.25).max(4),
        x: z.number().finite().min(-1).max(1),
        y: z.number().finite().min(-1).max(1),
        opacity: fraction,
        asset: z
          .object({
            id: z.uuid(),
            width: z.number().int().min(64).max(8192),
            height: z.number().int().min(64).max(8192),
          })
          .strict()
          .nullable(),
      })
      .strict(),
    tables: z
      .array(
        resource.extend({
          layout: z
            .object({
              shape: z.enum(["round", "square", "rectangle"]),
              x: fraction,
              y: fraction,
              width: fraction.min(0.0001),
              height: fraction.min(0.0001),
              rotation: z.number().finite().min(0).lt(360),
              zOrder: z.number().int().min(0).max(10000),
            })
            .strict(),
        }),
      )
      .max(200),
    combinations: z
      .array(resource.extend({ memberIds: z.array(z.uuid()).min(2).max(200) }))
      .max(200),
  })
  .strict()
  .superRefine((plan, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    for (const items of [plan.tables, plan.combinations]) {
      if (new Set(items.map((t) => t.id)).size !== items.length)
        issue("IDs dürfen nicht doppelt vorkommen.");
      const names = items.filter((t) => !t.archived).map((t) => t.name.toLocaleLowerCase("de-DE"));
      if (new Set(names).size !== names.length)
        issue("Nicht archivierte Ressourcen benötigen unterschiedliche Namen.");
      for (const t of items)
        if (t.minGuests > t.maxGuests) issue(`${t.name}: Mindestzahl überschreitet Höchstzahl.`);
    }
    for (const t of plan.tables)
      if (!geometryFits(t.layout, plan.background.aspectRatio))
        issue(`${t.name}: Form oder Position liegt außerhalb der Planfläche.`);
    for (const c of plan.combinations) {
      if (new Set(c.memberIds).size !== c.memberIds.length)
        issue(`${c.name}: Jeder Mitgliedstisch darf nur einmal vorkommen.`);
      const members = c.memberIds.map((id) => plan.tables.find((t) => t.id === id));
      if (members.some((t) => !t)) issue(`${c.name}: Mitgliedstisch gehört nicht zu diesem Plan.`);
      if (c.maxGuests > members.reduce((sum, t) => sum + (t?.maxGuests ?? 0), 0))
        issue(`${c.name}: Kapazität überschreitet die Mitgliedskapazitäten.`);
    }
  });

export const tablePlanSaveSchema = z
  .object({
    venueId: z.uuid(),
    baseRevision: z.number().int().min(0),
    aspectChangeAcknowledged: z.boolean(),
    floorplanAction: z.enum(["keep", "replace", "remove"]),
    plan: tablePlanSchema,
  })
  .strict();

export function parseTablePlanSave(value: unknown) {
  const parsed = tablePlanSaveSchema.safeParse(value);
  if (!parsed.success)
    throw new TablePlanError(400, parsed.error.issues[0]?.message ?? "Bitte Eingaben prüfen.");
  return parsed.data;
}
