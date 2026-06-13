type SpecialRequestRule = {
  label: string;
  patterns: RegExp[];
};

const specialRequestRules: SpecialRequestRule[] = [
  {
    label: "Allergie/Ernährung",
    patterns: [/allerg/, /gluten/, /laktose/, /nuss/, /vegan/, /vegetar/, /unvertrag/],
  },
  {
    label: "Barrierefreiheit/Mobilität",
    patterns: [/barrierefrei/, /gehbehindert/, /gehilfe/, /mobilitat/, /rollator/, /rollstuhl/],
  },
  {
    label: "Kinder/Babys",
    patterns: [/baby/, /buggy/, /hochstuhl/, /kinderstuhl/, /kinderwagen/],
  },
  {
    label: "Hund/Assistenzhund",
    patterns: [/\bhund\b/, /assistenzhund/],
  },
  {
    label: "Anlass/Dekoration",
    patterns: [/blumen/, /deko/, /dekoration/, /geburtstag/, /hochzeit/, /jubilaum/, /torte/],
  },
  {
    label: "Tisch-/Platzwunsch",
    patterns: [
      /ecke/,
      /fensterplatz/,
      /nah am/,
      /platzwunsch/,
      /ruhig/,
      /schatten/,
      /sonne/,
      /tischwunsch/,
    ],
  },
  {
    label: "Innen-/Außenbereich klären",
    patterns: [/aussen/, /außen/, /biergarten/, /draussen/, /draußen/, /garten/, /terrasse/],
  },
];

function normalizeMessage(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function detectSpecialRequests(message: string | null | undefined) {
  const normalizedMessage = typeof message === "string" ? normalizeMessage(message) : "";

  if (!normalizedMessage.trim()) {
    return {
      hasSpecialRequest: false,
      labels: [] as string[],
      manualReviewReasons: [] as string[],
    };
  }

  const labels = specialRequestRules
    .filter((rule) => rule.patterns.some((pattern) => pattern.test(normalizedMessage)))
    .map((rule) => rule.label);

  return {
    hasSpecialRequest: labels.length > 0,
    labels,
    manualReviewReasons: labels.map((label) => `Sonderwunsch erkannt: ${label}.`),
  };
}
