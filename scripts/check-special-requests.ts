import assert from "node:assert/strict";
import { validateAiDraftContent } from "@/src/server/ai/content-validation";
import {
  buildSpecialRequestContentForDecision,
  DEPOSIT_REQUIRED_AMOUNT_EUR,
  evaluateSpecialRequests,
} from "@/src/server/reservation-special-requests";

function evaluate(message: string, guestCount = 8) {
  return evaluateSpecialRequests({ guestCount, message });
}

function assertCategory(message: string, category: string, guestCount = 8) {
  const result = evaluate(message, guestCount);

  assert.equal(
    result.detected.some((request) => request.category === category),
    true,
    `Expected category ${category} for "${message}"`,
  );

  return result;
}

{
  const result = assertCategory("Wir kommen mit Hund.", "dog");
  assert.match(result.acceptanceNotes.join(" "), /Hund kommen, haben wir notiert/);
  assert.match(result.manualReviewReasons.join(" "), /Gast kommt mit Hund/);
  assert.equal(buildSpecialRequestContentForDecision("question", result), "");
}

{
  const result = assertCategory("Wir benötigen einen Hochstuhl.", "high_chair");
  assert.match(result.acceptanceNotes.join(" "), /Hochstühle sind bei uns vorhanden/);
  assert.match(result.acceptanceNotes.join(" "), /nicht verbindlich garantieren/);
}

{
  const result = assertCategory("Wir kommen mit Baby.", "high_chair");
  assert.match(result.questionTexts.join(" "), /Benötigen Sie.*Hochstuhl/);
  assert.match(
    buildSpecialRequestContentForDecision("question", result),
    /Benötigen Sie.*Hochstuhl/,
  );
}

{
  const result = assertCategory("Bitte draußen auf der Terrasse.", "terrace");
  assert.match(result.acceptanceNotes.join(" "), /nur für den Innenbereich/);
  assert.match(
    buildSpecialRequestContentForDecision("question", result),
    /Sollen wir Ihre Anfrage.*Innenbereich weiterbearbeiten/,
  );
}

for (const tableCode of ["C1", "C9", "R3"]) {
  const result = assertCategory(
    `Wir würden gerne am Tisch ${tableCode} sitzen.`,
    "specific_table_reservable",
  );
  assert.match(result.acceptanceNotes.join(" "), new RegExp(`Tisch ${tableCode}`));
  assert.match(result.acceptanceNotes.join(" "), /nicht verbindlich garantieren/);
  assert.match(
    buildSpecialRequestContentForDecision("question", result),
    new RegExp(`Tisch ${tableCode}`),
  );
}

{
  const result = evaluate("Wir würden gerne am Tisch C10 sitzen.");
  assert.equal(
    result.detected.some((request) => request.category === "specific_table_reservable"),
    false,
  );
  assert.equal(
    result.detected.some((request) => request.category === "general_table_request"),
    true,
  );
}

for (const tableCode of ["A1", "B2"]) {
  const result = assertCategory(
    `Wir würden gerne am Tisch ${tableCode} sitzen.`,
    "specific_table_not_reservable",
  );
  assert.match(result.acceptanceNotes.join(" "), /A- und B-Tische/);
  assert.match(result.manualReviewReasons.join(" "), /nicht reserviert werden/);
}

{
  const result = assertCategory("Eine Person hat eine Nussallergie.", "allergy");
  assert.match(result.acceptanceNotes.join(" "), /vor Ort zusätzlich/);
  assert.equal(buildSpecialRequestContentForDecision("question", result), "");
}

{
  const result = assertCategory("Wir feiern Geburtstag.", "occasion");
  assert.match(result.acceptanceNotes.join(" "), /Anlass.*notiert/);
  assert.match(result.acceptanceNotes.join(" "), /Sonderleistungen.*nicht verbindlich/);
  assert.equal(buildSpecialRequestContentForDecision("question", result), "");
}

{
  const result = evaluate("Normale Anfrage", 29);
  assert.equal(
    result.detected.some((request) => request.category === "deposit_required"),
    false,
  );
}

for (const guestCount of [30, 45]) {
  const result = evaluate("Normale Anfrage", guestCount);
  assert.equal(
    result.detected.some((request) => request.category === "deposit_required"),
    true,
  );
  assert.match(result.acceptanceNotes.join(" "), /Anzahlung in Höhe von 100 €/);
}

{
  const result = validateAiDraftContent({ content: "Eine Anzahlung von 50 € ist erforderlich." });
  assert.equal(result.ok, false);
  assert.equal(result.blockingIssues.includes("price_amount"), true);
}

{
  const result = validateAiDraftContent({ content: "Anzahlung entfällt." });
  assert.equal(result.ok, false);
  assert.equal(result.blockingIssues.includes("deposit_policy_violation"), true);
}

{
  const result = validateAiDraftContent(
    { content: `Eine Anzahlung von ${DEPOSIT_REQUIRED_AMOUNT_EUR} € ist erforderlich.` },
    "acceptance_note",
    { allowedPriceAmounts: [DEPOSIT_REQUIRED_AMOUNT_EUR] },
  );
  assert.equal(result.blockingIssues.includes("price_amount"), false);
}

for (const content of [
  "Hund ist garantiert kein Problem.",
  "Hochstuhl ist garantiert verfügbar.",
  "Terrasse ist reserviert.",
  "Außenplatz ist reserviert.",
  "Allergie kann sicher berücksichtigt werden.",
  "garantiert allergenfrei.",
  "Dekoration wird vorbereitet.",
  "Sonderleistung ist zugesagt.",
]) {
  const result = validateAiDraftContent({ content }, "acceptance_note");

  assert.equal(result.ok, false, `Expected blocked content: ${content}`);
  assert.equal(result.blockingIssues.includes("special_request_forbidden_claim"), true);
}

console.log("Special request policy checks passed.");
