# Authentication And Roles

## Authentication

The app uses e-mail/password login for the admin host. Passwords are hashed with Argon2id.

Sessions are stored server-side and referenced by an HTTP-only cookie. The session cookie must be
host-only for `login.gorms.de`; do not configure `.gorms.de`.

## Setup Admin

The first admin is created by the setup wizard. The wizard requires `SETUP_TOKEN`, runs only on the
admin host, and disables itself after setup is complete.

## Roles

### `admin`

Permissions:

- read reservation requests
- send acceptance, decline and question e-mails
- use controlled manual reservation status override with a required reason
- manage blocked days
- manage opening hours
- manage app settings
- manage SMTP settings
- manage branding
- manage users
- read system/security information

### `mitarbeiter`

Permissions:

- read reservation requests
- send acceptance, decline and question e-mails
- use controlled manual reservation status override with a required reason
- manage blocked days
- manage opening hours

Employees cannot manage SMTP, users, roles, branding or security-critical settings.

## User Deactivation

Inactive users cannot log in. Password resets invalidate existing sessions for the affected user.
