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

export type GuestQuestionCategory =
  | "asks_accessibility"
  | "asks_allergy"
  | "asks_deposit"
  | "asks_dog_allowed"
  | "asks_high_chair"
  | "asks_occasion"
  | "asks_outdoor_seating"
  | "asks_specific_table";

export type DetectedSpecialRequest = {
  acceptanceNote?: string;
  answerText?: string;
  category: SpecialRequestCategory;
  clarificationQuestion?: string;
  certainty: SpecialRequestCertainty;
  declineNote?: string;
  forbiddenClaims: string[];
  guestQuestionCategories: GuestQuestionCategory[];
  label: string;
  neverSay: string[];
  priority: number;
  questionText?: string;
  safeFacts: string[];
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
  structuredPolicies: StructuredSpecialRequestPolicy[];
};

export type StructuredSpecialRequestPolicy = {
  allowedAcceptanceNote?: string;
  allowedDeclineNote?: string;
  allowedQuestionText?: string;
  answerText?: string;
  category: SpecialRequestCategory;
  certainty: SpecialRequestCertainty;
  clarificationQuestion?: string;
  guestQuestionCategories: GuestQuestionCategory[];
  label: string;
  neverSay: string[];
  safeFacts: string[];
  staffNote: string;
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
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ß/g, "ss");
}

