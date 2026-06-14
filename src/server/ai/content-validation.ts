import type { AiDraftResponse } from "@/src/server/ai/schemas";
import type { AiDraftTask } from "@/src/server/ai/schemas";

export type AiDraftContentBlockingIssue =
  | "acceptance_pending_phrase"
  | "ascii_umlaut"
  | "body_too_long"
  | "deposit_policy_violation"
  | "email_address"
  | "guarantee_phrase"
  | "guest_request_copied"
  | "phone_number"
  | "placeholder"
  | "price_amount"
  | "question_wrong_flow"
  | "special_request_forbidden_claim"
  | "specific_place_reserved"
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

const negatedGuaranteeContextPattern =
  /\b(?:nicht|kein(?:e|en|em|er|es)?|k[öo]nnen\s+(?:wir\s+)?nicht|nicht\s+verbindlich)\b/i;

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
const asciiUmlautPattern =
  /\b(?:fuer|bestaetigen|bestaetigt|zukuenftig|gruessen|heidekoenig|gewaehlt|pruefung|persoenlich|verfuegbar|rueckfrage|aussenplaetze?|aussenbereich)\b/i;
const copiedGuestRequestPattern =
  /\b(?:wir|ich)\s+(?:w[üu]rden|möchten|moechten|h[äa]tten|wollen)\s+gerne\b/i;

const acceptancePendingPatterns = [
  /\bnoch\s+nicht\s+verbindlich\b/i,
  /\berst\s+nach\s+(?:unserer\s+)?(?:pers[öo]nlicher\s+)?best[äa]tigung\b/i,
  /\berst\s+nach\s+pr[üu]fung\b/i,
  /\bwird\s+erst\s+nach\s+pr[üu]fung\b.{0,80}\bverbindlich\b/i,
  /\bwird\s+erst\s+nach\s+pers[öo]nlicher\s+best[äa]tigung\b.{0,80}\b(?:g[üu]ltig|verbindlich)\b/i,
];

const specificPlaceReservedPatterns = [
  /\btisch\s+[\p{L}\p{N}._-]+\s+(?:wurde\s+)?(?:reserviert|gew[äa]hlt)\b/iu,
  /\bsie\s+haben\s+tisch\s+[\p{L}\p{N}._-]+\s+gew[äa]hlt\b/iu,
  /\b(?:terrasse|au[ßs]enplatz|aussenplatz|ruhiger\s+tisch)\s+(?:wurde\s+)?reserviert\b/i,
];

const questionWrongFlowPatterns = [
  /\banmeldung\b/i,
  /\btisch\s+[\p{L}\p{N}._-]+\s+ist\s+(?:verf[üu]gbar|geeignet)\b/iu,
  /\btisch\s+[\p{L}\p{N}._-]+\s+wurde\s+reserviert\b/iu,
  /\breservierung\s+best[äa]tigt\b/i,
];

const specialRequestForbiddenClaimPatterns = [
  /\bhund\s+ist\s+(?:garantiert\s+)?(?:kein\s+problem|immer\s+m[öo]glich)\b/i,
  /\bhochstuhl\s+ist\s+garantiert\s+verf[üu]gbar\b/i,
  /\b(?:terrasse|au[ßs]enplatz|aussenplatz)\s+(?:ist|wurde)\s+reserviert\b/i,
  /\b(?:terrasse|au[ßs]enbereich|aussenbereich)\s+ist\s+(?:garantiert|verf[üu]gbar)\b/i,
  /\b[ab]\s*[-_.]?\s*\d{1,2}\s+(?:ist|wurde)\s+reserviert\b/i,
  /\ballergie\b.{0,80}\bsicher\s+ber[üu]cksichtigt\b/i,
  /\bgarantiert\s+allergenfrei\b/i,
  /\bkein\s+risiko\b/i,
  /\bdekoration\s+wird\s+vorbereitet\b/i,
  /\bwir\s+k[üu]mmern\s+uns\s+um\s+eine\s+[üu]berraschung\b/i,
  /\bsonderleistung\s+ist\s+zugesagt\b/i,
];

