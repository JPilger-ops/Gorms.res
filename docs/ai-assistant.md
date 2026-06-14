# AI Assistant

The reservation app supports a local Ollama-based assistant for internal drafting support. It is
disabled by default and must be explicitly enabled by the operator.

## Current Status

- `AI_ENABLED=false` by default.
- `AI_DRAFTS_ENABLED=false` by default.
- No reservation data is sent to Ollama unless the operator explicitly sets both
  `AI_ENABLED=true` and `AI_DRAFTS_ENABLED=true`.
- Response drafts are generated only after a staff member clicks the KI draft button.
- No status changes, e-mails or calendar files can be triggered by AI.
- The admin reservation detail page can request editable templates only when both AI flags are
  enabled.
- The guarded server-side Ollama client is connected only to template generation.

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

- `src/server/ai/schemas.ts` defines allowed tasks, minimized reservation prompt input and strict
  AI response shape.
- `src/server/ai/prompts.ts` builds a German internal prompt and instructs the model to return JSON
  only.
- `src/server/ai/ollama-client.ts` refuses to run when `AI_ENABLED=false`, uses a request timeout
  and validates both request and response.
- `src/server/ai/reservation-drafts.ts` refuses draft generation unless both `AI_ENABLED` and
  `AI_DRAFTS_ENABLED` are enabled.
- `src/server/ai/content-validation.ts` separates blocking issues from warnings. Blocking issues
  prevent insertion into the form; warnings are shown as KI-Prüfhinweise and still require staff
  review before sending.
- `app/admin/reservations/[id]/actions.ts` exposes AI only as a draft action. It returns text to the
  form and does not call SMTP, status updates or calendar generation.

The prompt input schema intentionally omits e-mail address, phone number, session data, SMTP
settings and audit internals.

Blocking validation covers guaranteed table, terrace, outdoor, quiet-area or availability claims,
invented phone numbers or e-mail addresses, concrete money amounts, placeholders, subject lines in
the body and broken template/signature hints. General notes about deposits, opening hours, special
requests or cautious availability wording are warnings only.

`AI_TIMEOUT_MS` defaults to 120 seconds because the first local model load can be noticeably slower
than warm follow-up requests.

## Admin Workflow

When both `AI_ENABLED=true` and `AI_DRAFTS_ENABLED=true`, staff can insert a generated template
into the visible subject and body fields on the reservation detail page. The text is editable before
sending.

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

The assistant may support:

- summarizing the request for internal staff,
- drafting an acceptance,
- drafting a decline,
- drafting a follow-up question.

Every generated text must be editable before sending and must pass the existing server-side mail
workflow, permission checks and audit logging.
