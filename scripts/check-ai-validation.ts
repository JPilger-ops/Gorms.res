import assert from "node:assert/strict";
import { validateAiDraftContent } from "@/src/server/ai/content-validation";
import type { AiDraftTask } from "@/src/server/ai/schemas";
import { buildReservationDecisionDraft } from "@/src/server/reservation-decisions";

function validate(content: string, task?: AiDraftTask) {
  return validateAiDraftContent({ content }, task);
}

function assertNoBlockingPhone(content: string) {
  const result = validate(content);

  assert.equal(
    result.blockingIssues.includes("phone_number"),
    false,
    `Expected no phone issue for: ${content}`,
  );
}

const sampleReservation = {
  guestCount: 8,
  guestEmail: "julien@example.invalid",
  guestName: "Julien Pilger",
  guestPhone: "020000000",
  id: "00000000-0000-0000-0000-000000000001",
  message: "Wir würden gerne am Tisch c1 sitzen",
  requestedDate: "2026-06-19",
  requestedTime: "14:00:00",
  status: "pending" as const,
};

assertNoBlockingPhone("Wir bestätigen Ihre Reservierung am 2026-06-14.");
assertNoBlockingPhone("Wir bestätigen Ihre Reservierung am 14.06.2026 um 18:00 Uhr.");

{
  const result = validate("Wir bestätigen Ihre Reservierung am 14.06.2026 um 18:00 Uhr.");
  assert.equal(result.ok, true);
}

{
  const result = validate("Wir garantieren Ihnen einen ruhigen Tisch.");
  assert.equal(result.ok, false);
  assert.equal(result.blockingIssues.includes("guarantee_phrase"), true);
}

{
  const result = validate("Wir würden gerne am Tisch c1 sitzen.", "acceptance_note");
  assert.equal(result.ok, false);
  assert.equal(result.blockingIssues.includes("guest_request_copied"), true);
}

{
  const result = validate("Bei Gruppen ab 30 Personen ist eine Anzahlung erforderlich.");
  assert.equal(result.ok, true);
  assert.equal(result.warnings.includes("deposit_notice"), true);
  assert.equal(result.blockingIssues.includes("price_amount"), false);
}

{
  const result = validate("Eine Anzahlung von 100 € ist erforderlich.");
  assert.equal(result.ok, false);
  assert.equal(result.blockingIssues.includes("price_amount"), true);
}

{
  const result = validateAiDraftContent(
    {
      content:
        "Bitte beachten Sie, dass bei Reservierungen ab 30 Personen eine Anzahlung in Höhe von 100 € erforderlich ist.",
    },
    "acceptance_note",
    { allowedPriceAmounts: [100] },
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
  const result = validate(content, "acceptance_note");
  assert.equal(result.ok, false);
  assert.equal(result.blockingIssues.includes("special_request_forbidden_claim"), true);
}

{
  const result = validate("Anzahlung entfällt.", "acceptance_note");
  assert.equal(result.ok, false);
  assert.equal(result.blockingIssues.includes("deposit_policy_violation"), true);
}

{
  const result = validate("Guten Tag [Name], vielen Dank für Ihre Anfrage.");
  assert.equal(result.ok, false);
  assert.equal(result.blockingIssues.includes("placeholder"), true);
}

{
  const result = validate("Betreff: Ihre Reservierung\n\nGuten Tag, vielen Dank.");
  assert.equal(result.ok, false);
  assert.equal(result.blockingIssues.includes("subject_in_body"), true);
}

{
  const result = validate("Ihre Reservierung ist noch nicht verbindlich.", "acceptance_note");
  assert.equal(result.ok, false);
  assert.equal(result.blockingIssues.includes("acceptance_pending_phrase"), true);
}

{
  const result = validate(
    "Ihre Reservierung wird erst nach Prüfung durch einen Mitarbeiter verbindlich.",
    "acceptance_note",
  );
  assert.equal(result.ok, false);
  assert.equal(result.blockingIssues.includes("acceptance_pending_phrase"), true);
}

{
  const result = validate("Tisch c1 wurde reserviert.", "acceptance_note");
  assert.equal(result.ok, false);
  assert.equal(result.blockingIssues.includes("specific_place_reserved"), true);
}

{
  const result = validate("Sie haben Tisch c1 gewählt.", "acceptance_note");
  assert.equal(result.ok, false);
  assert.equal(result.blockingIssues.includes("specific_place_reserved"), true);
}

{
  const result = validate("Freuen uns auf Ihre Anmeldung.", "question_text");
  assert.equal(result.ok, false);
  assert.equal(result.blockingIssues.includes("question_wrong_flow"), true);
}

{
  const result = validate("Tisch c1 ist verfügbar.", "question_text");
  assert.equal(result.ok, false);
  assert.equal(result.blockingIssues.includes("question_wrong_flow"), true);
}

{
  const result = validate("Tisch c1 ist geeignet.", "question_text");
  assert.equal(result.ok, false);
  assert.equal(result.blockingIssues.includes("question_wrong_flow"), true);
}

for (const value of ["fuer", "bestaetigen", "Gruessen", "Heidekoenig"]) {
  const result = validate(value);
  assert.equal(result.ok, false);
  assert.equal(result.blockingIssues.includes("ascii_umlaut"), true);
}

{
  const result = validate(
    "Ihren Wunsch nach Tisch c1 haben wir notiert. Bitte haben Sie Verständnis, dass wir bestimmte Tische je nach Auslastung nicht verbindlich garantieren können.",
    "acceptance_note",
  );
  assert.equal(result.ok, true);
}

{
  const result = validate(
    "Bitte beachten Sie, dass bestimmte Tische nicht garantiert werden können.",
  );
  assert.equal(result.ok, true);
}

{
  const draft = buildReservationDecisionDraft(
    "accept",
    sampleReservation,
    "Ihren Wunsch nach Tisch c1 haben wir notiert. Bitte haben Sie Verständnis, dass wir bestimmte Tische je nach Auslastung nicht verbindlich garantieren können.",
  );

  assert.match(draft.body, /Guten Tag Julien Pilger/);
  assert.match(
    draft.body,
    /Hiermit bestätigen wir Ihre Reservierung am Freitag, den 19\. Juni 2026 um 14:00 Uhr für 8 Personen\./,
  );
  assert.match(draft.body, /Ihren Wunsch nach Tisch c1 haben wir notiert/);
  assert.doesNotMatch(draft.body, /noch nicht verbindlich/i);
}

{
  const draft = buildReservationDecisionDraft("decline", sampleReservation);

  assert.match(draft.body, /Leider können wir Ihre Anfrage für diesen Termin nicht bestätigen\./);
  assert.doesNotMatch(draft.body, /Tisch c1/);
}

{
  const draft = buildReservationDecisionDraft(
    "question",
    sampleReservation,
    "Wir haben Ihren Wunsch nach Tisch c1 notiert. Bitte beachten Sie, dass wir bestimmte Tische nicht verbindlich zusagen können. Sollen wir Ihre Anfrage auch dann weiterbearbeiten, wenn Tisch c1 nicht verfügbar ist?",
  );

  assert.match(draft.body, /Für die weitere Bearbeitung haben wir noch eine kurze Rückfrage:/);
  assert.match(draft.body, /Sollen wir Ihre Anfrage auch dann weiterbearbeiten/);
  assert.match(draft.body, /erst nach unserer persönlichen Bestätigung gültig/);
}

console.log("AI content validation checks passed.");
