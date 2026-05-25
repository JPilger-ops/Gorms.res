import { z } from "zod";

const emptyStringToUndefined = (value: unknown) => (value === "" ? undefined : value);

const envSchema = z.object({
  ADMIN_ALLOWED_HOSTS: z.string().default("login.gorms.de"),
  ADMIN_APP_URL: z.string().url().default("https://login.gorms.de"),
  ADMIN_HOST: z.string().default("login.gorms.de"),
  ADMIN_SESSION_COOKIE_NAME: z.string().default("heidekoenig_admin_session"),
  APP_ENCRYPTION_KEY: z.string().optional(),
  AUDIT_LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
  BACKUP_CONTAINER_PATH: z.string().default("/backups"),
  BACKUP_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  BLOCK_SUNDAYS: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  DATABASE_URL: z.string().optional(),
  EARLIEST_RESERVATION_TIME: z.string().default("11:30"),
  GUEST_EMAIL_SUBJECT_TEMPLATE: z
    .string()
    .default("Ihre Reservierungsanfrage bei der Waldwirtschaft Heidekönig"),
  HOLIDAY_COUNTRY: z.string().default("DE"),
  HOLIDAY_STATE: z.string().default("NW"),
  INTERNAL_EMAIL_SUBJECT_TEMPLATE: z
    .string()
    .default(
      "Neue Reservierungsanfrage: {{date}} um {{time}} - {{guestName}} - {{guestCount}} Personen",
    ),
  LATEST_RESERVATION_TIME: z.string().default("19:00"),
  MAX_GUESTS_PER_REQUEST: z.coerce.number().int().positive().default(30),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("https://heidekönig.gorms.de"),
  PUBLIC_ALLOWED_HOSTS: z.string().default("heidekönig.gorms.de,xn--heideknig-57a.gorms.de"),
  PUBLIC_HOST: z.string().default("heidekönig.gorms.de"),
  RESERVATION_NOTIFICATION_EMAIL: z.string().email().default("Welcome@der-heidekoenig.de"),
  RESERVATION_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  RUN_MIGRATIONS_ON_START: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SESSION_SECRET: z.string().optional(),
  SETUP_TOKEN: z.string().optional(),
  SMTP_FROM_ADDRESS: z.preprocess(emptyStringToUndefined, z.string().email().optional()),
  SMTP_FROM_NAME: z.string().default("Waldwirtschaft Heidekönig"),
  SMTP_HOST: z.string().default("smtp.ionos.de"),
  SMTP_PASSWORD: z.preprocess(emptyStringToUndefined, z.string().optional()),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_PROVIDER: z.string().default("ionos"),
  SMTP_USER: z.preprocess(emptyStringToUndefined, z.string().optional()),
  UPLOAD_DIR: z.string().default("/app/uploads"),
});

export const env = envSchema.parse(process.env);

export function requiredSecretStatus(
  name: "APP_ENCRYPTION_KEY" | "SESSION_SECRET" | "SETUP_TOKEN",
) {
  const value = env[name];
  return {
    isSet: Boolean(value),
    length: value?.length ?? 0,
  };
}