function hasAny(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

function includesQuestionIntent(value: string) {
  return hasAny(value, [
    /\?/,
    /\bkann\b/,
    /\bkonnen\b/,
    /\bdarf\b/,
    /\bdurfen\b/,
    /\bgibt es\b/,
    /\bsind\b/,
    /\bist\b/,
    /\bmussen\b/,
    /\bwie ist\b/,
  ]);
}

function createDetectedRequest(
  input: Omit<DetectedSpecialRequest, "guestQuestionCategories" | "neverSay" | "safeFacts"> &
    Partial<Pick<DetectedSpecialRequest, "guestQuestionCategories" | "neverSay" | "safeFacts">>,
): DetectedSpecialRequest {
  return {
    ...input,
    guestQuestionCategories: input.guestQuestionCategories ?? [],
    neverSay: input.neverSay ?? input.forbiddenClaims,
    safeFacts: input.safeFacts ?? [],
  };
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
  return createDetectedRequest({
    acceptanceNote: tableCode
      ? `Ihren Wunsch nach Tisch ${tableCode} haben wir notiert. Bitte haben Sie Verständnis, dass wir bestimmte Tische je nach Auslastung nicht verbindlich garantieren können.`
      : genericTableAcceptanceNote,
    answerText: tableCode
      ? `Ihren Wunsch nach Tisch ${tableCode} haben wir notiert. Bitte haben Sie Verständnis, dass wir bestimmte Tische je nach Auslastung nicht verbindlich garantieren können.`
      : genericTableAcceptanceNote,
    category: "specific_table_reservable",
    clarificationQuestion: tableCode
      ? `Sollen wir Ihre Anfrage auch dann weiterbearbeiten, wenn Tisch ${tableCode} nicht verfügbar ist?`
      : "Sollen wir Ihre Anfrage auch dann weiterbearbeiten, wenn der gewünschte Tisch nicht verfügbar ist?",
    certainty: "not_guaranteed",
    forbiddenClaims: forbiddenClaims.table,
    guestQuestionCategories: ["asks_specific_table"],
    label: tableCode ? `Reservierbarer Tischwunsch ${tableCode}` : "Reservierbarer Tischwunsch",
    priority: 6,
    questionText: tableCode
      ? `Wir haben Ihren Wunsch nach Tisch ${tableCode} notiert. Bitte beachten Sie, dass wir bestimmte Tische nicht verbindlich zusagen können. Sollen wir Ihre Anfrage auch dann weiterbearbeiten, wenn Tisch ${tableCode} nicht verfügbar ist?`
      : undefined,
    safeFacts: [
      "Tische mit Präfix R und Tische C1 bis C9 können als Wunsch notiert werden.",
      "Auch reservierbare Tischwünsche dürfen nicht verbindlich garantiert werden.",
    ],
    staffNote: tableCode
      ? `Gast wünscht reservierbaren Tisch ${tableCode}. Nicht verbindlich zusagen.`
      : "Gast wünscht bestimmten reservierbaren Tisch. Nicht verbindlich zusagen.",
  });
}

function createNotReservableTableRequest(tableCode: string): DetectedSpecialRequest {
  return createDetectedRequest({
    acceptanceNote: notReservableTableAcceptanceNote,
    answerText: notReservableTableAcceptanceNote,
    category: "specific_table_not_reservable",
    clarificationQuestion:
      "Sollen wir Ihre Anfrage für einen reservierbaren Tisch im Innenbereich weiterbearbeiten?",
    certainty: "not_reservable",
    forbiddenClaims: forbiddenClaims.table,
    guestQuestionCategories: ["asks_specific_table"],
    label: `Nicht reservierbarer Tischwunsch ${tableCode}`,
    priority: 4,
    questionText: `Bitte beachten Sie, dass A- und B-Tische grundsätzlich nicht reserviert werden können. Sollen wir Ihre Anfrage für einen reservierbaren Tisch im Innenbereich weiterbearbeiten?`,
    safeFacts: [
      "A- und B-Tische können grundsätzlich nicht reserviert werden.",
      "Die Reservierung gilt für den Innenbereich.",
    ],
    staffNote: `Gast wünscht A-/B-Tisch ${tableCode}. Diese Tische können grundsätzlich nicht reserviert werden.`,
  });
}

function buildRequestsFromMessage(message: string, guestCount: number) {
  const normalized = normalizeMessage(message);
  const requests: DetectedSpecialRequest[] = [];
  const tableCodes = findTableCodes(message);
  const asksQuestion = includesQuestionIntent(normalized);
  const asksDeposit = hasAny(normalized, [/anzahlung/, /anzahlen/]);
  const hasHighChairWord = hasAny(normalized, [/hochstuhl/, /kinderstuhl/, /kindersitz/]);
  const mentionsBabyOrToddler = hasAny(normalized, [/\bbaby\b/, /kleinkind/]);

  if (guestCount >= DEPOSIT_GUEST_COUNT_THRESHOLD) {
    requests.push(
      createDetectedRequest({
        acceptanceNote: depositAcceptanceNote,
        answerText: depositAcceptanceNote,
        category: "deposit_required",
        certainty: "required_notice",
        forbiddenClaims: forbiddenClaims.deposit,
        guestQuestionCategories: asksDeposit ? ["asks_deposit"] : [],
        label: "Anzahlung erforderlich",
        priority: 3,
        safeFacts: [
          `Ab ${DEPOSIT_GUEST_COUNT_THRESHOLD} Personen ist eine Anzahlung in Höhe von ${DEPOSIT_REQUIRED_AMOUNT_EUR} € erforderlich.`,
          "Die weiteren Details zur Anzahlung werden persönlich abgestimmt.",
        ],
        staffNote: `Anfrage ab 30 Personen: Anzahlung in Höhe von ${DEPOSIT_REQUIRED_AMOUNT_EUR} € erforderlich.`,
      }),
    );
  } else if (asksDeposit) {
    requests.push(
      createDetectedRequest({
        acceptanceNote: `Eine Anzahlung ist erst bei Reservierungen ab ${DEPOSIT_GUEST_COUNT_THRESHOLD} Personen erforderlich.`,
        answerText: `Eine Anzahlung ist erst bei Reservierungen ab ${DEPOSIT_GUEST_COUNT_THRESHOLD} Personen erforderlich.`,
        category: "deposit_required",
        certainty: "can_note",
        forbiddenClaims: forbiddenClaims.deposit,
        guestQuestionCategories: ["asks_deposit"],
        label: "Anzahlungsfrage",
        priority: 3,
        safeFacts: [
          `Unter ${DEPOSIT_GUEST_COUNT_THRESHOLD} Personen ist keine Anzahlungsregel erforderlich.`,
          `Ab ${DEPOSIT_GUEST_COUNT_THRESHOLD} Personen ist eine Anzahlung in Höhe von ${DEPOSIT_REQUIRED_AMOUNT_EUR} € erforderlich.`,
        ],
        staffNote:
          "Gast fragt nach Anzahlung. Unter 30 Personen keine feste Anzahlungsregel nennen.",
      }),
    );
  }

  if (hasAny(normalized, [/allerg/, /unvertrag/, /gluten/, /laktose/, /nuss/])) {
    requests.push(
      createDetectedRequest({
        acceptanceNote: allergyAcceptanceNote,
        answerText: allergyAcceptanceNote,
        category: "allergy",
        certainty: "needs_manual_review",
        forbiddenClaims: forbiddenClaims.allergy,
        guestQuestionCategories: asksQuestion ? ["asks_allergy"] : [],
        label: "Allergie/Unverträglichkeit",
        priority: 1,
        safeFacts: [
          "Allergien und Unverträglichkeiten werden notiert.",
          "Gäste sollen das Team vor Ort zusätzlich darauf ansprechen.",
          "Es darf kein medizinisches Sicherheitsversprechen gegeben werden.",
        ],
        staffNote: "Gast nennt Allergie/Unverträglichkeit. Manuell prüfen und vor Ort beachten.",
      }),
    );
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
    requests.push(
      createDetectedRequest({
        acceptanceNote:
          "Ihren Hinweis zur Barrierefreiheit oder Mobilität haben wir notiert. Bitte sprechen Sie unser Team bei Bedarf zusätzlich vor Ort an.",
        answerText:
          "Ihren Hinweis zur Barrierefreiheit oder Mobilität haben wir notiert. Bitte sprechen Sie unser Team bei Bedarf zusätzlich vor Ort an.",
        category: "accessibility",
        certainty: "needs_manual_review",
        forbiddenClaims: [
          "Barrierefreiheit ist garantiert.",
          "Ein bestimmter barrierefreier Platz ist zugesagt.",
        ],
        guestQuestionCategories: asksQuestion ? ["asks_accessibility"] : [],
        label: "Barrierefreiheit/Mobilität",
        priority: 2,
        safeFacts: [
          "Hinweise zu Barrierefreiheit oder Mobilität werden notiert.",
          "Konkrete Plätze oder Barrierefreiheit dürfen nicht garantiert werden.",
        ],
        staffNote:
          "Gast nennt Barrierefreiheit/Mobilität. Manuell prüfen und nach Möglichkeit berücksichtigen.",
      }),
    );
  }

  if (hasAny(normalized, [/kinderwagen/, /\bbuggy\b/, /\bwagen\b/])) {
    requests.push(
      createDetectedRequest({
        acceptanceNote:
          "Ihren Hinweis zum Kinderwagen haben wir notiert. Bitte haben Sie Verständnis, dass wir konkrete Stellplätze nicht verbindlich zusagen können.",
        answerText:
          "Ihren Hinweis zum Kinderwagen haben wir notiert. Bitte haben Sie Verständnis, dass wir konkrete Stellplätze nicht verbindlich zusagen können.",
        category: "stroller",
        certainty: "not_guaranteed",
        forbiddenClaims: ["Stellplatz ist reserviert.", "Kinderwagenplatz ist garantiert."],
        label: "Kinderwagen/Buggy",
        priority: 8,
        safeFacts: [
          "Hinweise zu Kinderwagen oder Buggy werden notiert.",
          "Konkrete Stellplätze dürfen nicht verbindlich zugesagt werden.",
        ],
        staffNote:
          "Gast nennt Kinderwagen/Buggy. Platzbedarf prüfen und nach Möglichkeit einplanen.",
      }),
    );
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
      requests.push(
        createDetectedRequest({
          acceptanceNote: genericTableAcceptanceNote,
          answerText: genericTableAcceptanceNote,
          category: "general_table_request",
          certainty: "not_guaranteed",
          forbiddenClaims: forbiddenClaims.table,
          guestQuestionCategories: ["asks_specific_table"],
          label: `Nicht als reservierbarer C-Tisch erkannt: ${tableCode.code}`,
          priority: 10,
          safeFacts: [
            "Tische C1 bis C9 können als Wunsch notiert werden.",
            "Andere C-Codes sind nicht als reservierbare C1-C9-Tische definiert.",
            "Tischwünsche dürfen nicht verbindlich garantiert werden.",
          ],
          staffNote: `Gast nennt Tisch ${tableCode.code}. Dieser Code ist nicht als reservierbarer C1-C9-Tisch definiert.`,
        }),
      );
    }
  }

  if (hasAny(normalized, [/aussen/, /biergarten/, /draussen/, /garten/, /terrasse/])) {
    requests.push(
      createDetectedRequest({
        acceptanceNote: terraceAcceptanceNote,
        answerText: terraceAcceptanceNote,
        category: "terrace",
        clarificationQuestion:
          "Sollen wir Ihre Anfrage für einen Tisch im Innenbereich weiterbearbeiten?",
        certainty: "not_reservable",
        forbiddenClaims: forbiddenClaims.terrace,
        guestQuestionCategories: ["asks_outdoor_seating"],
        label: "Außenbereich/Terrasse",
        priority: 5,
        questionText:
          "Bitte beachten Sie, dass wir Reservierungen grundsätzlich nur für den Innenbereich annehmen. Sollen wir Ihre Anfrage für einen Tisch im Innenbereich weiterbearbeiten?",
        safeFacts: [
          "Reservierungen gelten grundsätzlich nur für den Innenbereich.",
          "Bei gutem Wetter können Gäste sich vor Ort an freie Tische im Außenbereich setzen.",
          "Der Außenbereich wird nicht reserviert.",
        ],
        staffNote:
          "Gast wünscht Außenbereich/Terrasse. Außenbereich wird nicht reserviert; Reservierung gilt nur für den Innenbereich.",
      }),
    );
  }

  if (hasAny(normalized, [/\bhund\b/, /assistenzhund/, /begleithund/])) {
    requests.push(
      createDetectedRequest({
        acceptanceNote: "Den Hinweis, dass Sie mit Hund kommen, haben wir notiert.",
        answerText:
          "Hunde sind bei uns grundsätzlich erlaubt. Den Hinweis, dass Sie mit Hund kommen, haben wir notiert.",
        category: "dog",
        certainty: "can_note",
        forbiddenClaims: forbiddenClaims.dog,
        guestQuestionCategories: asksQuestion ? ["asks_dog_allowed"] : [],
        label: "Hund/Assistenzhund",
        priority: 7,
        safeFacts: [
          "Hunde sind grundsätzlich erlaubt.",
          "Der Hinweis, dass ein Gast mit Hund kommt, wird notiert.",
        ],
        staffNote: "Gast kommt mit Hund. Hinweis notieren.",
      }),
    );
  }

  if (hasHighChairWord || mentionsBabyOrToddler) {
    requests.push(
      createDetectedRequest({
        acceptanceNote:
          "Hochstühle sind bei uns vorhanden. Wir haben Ihren Wunsch notiert, können die Verfügbarkeit aber nicht verbindlich garantieren.",
        answerText:
          "Hochstühle sind bei uns vorhanden. Wir können die Verfügbarkeit jedoch nicht verbindlich garantieren.",
        category: "high_chair",
        clarificationQuestion: "Benötigen Sie für Ihre Reservierung einen Hochstuhl?",
        certainty: "not_guaranteed",
        forbiddenClaims: forbiddenClaims.highChair,
        guestQuestionCategories: asksQuestion || hasHighChairWord ? ["asks_high_chair"] : [],
        label: "Hochstuhl/Kinderstuhl",
        priority: 8,
        questionText: hasHighChairWord
          ? undefined
          : "Benötigen Sie für Ihre Reservierung einen Hochstuhl?",
        safeFacts: [
          "Hochstühle sind vorhanden.",
          "Die Verfügbarkeit von Hochstühlen darf nicht verbindlich garantiert werden.",
        ],
        staffNote: "Hochstuhl/Kinderstuhl prüfen und nach Möglichkeit einplanen.",
      }),
    );
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
    requests.push(
      createDetectedRequest({
        acceptanceNote:
          "Den genannten Anlass haben wir gerne notiert. Besondere Dekorationen oder Sonderleistungen können wir damit jedoch nicht verbindlich zusagen.",
        answerText:
          "Den genannten Anlass haben wir gerne notiert. Besondere Dekorationen oder Sonderleistungen können wir damit jedoch nicht verbindlich zusagen.",
        category: "occasion",
        certainty: "not_guaranteed",
        forbiddenClaims: forbiddenClaims.occasion,
        guestQuestionCategories: asksQuestion ? ["asks_occasion"] : [],
        label: "Anlass/Feier",
        priority: 9,
        safeFacts: [
          "Anlässe werden notiert.",
          "Dekorationen, Überraschungen oder Sonderleistungen dürfen nicht verbindlich zugesagt werden.",
        ],
        staffNote: "Gast nennt Anlass/Feier. Anlass notieren, keine Sonderleistung zusagen.",
      }),
    );
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
    requests.push(
      createDetectedRequest({
        acceptanceNote: genericTableAcceptanceNote,
        answerText: genericTableAcceptanceNote,
        category: "general_table_request",
        clarificationQuestion:
          "Sollen wir Ihre Anfrage auch dann weiterbearbeiten, wenn der gewünschte Tisch nicht verfügbar ist?",
        certainty: "not_guaranteed",
        forbiddenClaims: forbiddenClaims.table,
        guestQuestionCategories: asksQuestion ? ["asks_specific_table"] : [],
        label: "Allgemeiner Tischwunsch",
        priority: 10,
        questionText:
          "Wir haben Ihren Tischwunsch notiert. Bitte beachten Sie, dass wir bestimmte Tische nicht verbindlich zusagen können. Sollen wir Ihre Anfrage auch dann weiterbearbeiten?",
        safeFacts: [
          "Allgemeine Tischwünsche werden notiert.",
          "Bestimmte Tische dürfen nicht verbindlich garantiert werden.",
        ],
        staffNote: "Gast nennt allgemeinen Tischwunsch. Nicht verbindlich zusagen.",
      }),
    );
  }

  if (hasAny(normalized, [/ruhig/, /ruhebereich/, /ruhiger platz/, /ruhiger tisch/])) {
    requests.push(
      createDetectedRequest({
        acceptanceNote: genericTableAcceptanceNote,
        answerText: genericTableAcceptanceNote,
        category: "quiet_table",
        clarificationQuestion:
          "Sollen wir Ihre Anfrage auch dann weiterbearbeiten, wenn kein ruhiger Platz verfügbar ist?",
        certainty: "not_guaranteed",
        forbiddenClaims: forbiddenClaims.table,
        guestQuestionCategories: asksQuestion ? ["asks_specific_table"] : [],
        label: "Ruhiger Platz",
        priority: 10,
        questionText:
          "Wir haben Ihren Wunsch nach einem ruhigen Platz notiert. Bitte beachten Sie, dass wir bestimmte Plätze nicht verbindlich zusagen können. Sollen wir Ihre Anfrage auch dann weiterbearbeiten?",
        safeFacts: [
          "Wünsche nach einem ruhigen Platz werden notiert.",
          "Ruhige Plätze dürfen nicht verbindlich garantiert werden.",
        ],
        staffNote: "Gast wünscht ruhigen Platz. Nicht verbindlich zusagen.",
      }),
    );
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

function toStructuredPolicy(request: DetectedSpecialRequest): StructuredSpecialRequestPolicy {
  return {
    allowedAcceptanceNote: request.acceptanceNote,
    allowedDeclineNote: request.declineNote,
    allowedQuestionText: request.questionText,
    answerText: request.answerText,
    category: request.category,
    certainty: request.certainty,
    clarificationQuestion: request.clarificationQuestion,
    guestQuestionCategories: request.guestQuestionCategories,
    label: request.label,
    neverSay: request.neverSay,
    safeFacts: request.safeFacts,
    staffNote: request.staffNote,
  };
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
    structuredPolicies: detected.map(toStructuredPolicy),
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
