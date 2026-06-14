# AI Assistant

The reservation app supports a local Ollama-based assistant for internal drafting support. It is
disabled by default and must be explicitly enabled by the operator.

Gorms.res remains the source of truth for outgoing guest e-mails. The AI does not freely write full
acceptance, decline or question mails. It only returns a controlled content block that is inserted
into a fixed Gorms.res template.

Special requests are evaluated before AI drafting by the rule-based Gorms.res policy engine. If a
safe operator-approved block exists, Gorms.res keeps that block as the mandatory fallback and may ask
Ollama only to polish the wording. The factual policy remains Gorms.res-owned.

## Current Status

- `AI_ENABLED=false` by default.
- `AI_DRAFTS_ENABLED=false` by default.
- No reservation data is sent to Ollama unless the operator explicitly sets both
  `AI_ENABLED=true` and `AI_DRAFTS_ENABLED=true`.
- Response blocks are generated only after a staff member clicks the KI draft button.
- No status changes, e-mails or calendar files can be triggered by AI.
- The admin reservation detail page can request editable template additions only when both AI flags
  are enabled.
- The guarded server-side Ollama client is connected only to controlled content block generation.

Manual handling through the existing acceptance, decline and question workflow remains the only
operational path.

## Configuration

```env
AI_ENABLED=false
AI_DRAFTS_ENABLED=false
OLLAMA_BASE_URL=http://192.100.100.152:11434
OLLAMA_MODEL=qwen3:8b
AI_TIMEOUT_MS=120000
```

`OLLAMA_BASE_URL` and `OLLAMA_MODEL` are operational settings, not secrets. They are still kept
server-side and are not exposed through public routes.

## Technical Guardrails

The prepared server modules are deliberately narrow:

- `src/server/ai/schemas.ts` defines allowed content-block tasks, minimized reservation prompt input
  and strict AI response shape. Prompt input includes structured `specialRequests` policies with
  `safeFacts`, `neverSay`, allowed blocks, question categories and optional `baseContent`.
- `src/server/ai/prompts.ts` builds a German internal prompt and instructs the model to return JSON
  only. The `policy_polish` task tells Ollama to improve only readability and never change facts.
- `src/server/ai/ollama-client.ts` refuses to run when `AI_ENABLED=false`, uses a request timeout
  and validates both request and response. Ollama generation is capped to a short response, runs
  with thinking disabled and keeps the model warm for follow-up requests.
- `src/server/ai/reservation-drafts.ts` refuses draft generation unless both `AI_ENABLED` and
  `AI_DRAFTS_ENABLED` are enabled. It builds deterministic Gorms.res special-request blocks first,
  then optionally asks Ollama to polish those blocks. Timeout, invalid output, missing required
  policy facts or validation failure fall back to the deterministic Gorms.res block.
- `src/server/ai/content-validation.ts` separates blocking issues from warnings. Blocking issues
  prevent insertion into the form; warnings are shown as KI-Prüfhinweise and still require staff
  review before sending. Validation is decision-specific.
- `src/server/reservation-decisions.ts` builds the full outgoing acceptance, decline and question
  mails from fixed Gorms.res templates.
- `src/server/reservation-special-requests.ts` defines the Heidekönig special-request policies,
  safe guest blocks, staff notes, forbidden claims and combination logic.
- `app/admin/reservations/[id]/actions.ts` exposes AI only as a draft action. It returns text to the
  form and does not call SMTP, status updates or calendar generation.

The prompt input schema intentionally omits e-mail address, phone number, session data, SMTP
settings and audit internals.

If Ollama times out, returns invalid JSON or cannot be reached, the admin workflow falls back to the
safe Gorms.res standard template instead of leaving the page in a broken state. The fallback is
logged without guest message content.

For question drafts, recognized special requests are handled conservatively: Gorms.res inserts a
rule-based question only when a real clarification is useful, such as outdoor seating, non-reservable
tables, table wishes or baby/high-chair ambiguity. Notes such as dog, allergy or occasion do not
trigger free AI wording for questions; the workflow falls back to the neutral editable question
template.

Blocking validation covers guaranteed table, terrace, outdoor, quiet-area or availability claims,
invented phone numbers or e-mail addresses, concrete money amounts, placeholders, subject lines in
the content and broken template/signature hints. The fixed 100 Euro deposit amount is allowed only
when the validation context explicitly allows the Gorms.res deposit policy. General notes about
deposits, opening hours, special requests or cautious availability wording are warnings only.

Decision-specific blockers:

- Acceptance content must not say that the reservation is still non-binding, still needs staff
  review, or that a specific table/place has been chosen or reserved. The Gorms.res template already
  contains the actual personal confirmation.
- Question content must not use `Anmeldung`, must not present a table as available/suitable, and
  must not confirm a reservation.
