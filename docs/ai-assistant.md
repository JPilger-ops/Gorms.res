# AI Assistant Preparation

The reservation app contains a disabled preparation layer for a future local AI assistant. The
assistant is intended for internal drafting support only and is not active in this version.

## Current Status

- `AI_ENABLED=false` by default.
- No reservation data is sent to Ollama.
- No response drafts are generated unless the operator explicitly sets `AI_ENABLED=true`.
- No status changes, e-mails or calendar files can be triggered by AI.
- The admin reservation detail page can request editable templates only when `AI_ENABLED=true`.
- A guarded server-side Ollama client exists, but it is only connected to template generation.

Manual handling through the existing acceptance, decline and question workflow remains the only
operational path.

## Configuration

```env
AI_ENABLED=false
OLLAMA_BASE_URL=http://vault.local:11434
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
- `app/admin/reservations/[id]/actions.ts` exposes AI only as a draft action. It returns text to the
  form and does not call SMTP, status updates or calendar generation.

The prompt input schema intentionally omits e-mail address, phone number, session data, SMTP
settings and audit internals.

`AI_TIMEOUT_MS` defaults to 120 seconds because the first local model load can be noticeably slower
than warm follow-up requests.

## Admin Workflow

When `AI_ENABLED=true`, staff can insert a generated template into the visible subject and body
fields on the reservation detail page. The text is editable before sending.

The send button is still the only operation that sends e-mail or changes a reservation status. The
AI action cannot call that send path.

## Privacy Rules For Future Implementation

Future AI support must follow these rules:

- Use a local Ollama endpoint only.
- Keep AI disabled unless the operator explicitly enables it.
- Do not send SMTP secrets, session tokens, audit internals or system configuration to AI.
- Minimize guest data in prompts. Prefer date, time, guest count and message context over full
  contact details.
- Never let AI send e-mails directly.
- Never let AI change reservation status directly.
- Never treat generated text as approved. Staff must review and edit it before sending.
- Require a staff member to review and submit every generated text.
- Log only the human action, not full generated or submitted guest content.

## Planned Assistant Tasks

The future assistant may support:

- summarizing the request for internal staff,
- drafting an acceptance,
- drafting a decline,
- drafting a follow-up question.

Every generated text must be editable before sending and must pass the existing server-side mail
workflow, permission checks and audit logging.
