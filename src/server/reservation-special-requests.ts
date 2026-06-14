export type SpecialRequestCategory =
  | "accessibility"
  | "allergy"
  | "deposit_required"
  | "dog"
  | "general_table_request"
  | "high_chair"
  | "occasion"
  | "quiet_table"
  | "specific_table_not_reservable"
  | "specific_table_reservable"
  | "stroller"
  | "terrace"
  | "unclear";

export type SpecialRequestCertainty =
  | "can_note"
  | "needs_manual_review"
  | "not_guaranteed"
  | "not_reservable"
  | "required_notice";

export type DetectedSpecialRequest = {
  acceptanceNote?: string;
  category: SpecialRequestCategory;
  certainty: SpecialRequestCertainty;
  declineNote?: string;
  forbiddenClaims: string[];
  label: string;
  priority: number;
  questionText?: string;
  staffNote: string;
};

export type SpecialRequestEvaluation = {
  acceptanceNotes: string[];
  detected: DetectedSpecialRequest[];
  hasSpecialRequest: boolean;
  labels: string[];
  manualReviewReasons: string[];
  policyNotes: string[];
  questionTexts: string[];
};

const DEPOSIT_GUEST_COUNT_THRESHOLD = 30;
export const DEPOSIT_REQUIRED_AMOUNT_EUR = 100;

const forbiddenClaims = {
  allergy: [
    "Allergie kann sicher berücksichtigt werden.",
    "garantiert allergenfrei.",
    "kein Risiko.",
  ],
  deposit: [
    "Anzahlung entfällt.",
    "Keine Anzahlung erforderlich.",
    "Eventuell ist eine Anzahlung erforderlich.",
    "Möglicherweise fällt eine Anzahlung an.",
    "Andere Beträge als 100 €.",
  ],
  dog: ["Hund ist garantiert kein Problem.", "Hund ist immer möglich."],
  highChair: ["Hochstuhl ist garantiert verfügbar."],
  occasion: [
    "Dekoration wird vorbereitet.",
    "Wir kümmern uns um eine Überraschung.",
    "Sonderleistung ist zugesagt.",
  ],
  table: [
    "Tisch ist reserviert.",
    "Tisch ist verfügbar.",
    "Tisch wurde bestätigt.",
    "Tisch ist garantiert.",
    "Sie haben Tisch X gewählt.",
  ],
  terrace: [
    "Terrasse ist reserviert.",
    "Außenplatz ist reserviert.",
    "Terrasse ist garantiert.",
    "Außenbereich ist verfügbar.",
  ],
};

const genericTableAcceptanceNote =
  "Ihren Tischwunsch haben wir notiert. Bitte haben Sie Verständnis, dass wir bestimmte Tische je nach Auslastung nicht verbindlich garantieren können.";

const notReservableTableAcceptanceNote =
  "Bitte beachten Sie, dass A- und B-Tische grundsätzlich nicht reserviert werden können. Ihre Reservierung gilt für den Innenbereich; konkrete Tischwünsche prüfen wir nach Möglichkeit.";

const terraceAcceptanceNote =
  "Bitte beachten Sie, dass wir Reservierungen grundsätzlich nur für den Innenbereich annehmen. Bei gutem Wetter können Sie sich vor Ort gerne an einen freien Tisch im Außenbereich setzen.";

const allergyAcceptanceNote =
  "Ihren Hinweis zu Allergien oder Unverträglichkeiten haben wir notiert. Bitte sprechen Sie unser Team vor Ort zusätzlich darauf an.";

const depositAcceptanceNote = `Bitte beachten Sie, dass bei Reservierungen ab 30 Personen eine Anzahlung in Höhe von ${DEPOSIT_REQUIRED_AMOUNT_EUR} € erforderlich ist. Wir stimmen die weiteren Details dazu persönlich mit Ihnen ab.`;

