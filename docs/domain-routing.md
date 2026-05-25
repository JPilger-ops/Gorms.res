# Domain Routing

## Domains

Public guest site:

```text
https://heidekönig.gorms.de
https://xn--heideknig-57a.gorms.de
```

Admin, login and setup:

```text
https://login.gorms.de
```

## Punycode Verification

The Unicode domain is:

```text
heidekönig.gorms.de
```

Its Punycode/ASCII form is:

```text
xn--heideknig-57a.gorms.de
```

This was verified with Node's `domainToASCII` / `domainToUnicode` functions.

## Environment

Use these values on the production server:

```env
NEXT_PUBLIC_SITE_URL=https://heidekönig.gorms.de
PUBLIC_HOST=heidekönig.gorms.de
PUBLIC_ALLOWED_HOSTS=heidekönig.gorms.de,xn--heideknig-57a.gorms.de

ADMIN_APP_URL=https://login.gorms.de
ADMIN_HOST=login.gorms.de
ADMIN_ALLOWED_HOSTS=login.gorms.de

ADMIN_SESSION_COOKIE_NAME=heidekoenig_admin_session
ADMIN_COOKIE_DOMAIN=
```

Keep `ADMIN_COOKIE_DOMAIN` empty. Admin session cookies are host-only and must not be set for
`.gorms.de`.

## Application Host Rules

The app checks hosts server-side:

- `app/page.tsx` and `/reservieren` require a public host
- public reservation server actions require a public host and matching Origin
- `/login`, `/setup`, `/admin` and admin actions require the admin host and matching Origin
- setup is disabled after setup completion or when an admin already exists

Allowed public hosts are normalized to both Unicode and ASCII/Punycode forms.

## Route Matrix

```text
Route                 heidekönig.gorms.de / Punycode   login.gorms.de
/                     allowed                          blocked/not found
/reservieren          allowed                          blocked/not found
/login                blocked/not found                allowed
/setup                blocked/not found                allowed while setup is incomplete
/admin                blocked/not found                allowed with valid admin session
/branding/*          allowed                          allowed
/_next/*              allowed                          allowed
```

`/branding/*` is shared because logo and favicon may be needed on both public and admin hosts.

## Reverse Proxy Expectations

The reverse proxy must route by hostname and preserve the original host. If it forwards only the
internal app-host IP as `Host`, the app will reject routes because the hostname checks cannot match.

Required behavior:

- preserve `Host` or set `X-Forwarded-Host` to the external hostname
- set `X-Forwarded-Proto=https`
- pass `Origin` unchanged
- do not rewrite public and admin hosts to a single internal hostname

## Cookie Boundary

Admin cookies are set without a `Domain` attribute. This makes them host-only for `login.gorms.de`.

Do not configure:

```text
Domain=.gorms.de
```

The public reservation host must not receive or require admin cookies.
