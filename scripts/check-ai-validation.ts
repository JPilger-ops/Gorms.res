import assert from "node:assert/strict";
import { validateAiDraftContent } from "@/src/server/ai/content-validation";

function validate(body: string) {
  return validateAiDraftContent({
    body,
    title: "Antwortentwurf",
  });
}

function assertNoBlockingPhone(body: string) {
  const result = validate(body);

  assert.equal(
    result.blockingIssues.includes("phone_number"),
    false,
    `Expected no phone issue for: ${body}`,
  );
}

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
  const result = validate("Guten Tag [Name], vielen Dank für Ihre Anfrage.");
  assert.equal(result.ok, false);
  assert.equal(result.blockingIssues.includes("placeholder"), true);
}

{
  const result = validate("Betreff: Ihre Reservierung\n\nGuten Tag, vielen Dank.");
  assert.equal(result.ok, false);
  assert.equal(result.blockingIssues.includes("subject_in_body"), true);
}

console.log("AI content validation checks passed.");
