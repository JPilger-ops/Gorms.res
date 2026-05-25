import type { ReservationEmailData } from "@/src/server/email";

export const supportedEmailTemplateVariables = [
  "date",
  "time",
  "guestName",
  "guestCount",
  "phone",
  "email",
] as const;

export type EmailTemplateVariable = (typeof supportedEmailTemplateVariables)[number];

const variablePattern = /{{\s*([a-zA-Z][a-zA-Z0-9]*)\s*}}/g;

export function findUnsupportedTemplateVariables(template: string) {
  const supported = new Set<string>(supportedEmailTemplateVariables);
  const variables = [...template.matchAll(variablePattern)].map((match) => match[1]);
  return [...new Set(variables.filter((variable) => !supported.has(variable)))];
}

export function validateEmailSubjectTemplate(template: string) {
  const unsupported = findUnsupportedTemplateVariables(template);

  return {
    valid: unsupported.length === 0,
    unsupported,
  };
}

export function renderReservationSubjectTemplate(template: string, data: ReservationEmailData) {
  const values: Record<EmailTemplateVariable, string> = {
    date: data.date,
    email: data.email,
    guestCount: String(data.guestCount),
    guestName: data.guestName,
    phone: data.phone,
    time: data.time,
  };

  return template.replace(variablePattern, (match, key: string) => {
    if (key in values) {
      return values[key as EmailTemplateVariable];
    }

    return match;
  });
}
