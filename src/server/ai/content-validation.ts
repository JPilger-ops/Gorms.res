import type { AiDraftResponse } from "@/src/server/ai/schemas";

export type AiDraftContentBlockingIssue =
  | "body_too_long"
  | "email_address"
  | "guarantee_phrase"
  | "phone_number"
  | "placeholder"
  | "price_amount"
  | "signature_placeholder"
  | "subject_in_body";

export type AiDraftContentWarning =
  | "availability_cautious"
  | "deposit_notice"
  | "opening_hours"
  | "special_requests";

export type AiDraftContentValidationResult = {
  blockingIssues: AiDraftContentBlockingIssue[];
  ok: boolean;
  warnings: AiDraftContentWarning[];
};

const guaranteePatterns = [
  /\bgarantier(?:en|t|te|ter|tes)?\b.{0,80}\b(?:tisch|terrasse|au[ßs]en|au[ßs]enplatz|aussenplatz|ruhig|ruhebereich|verf[üu]gbar(?:keit)?)\b/i,
  /\b(?:tisch|terrasse|au[ßs]en|au[ßs]enplatz|aussenplatz|ruhig|ruhebereich|verf[üu]gbar(?:keit)?)\b.{0,80}\bgarantier(?:en|t|te|ter|tes)?\b/i,
  /\bsicher verf[üu]gbar\b/i,
  /\bverbindlich zugesichert\b/i,
  /\bder gew[üu]nschte tisch ist reserviert\b/i,
  /\bruhiger tisch ist garantiert\b/i,
  /\bbestimmter tisch ist garantiert\b/i,
  /\bterrasse ist garantiert\b/i,
  /\bdrau[ßs]en ist garantiert\b/i,
];

const availabilityCautiousPatterns = [
  /\bnach verf[üu]gbarkeit\b/i,
  /\bsofern verf[üu]gbar\b/i,
  /\bwenn verf[üu]gbar\b/i,
  /\bje nach verf[üu]gbarkeit\b/i,
  /\bvorbehaltlich\b/i,
];

const openingHoursPatterns = [
  /\b[öo]ffnungszeiten?\b/i,
  /\bge[öo]ffnet\b/i,
  /\b(?:von|zwischen)\s+\d{1,2}(?::\d{2})?\s*(?:uhr)?\s+(?:bis|und)\s+\d{1,2}(?::\d{2})?\s*(?:uhr)?\b/i,
];

const specialRequestPatterns = [/\bsonderw[üu]nsch(?:e|en)?\b/i, /\bwunsch\b/i, /\bw[üu]nsche\b/i];

const placeholderPatterns = [
  /\{\{[^}]+}}/,
  /\[[^\]]+]/,
  /\bdein name\b/i,
  /\bihr name\b/i,
  /\bname einsetzen\b/i,
];

const subjectInBodyPattern = /^\s*(?:betreff|subject)\s*:/im;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const internationalPhonePattern =
  /(?:^|[^\w])(?:\+|00)\d{1,3}[\s()./-]*(?:\d[\s()./-]*){6,}\d?(?=$|[^\w])/;
const germanDomesticPhonePattern = /(?:^|[^\w])0\d(?:[\s()./-]*\d){6,}(?=$|[^\w])/;
const longDigitPhonePattern = /\b\d{9,}\b/;
const priceAmountPattern = /\b\d{1,5}(?:[,.]\d{2})?\s*(?:€|eur|euro)(?=$|[^\p{L}\p{N}_])/iu;
const depositNoticePattern = /\banzahlung\b/i;

function addIssue(
  issues: Set<AiDraftContentBlockingIssue>,
  issue: AiDraftContentBlockingIssue,
  condition: boolean,
) {
  if (condition) {
    issues.add(issue);
  }
}

function addWarning(
  warnings: Set<AiDraftContentWarning>,
  warning: AiDraftContentWarning,
  condition: boolean,
) {
  if (condition) {
    warnings.add(warning);
  }
}

function matchesAny(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

function hasPhoneNumber(value: string) {
  return (
    internationalPhonePattern.test(value) ||
    germanDomesticPhonePattern.test(value) ||
    longDigitPhonePattern.test(value)
  );
}

export function validateAiDraftContent(
  draft: Pick<AiDraftResponse, "body" | "title">,
): AiDraftContentValidationResult {
  const blockingIssues = new Set<AiDraftContentBlockingIssue>();
  const warnings = new Set<AiDraftContentWarning>();
  const combined = `${draft.title}\n${draft.body}`;

  addIssue(blockingIssues, "body_too_long", draft.body.length > 2500);
  addIssue(blockingIssues, "guarantee_phrase", matchesAny(combined, guaranteePatterns));
  addIssue(blockingIssues, "placeholder", matchesAny(combined, placeholderPatterns));
  addIssue(
    blockingIssues,
    "signature_placeholder",
    /\b(?:signatur|unterschrift|template)\b/i.test(combined),
  );
  addIssue(blockingIssues, "subject_in_body", subjectInBodyPattern.test(draft.body));
  addIssue(blockingIssues, "email_address", emailPattern.test(combined));
  addIssue(blockingIssues, "phone_number", hasPhoneNumber(combined));
  addIssue(blockingIssues, "price_amount", priceAmountPattern.test(combined));

  addWarning(warnings, "availability_cautious", matchesAny(combined, availabilityCautiousPatterns));
  addWarning(warnings, "deposit_notice", depositNoticePattern.test(combined));
  addWarning(warnings, "opening_hours", matchesAny(combined, openingHoursPatterns));
  addWarning(warnings, "special_requests", matchesAny(combined, specialRequestPatterns));

  return {
    blockingIssues: [...blockingIssues],
    ok: blockingIssues.size === 0,
    warnings: [...warnings],
  };
}