- Common ASCII replacements such as `fuer`, `bestaetigen`, `Gruessen` or `Heidekoenig` are blocked
  so outgoing drafts use natural German umlauts.
- Copied guest wording such as `Wir würden gerne ...` is blocked because AI content must be a
  controlled operator note, not a pasted guest request.

Allowed examples:

- `Ihren Wunsch nach Tisch c1 haben wir notiert. Bitte haben Sie Verständnis, dass wir bestimmte Tische je nach Auslastung nicht verbindlich garantieren können.`
- `Bitte beachten Sie, dass bestimmte Tische nicht garantiert werden können.`

Blocked examples:

- `Ihre Reservierung ist noch nicht verbindlich.`
- `Tisch c1 wurde reserviert.`
- `Sie haben Tisch c1 gewählt.`
- `Tisch c1 ist verfügbar.`
- `Freuen uns auf Ihre Anmeldung.`

`AI_TIMEOUT_MS` defaults to 120 seconds because the first local model load can be noticeably slower
than warm follow-up requests.

## Admin Workflow

When both `AI_ENABLED=true` and `AI_DRAFTS_ENABLED=true`, staff can ask AI for a controlled content
block. Gorms.res inserts that block into the selected fixed template and then puts the complete
subject and body into the visible fields. The text is editable before sending.

The send button is still the only operation that sends e-mail or changes a reservation status. The
AI action cannot call that send path.

## Privacy Rules For Future Implementation

AI support must continue to follow these rules:

- Use a local Ollama endpoint only.
- Keep AI disabled unless the operator explicitly enables it.
- Keep drafting disabled unless the operator explicitly enables `AI_DRAFTS_ENABLED`.
- Do not send SMTP secrets, session tokens, audit internals or system configuration to AI.
- Minimize guest data in prompts. Prefer date, time, guest count and message context over full
  contact details.
- Never let AI send e-mails directly.
- Never let AI change reservation status directly.
- Never treat generated text as approved. Staff must review and edit it before sending.
- Require a staff member to review and submit every generated text.
- Log only the human action, not full generated or submitted guest content.

## Supported Assistant Tasks

The assistant may support controlled blocks for:

- acceptance special-request notes,
- short decline notes,
- concrete follow-up questions.

Every generated text must be editable before sending and must pass the existing server-side mail
workflow, permission checks and audit logging.

## Special-Request Policy Engine

Gorms.res evaluates guest messages and guest count with fixed Heidekönig rules. Each detected policy
can expose:

- a category and certainty,
- safe facts for Ollama,
- `neverSay` examples,
- allowed acceptance/question blocks,
- optional answer text,
- optional clarification questions,
- detected guest question categories such as `asks_outdoor_seating`, `asks_dog_allowed`,
  `asks_high_chair`, `asks_specific_table`, `asks_deposit`, `asks_allergy`, `asks_occasion` and
  `asks_accessibility`.

The structured context lets Ollama phrase a safe answer more naturally without deciding whether a
wish is feasible.

Current Heidekönig rules:

- Dogs are generally allowed and are only noted. Drafts must not say dogs are guaranteed no problem
  or always possible.
- High chairs are available, but not guaranteed. Baby/toddler wording can produce a follow-up
  question asking whether a high chair is needed.
- Outdoor area and terrace requests are not reservable. Reservations apply to the indoor area only;
  guests may use free outdoor tables on site in good weather.
- Reservable table wishes are `R*` and `C1` to `C9`; they are noted but never guaranteed.
- `A*` and `B*` table requests are not reservable.
- General table, quiet-place, window or favorite-seat requests are noted but never guaranteed.
- Allergies and intolerances are noted and must also be raised with staff on site. No medical safety
  promise is allowed.
- Birthdays, weddings, funerals, anniversaries or other occasions are noted only. Decoration,
  surprises or special services are not promised.
- From 30 guests, the fixed policy block states that a 100 Euro deposit is required. Below 30 guests,
  deposit questions may be answered with the fixed rule that deposits are required only from 30
  guests.

When multiple wishes are detected, the engine combines them by priority and keeps mandatory allergy
and deposit blocks. For three or more wishes, it uses a compact general note plus mandatory blocks
instead of stacking every possible sentence.

The admin detail page shows the stored manual review reasons from this policy engine. These notes
are staff guidance only; they do not decide, send or change status automatically.

## Policy Polish

Policy polish follows this order:

1. Gorms.res detects policies and builds a safe `baseContent` block.
2. Ollama receives `baseContent` plus structured policy context.
3. Ollama may only polish wording and combine allowed hints.
4. The polished block is validated with the same hard AI validation.
5. Required facts from the base text, such as `100 €`, `Innenbereich`, allergy on-site notes,
   A-/B-table rules or `nicht verbindlich`, must still be present.
6. If anything fails, the safe Gorms.res block is inserted.

Ollama therefore handles language only. Rules, final decision, send action and status changes remain
with Gorms.res and the staff member.
