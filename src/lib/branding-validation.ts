import { z } from "zod";

export const accentColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Bitte eine gültige Hex-Farbe verwenden.");

export const brandingSettingsSchema = z.object({
  accentColor: accentColorSchema,
});

export type BrandingSettingsInput = z.infer<typeof brandingSettingsSchema>;
