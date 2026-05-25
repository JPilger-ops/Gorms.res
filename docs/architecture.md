# Architecture

## Overview

```text
Internet
  -> Existing reverse proxy in separate VLAN
  -> Next.js app container on port 6043
  -> internal Docker network
  -> PostgreSQL container
```

The app is deployed behind an existing reverse proxy. TLS terminates at the reverse proxy. The app
itself listens over internal HTTP on port `6043`.

## Runtime Services

- `app`: Next.js standalone production server
- `db`: self-hosted PostgreSQL
- `backup`: optional profile service for `pg_dump` and upload archives

## Networks

- `heidekoenig_app`: app-facing network for reverse-proxy or host-port access
- `heidekoenig_internal`: internal Docker network for app/database/backup

PostgreSQL joins only the internal network. No database port is published.

## Request Boundaries

The reverse proxy routes both public and admin hosts to the same app endpoint. The application then
checks the `Host` and forwarded host headers server-side:

- public hosts serve guest reservation pages and public actions
- admin hosts serve setup, login and admin actions

Origin checks add an additional server-side protection for mutating actions.

## Data Boundaries

Reservation data, users, sessions, settings and audit logs live in PostgreSQL. Uploads such as logo
and favicon live in the Docker upload volume. Generated encryption key material lives in the Docker
secret volume.

Backups are written to an operator-mounted NFS path. The app does not mount NFS itself.
