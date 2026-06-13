import type { AiDraftResponse } from "@/src/server/ai/schemas";

export type AiDraftContentValidationIssue =
  | "body_too_long"
  | "email_address"
  | "guarantee_phrase"
  | "opening_hours"
  | "phone_number"
  | "placeholder"
  | "price"
  | "signature_placeholder"
  | "subject_in_body";

export type AiDraftContentValidationResult =
  | {
      issues: [];
      ok: true;
    }
  | {
      issues: AiDraftContentValidationIssue[];
      ok: false;
    };

const guaranteePatterns = [
  /\bgarantier(?:en|t|te|ter|tes)?\b/i,
  /\bsicher verf[üu]gbar\b/i,
  /\bverbindlich zugesichert\b/i,
  /\bder gew[üu]nschte tisch ist reserviert\b/i,
  /\bruhiger tisch ist garantiert\b/i,
  /\bbestimmter tisch ist garantiert\b/i,
  /\bterrasse ist garantiert\b/i,
  /\bdrau[ßs]en ist garantiert\b/i,
];

const openingHoursPatterns = [
  /\b[öo]ffnungszeiten?\b/i,
  /\bge[öo]ffnet\b/i,
  /\b(?:von|zwischen)\s+\d{1,2}(?::\d{2})?\s*(?:uhr)?\s+(?:bis|und)\s+\d{1,2}(?::\d{2})?\s*(?:uhr)?\b/i,
];

const placeholderPatterns = [
  /\{\{[^}]+}}/,
  /\[[^\]]+]/,
  /\bdein name\b/i,
  /\bihr name\b/i,
  /\bname einsetzen\b/i,
];

const subjectInBodyPattern = /^\s*(?:betreff|subject)\s*:/im;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const phonePattern = /(?:\+?\d[\d\s()./-]{7,}\d)/;
const pricePattern =
  /(?:\b\d+(?:[,.]\d{2})?\s*(?:€|eur|euro)\b)|(?:\b(?:preis|kosten|anzahlung)\b)/i;

function addIssue(
  issues: Set<AiDraftContentValidationIssue>,
  issue: AiDraftContentValidationIssue,
  condition: boolean,
) {
  if (condition) {
    issues.add(issue);
  }
}

function matchesAny(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

export function validateAiDraftContent(
  draft: Pick<AiDraftResponse, "body" | "title">,
): AiDraftContentValidationResult {
  const issues = new Set<AiDraftContentValidationIssue>();
  const combined = `${draft.title}\n${draft.body}`;

  addIssue(issues, "body_too_long", draft.body.length > 2500);
  addIssue(issues, "guarantee_phrase", matchesAny(combined, guaranteePatterns));
  addIssue(issues, "opening_hours", matchesAny(combined, openingHoursPatterns));
  addIssue(issues, "placeholder", matchesAny(combined, placeholderPatterns));
  addIssue(
    issues,
    "signature_placeholder",
    /\b(?:signatur|unterschrift|template)\b/i.test(combined),
  );
  addIssue(issues, "subject_in_body", subjectInBodyPattern.test(draft.body));
  addIssue(issues, "email_address", emailPattern.test(combined));
  addIssue(issues, "phone_number", phonePattern.test(combined));
  addIssue(issues, "price", pricePattern.test(combined));

  if (issues.size === 0) {
    return { issues: [], ok: true };
  }

  return {
    issues: [...issues],
    ok: false,
  };
}
