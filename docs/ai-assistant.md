# AI Assistant Preparation

The reservation app contains a disabled preparation layer for a future local AI assistant. The
assistant is intended for internal drafting support only and is not active in this version.

## Current Status

- `AI_ENABLED=false` by default.
- No reservation data is sent to Ollama.
- No response drafts are generated.
- No status changes, e-mails or calendar files can be triggered by AI.
- The admin reservation detail page shows only a disabled placeholder.

Manual handling through the existing acceptance, decline and question workflow remains the only
operational path.

## Configuration

```env
AI_ENABLED=false
OLLAMA_BASE_URL=http://vault.local:11434
OLLAMA_MODEL=qwen3:8b
AI_TIMEOUT_MS=30000
```

`OLLAMA_BASE_URL` and `OLLAMA_MODEL` are operational settings, not secrets. They are still kept
server-side and are not exposed through public routes.

## Privacy Rules For Future Implementation

Future AI support must follow these rules:

- Use a local Ollama endpoint only.
- Keep AI disabled unless the operator explicitly enables it.
- Do not send SMTP secrets, session tokens, audit internals or system configuration to AI.
- Minimize guest data in prompts. Prefer date, time, guest count and message context over full
  contact details.
- Never let AI send e-mails directly.
- Never let AI change reservation status directly.
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