const depositPolicyViolationPatterns = [
  /\banzahlung\s+entf[äa]llt\b/i,
  /\bkeine\s+anzahlung\s+erforderlich\b/i,
  /\banzahlung\s+ist\s+nicht\s+erforderlich\b/i,
  /\b(?:eventuell|m[öo]glicherweise)\s+(?:ist\s+|f[äa]llt\s+)?eine\s+anzahlung\b/i,
];

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

function matchesAnyUnsafeGuarantee(value: string) {
  return guaranteePatterns.some((pattern) => {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    const globalPattern = new RegExp(pattern.source, flags);

    for (const match of value.matchAll(globalPattern)) {
      const index = match.index ?? 0;
      const context = value.slice(Math.max(0, index - 90), index + match[0].length + 40);

      if (!negatedGuaranteeContextPattern.test(context)) {
        return true;
      }
    }

    return false;
  });
}

function hasPhoneNumber(value: string) {
  return (
    internationalPhonePattern.test(value) ||
    germanDomesticPhonePattern.test(value) ||
    longDigitPhonePattern.test(value)
  );
}

function hasBlockedPriceAmount(value: string, allowedPriceAmounts: number[]) {
  const matches = value.matchAll(new RegExp(priceAmountPattern.source, "giu"));

  for (const match of matches) {
    const numericValue = Number(match[0].replace(/[^\d,.]/g, "").replace(",", "."));

    if (!allowedPriceAmounts.includes(numericValue)) {
      return true;
    }
  }

  return false;
}

export function validateAiDraftContent(
  draft: Pick<AiDraftResponse, "content">,
  task?: AiDraftTask,
  options: { allowedPriceAmounts?: number[] } = {},
): AiDraftContentValidationResult {
  const blockingIssues = new Set<AiDraftContentBlockingIssue>();
  const warnings = new Set<AiDraftContentWarning>();
  const combined = draft.content;

  addIssue(blockingIssues, "body_too_long", draft.content.length > 1200);
  addIssue(blockingIssues, "guarantee_phrase", matchesAnyUnsafeGuarantee(combined));
  addIssue(blockingIssues, "guest_request_copied", copiedGuestRequestPattern.test(combined));
  addIssue(blockingIssues, "ascii_umlaut", asciiUmlautPattern.test(combined));
  addIssue(blockingIssues, "placeholder", matchesAny(combined, placeholderPatterns));
  addIssue(
    blockingIssues,
    "signature_placeholder",
    /\b(?:signatur|unterschrift|template)\b/i.test(combined),
  );
  addIssue(blockingIssues, "subject_in_body", subjectInBodyPattern.test(draft.content));
  addIssue(blockingIssues, "email_address", emailPattern.test(combined));
  addIssue(blockingIssues, "phone_number", hasPhoneNumber(combined));
  addIssue(
    blockingIssues,
    "price_amount",
    hasBlockedPriceAmount(combined, options.allowedPriceAmounts ?? []),
  );
  addIssue(
    blockingIssues,
    "deposit_policy_violation",
    matchesAny(combined, depositPolicyViolationPatterns),
  );
  addIssue(
    blockingIssues,
    "special_request_forbidden_claim",
    matchesAny(combined, specialRequestForbiddenClaimPatterns),
  );

  if (task === "acceptance_note") {
    addIssue(
      blockingIssues,
      "acceptance_pending_phrase",
      matchesAny(combined, acceptancePendingPatterns),
    );
    addIssue(
      blockingIssues,
      "specific_place_reserved",
      matchesAny(combined, specificPlaceReservedPatterns),
    );
  }

  if (task === "question_text") {
    addIssue(
      blockingIssues,
      "question_wrong_flow",
      matchesAny(combined, questionWrongFlowPatterns),
    );
  }

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