function normalizeMessage(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function hasAny(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function findTableCodes(message: string) {
  const matches = [...message.matchAll(/\b([a-z])\s*[-_.]?\s*(\d{1,2})\b/gi)];

  const codes = matches.map((match) => ({
    code: `${match[1]!.toUpperCase()}${Number(match[2])}`,
    number: Number(match[2]),
    prefix: match[1]!.toUpperCase(),
  }));
  const byCode = new Map(codes.map((code) => [code.code, code]));

  return [...byCode.values()];
}

function formatManualReason(request: DetectedSpecialRequest) {
  return `Sonderwunsch erkannt: ${request.staffNote}`;
}

function createReservableTableRequest(tableCode?: string): DetectedSpecialRequest {
  return {
    acceptanceNote: tableCode
      ? `Ihren Wunsch nach Tisch ${tableCode} haben wir notiert. Bitte haben Sie Verständnis, dass wir bestimmte Tische je nach Auslastung nicht verbindlich garantieren können.`
      : genericTableAcceptanceNote,
    category: "specific_table_reservable",
    certainty: "not_guaranteed",
    forbiddenClaims: forbiddenClaims.table,
    label: tableCode ? `Reservierbarer Tischwunsch ${tableCode}` : "Reservierbarer Tischwunsch",
    priority: 6,
    questionText: tableCode
      ? `Wir haben Ihren Wunsch nach Tisch ${tableCode} notiert. Bitte beachten Sie, dass wir bestimmte Tische nicht verbindlich zusagen können. Sollen wir Ihre Anfrage auch dann weiterbearbeiten, wenn Tisch ${tableCode} nicht verfügbar ist?`
      : undefined,
    staffNote: tableCode
      ? `Gast wünscht reservierbaren Tisch ${tableCode}. Nicht verbindlich zusagen.`
      : "Gast wünscht bestimmten reservierbaren Tisch. Nicht verbindlich zusagen.",
  };
}

function createNotReservableTableRequest(tableCode: string): DetectedSpecialRequest {
  return {
    acceptanceNote: notReservableTableAcceptanceNote,
    category: "specific_table_not_reservable",
    certainty: "not_reservable",
    forbiddenClaims: forbiddenClaims.table,
    label: `Nicht reservierbarer Tischwunsch ${tableCode}`,
    priority: 4,
    questionText: `Bitte beachten Sie, dass A- und B-Tische grundsätzlich nicht reserviert werden können. Sollen wir Ihre Anfrage für einen reservierbaren Tisch im Innenbereich weiterbearbeiten?`,
    staffNote: `Gast wünscht A-/B-Tisch ${tableCode}. Diese Tische können grundsätzlich nicht reserviert werden.`,
  };
}

function buildRequestsFromMessage(message: string, guestCount: number) {
  const normalized = normalizeMessage(message);
  const requests: DetectedSpecialRequest[] = [];
  const tableCodes = findTableCodes(message);
  const hasHighChairWord = hasAny(normalized, [/hochstuhl/, /kinderstuhl/, /kindersitz/]);
  const mentionsBabyOrToddler = hasAny(normalized, [/\bbaby\b/, /kleinkind/]);

  if (guestCount >= DEPOSIT_GUEST_COUNT_THRESHOLD) {
    requests.push({
      acceptanceNote: depositAcceptanceNote,
      category: "deposit_required",
      certainty: "required_notice",
      forbiddenClaims: forbiddenClaims.deposit,
      label: "Anzahlung erforderlich",
      priority: 3,
      staffNote: `Anfrage ab 30 Personen: Anzahlung in Höhe von ${DEPOSIT_REQUIRED_AMOUNT_EUR} € erforderlich.`,
    });
  }

  if (hasAny(normalized, [/allerg/, /unvertrag/, /gluten/, /laktose/, /nuss/])) {
    requests.push({
      acceptanceNote: allergyAcceptanceNote,
      category: "allergy",
      certainty: "needs_manual_review",
      forbiddenClaims: forbiddenClaims.allergy,
      label: "Allergie/Unverträglichkeit",
      priority: 1,
      staffNote: "Gast nennt Allergie/Unverträglichkeit. Manuell prüfen und vor Ort beachten.",
    });
  }

  if (
    hasAny(normalized, [
      /barrierefrei/,
      /gehbehindert/,
      /gehilfe/,
      /mobilitat/,
      /rollator/,
      /rollstuhl/,
    ])
  ) {
    requests.push({
      acceptanceNote:
        "Ihren Hinweis zur Barrierefreiheit oder Mobilität haben wir notiert. Bitte sprechen Sie unser Team bei Bedarf zusätzlich vor Ort an.",
      category: "accessibility",
      certainty: "needs_manual_review",
      forbiddenClaims: [
        "Barrierefreiheit ist garantiert.",
        "Ein bestimmter barrierefreier Platz ist zugesagt.",
      ],
      label: "Barrierefreiheit/Mobilität",
      priority: 2,
      staffNote:
        "Gast nennt Barrierefreiheit/Mobilität. Manuell prüfen und nach Möglichkeit berücksichtigen.",
    });
  }

  if (hasAny(normalized, [/kinderwagen/, /\bbuggy\b/, /\bwagen\b/])) {
    requests.push({
      acceptanceNote:
        "Ihren Hinweis zum Kinderwagen haben wir notiert. Bitte haben Sie Verständnis, dass wir konkrete Stellplätze nicht verbindlich zusagen können.",
      category: "stroller",
      certainty: "not_guaranteed",
      forbiddenClaims: ["Stellplatz ist reserviert.", "Kinderwagenplatz ist garantiert."],
      label: "Kinderwagen/Buggy",
      priority: 8,
      staffNote: "Gast nennt Kinderwagen/Buggy. Platzbedarf prüfen und nach Möglichkeit einplanen.",
    });
  }

  for (const tableCode of tableCodes) {
    if (tableCode.prefix === "A" || tableCode.prefix === "B") {
      requests.push(createNotReservableTableRequest(tableCode.code));
      continue;
    }

    if (
      tableCode.prefix === "R" ||
      (tableCode.prefix === "C" && tableCode.number >= 1 && tableCode.number <= 9)
    ) {
      requests.push(createReservableTableRequest(tableCode.code));
      continue;
    }

    if (tableCode.prefix === "C") {
      requests.push({
        acceptanceNote: genericTableAcceptanceNote,
        category: "general_table_request",
        certainty: "not_guaranteed",
        forbiddenClaims: forbiddenClaims.table,
        label: `Nicht als reservierbarer C-Tisch erkannt: ${tableCode.code}`,
        priority: 10,
        staffNote: `Gast nennt Tisch ${tableCode.code}. Dieser Code ist nicht als reservierbarer C1-C9-Tisch definiert.`,
      });
    }
  }

  if (hasAny(normalized, [/aussen/, /biergarten/, /draussen/, /garten/, /terrasse/])) {
    requests.push({
      acceptanceNote: terraceAcceptanceNote,
      category: "terrace",
      certainty: "not_reservable",
      forbiddenClaims: forbiddenClaims.terrace,
      label: "Außenbereich/Terrasse",
      priority: 5,
      questionText:
        "Bitte beachten Sie, dass wir Reservierungen grundsätzlich nur für den Innenbereich annehmen. Sollen wir Ihre Anfrage für einen Tisch im Innenbereich weiterbearbeiten?",
      staffNote:
        "Gast wünscht Außenbereich/Terrasse. Außenbereich wird nicht reserviert; Reservierung gilt nur für den Innenbereich.",
    });
  }

  if (hasAny(normalized, [/\bhund\b/, /assistenzhund/, /begleithund/])) {
    requests.push({
      acceptanceNote: "Den Hinweis, dass Sie mit Hund kommen, haben wir notiert.",
      category: "dog",
      certainty: "can_note",
      forbiddenClaims: forbiddenClaims.dog,
      label: "Hund/Assistenzhund",
      priority: 7,
      staffNote: "Gast kommt mit Hund. Hinweis notieren.",
    });
  }

  if (hasHighChairWord || mentionsBabyOrToddler) {
    requests.push({
      acceptanceNote:
        "Hochstühle sind bei uns vorhanden. Wir haben Ihren Wunsch notiert, können die Verfügbarkeit aber nicht verbindlich garantieren.",
      category: "high_chair",
      certainty: "not_guaranteed",
      forbiddenClaims: forbiddenClaims.highChair,
      label: "Hochstuhl/Kinderstuhl",
      priority: 8,
      questionText: hasHighChairWord
        ? undefined
        : "Benötigen Sie für Ihre Reservierung einen Hochstuhl?",
      staffNote: "Hochstuhl/Kinderstuhl prüfen und nach Möglichkeit einplanen.",
    });
  }

  if (
    hasAny(normalized, [
      /geburtstag/,
      /hochzeit/,
      /trauerfeier/,
      /jubilaum/,
      /feier/,
      /anlass/,
      /blumen/,
      /deko/,
      /dekoration/,
      /torte/,
    ])
  ) {
    requests.push({
      acceptanceNote:
        "Den genannten Anlass haben wir gerne notiert. Besondere Dekorationen oder Sonderleistungen können wir damit jedoch nicht verbindlich zusagen.",
      category: "occasion",
      certainty: "not_guaranteed",
      forbiddenClaims: forbiddenClaims.occasion,
      label: "Anlass/Feier",
      priority: 9,
      staffNote: "Gast nennt Anlass/Feier. Anlass notieren, keine Sonderleistung zusagen.",
    });
  }

  const hasExplicitTableCode = tableCodes.length > 0;
  if (
    !hasExplicitTableCode &&
    hasAny(normalized, [
      /bestimmter tisch/,
      /fensterplatz/,
      /stammplatz/,
      /lieblingsplatz/,
      /tischwunsch/,
      /platzwunsch/,
      /\btisch\b/,
      /\becke\b/,
    ])
  ) {
    requests.push({
      acceptanceNote: genericTableAcceptanceNote,
      category: "general_table_request",
      certainty: "not_guaranteed",
      forbiddenClaims: forbiddenClaims.table,
      label: "Allgemeiner Tischwunsch",
      priority: 10,
      questionText:
        "Wir haben Ihren Tischwunsch notiert. Bitte beachten Sie, dass wir bestimmte Tische nicht verbindlich zusagen können. Sollen wir Ihre Anfrage auch dann weiterbearbeiten?",
      staffNote: "Gast nennt allgemeinen Tischwunsch. Nicht verbindlich zusagen.",
    });
  }

  if (hasAny(normalized, [/ruhig/, /ruhebereich/, /ruhiger platz/, /ruhiger tisch/])) {
    requests.push({
      acceptanceNote: genericTableAcceptanceNote,
      category: "quiet_table",
      certainty: "not_guaranteed",
      forbiddenClaims: forbiddenClaims.table,
      label: "Ruhiger Platz",
      priority: 10,
      questionText:
        "Wir haben Ihren Wunsch nach einem ruhigen Platz notiert. Bitte beachten Sie, dass wir bestimmte Plätze nicht verbindlich zusagen können. Sollen wir Ihre Anfrage auch dann weiterbearbeiten?",
      staffNote: "Gast wünscht ruhigen Platz. Nicht verbindlich zusagen.",
    });
  }

  return requests;
}

function dedupeByCategoryAndNote(requests: DetectedSpecialRequest[]) {
  const seen = new Set<string>();

  return requests.filter((request) => {
    const key = `${request.category}:${request.acceptanceNote ?? ""}:${request.staffNote}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildAcceptanceNotes(requests: DetectedSpecialRequest[]) {
  const sorted = [...requests].sort((a, b) => a.priority - b.priority);
  const requiredNotes = sorted
    .filter((request) => request.category === "allergy" || request.category === "deposit_required")
    .map((request) => request.acceptanceNote)
    .filter(Boolean) as string[];
  const otherNotes = sorted
    .filter((request) => request.category !== "allergy" && request.category !== "deposit_required")
    .map((request) => request.acceptanceNote)
    .filter(Boolean) as string[];

  if (sorted.length <= 2) {
    return unique([...requiredNotes, ...otherNotes]);
  }

  const tableOrTerrace = sorted.some((request) =>
    [
      "general_table_request",
      "quiet_table",
      "specific_table_not_reservable",
      "specific_table_reservable",
      "terrace",
    ].includes(request.category),
  );
  const compactNotes = [
    tableOrTerrace
      ? "Ihre Hinweise und Sonderwünsche haben wir notiert. Bitte beachten Sie, dass bestimmte Tische oder Plätze im Außenbereich nicht verbindlich zugesagt werden können."
      : "Ihre Hinweise und Sonderwünsche haben wir notiert.",
    ...requiredNotes,
  ];

  return unique(compactNotes);
}

export function evaluateSpecialRequests({
  guestCount,
  message,
}: {
  guestCount: number;
  message: string | null | undefined;
}): SpecialRequestEvaluation {
  const detected = dedupeByCategoryAndNote(
    buildRequestsFromMessage(typeof message === "string" ? message : "", guestCount),
  ).sort((a, b) => a.priority - b.priority);

  return {
    acceptanceNotes: buildAcceptanceNotes(detected),
    detected,
    hasSpecialRequest: detected.length > 0,
    labels: detected.map((request) => request.label),
    manualReviewReasons: detected.map(formatManualReason),
    policyNotes: detected.map(
      (request) =>
        `${request.label}: ${request.staffNote} Verbotene Zusagen: ${request.forbiddenClaims.join(" ")}`,
    ),
    questionTexts: unique(
      detected.map((request) => request.questionText).filter(Boolean) as string[],
    ),
  };
}

export function detectSpecialRequests(message: string | null | undefined, guestCount = 0) {
  return evaluateSpecialRequests({ guestCount, message });
}

export function buildSpecialRequestContentForDecision(
  decision: "accept" | "decline" | "question",
  evaluation: SpecialRequestEvaluation,
) {
  if (decision === "accept") {
    return evaluation.acceptanceNotes.join("\n\n");
  }

  if (decision === "question") {
    return evaluation.questionTexts.slice(0, 3).join("\n\n");
  }

  return "";
}
