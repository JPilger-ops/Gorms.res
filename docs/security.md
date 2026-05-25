# Security

## Host Separation

The app is hostname-aware:

- Public hosts: `heidekönig.gorms.de`, `xn--heideknig-57a.gorms.de`
- Admin host: `login.gorms.de`

Public actions are accepted only on public hosts. Admin, login and setup actions are accepted only on the admin host.

Server-side checks validate both:

- request host / forwarded host
- `Origin` header when present

Reverse-proxy blocks are still recommended as an additional security layer.

## Rate Limiting

The app applies in-memory rate limits to:

- reservation requests
- login attempts
- setup attempts
- SMTP test mails

Rate-limit keys are hashed before storage. Raw IP addresses are not persisted.

## Honeypot

The public reservation form contains a hidden honeypot field. Submissions with this field filled are rejected by schema validation.

## Authentication

- Passwords are hashed with Argon2id.
- Sessions are stored server-side.
- Session cookies are HTTP-only.
- Cookies are host-only and must not use `.gorms.de`.
- Disabled users cannot log in.
- Password resets invalidate existing sessions of the affected user.

## Audit Log

Security-relevant actions are recorded without personal reservation details:

- successful login
- failed login
- login rate limit
- setup failures
- setup rate limit
- user and role changes
- SMTP settings updates
- branding changes
- retention cleanup

## Security Headers

The app sets baseline headers through Next.js:

- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy`
- `Permissions-Policy`

## Secrets

SMTP passwords are encrypted before database storage. The encryption key is either:

- supplied by `APP_ENCRYPTION_KEY`, or
- generated into `/app/secrets/app_encryption_key`

The generated key is stored in the Docker volume `heidekoenig_secrets`. Losing this volume means encrypted SMTP passwords must be re-entered.
