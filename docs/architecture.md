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

## Multi-Venue Foundation

Phase 1 introduces explicit `VenueContext` boundaries without replacing the existing UI or CAPACITY
algorithm. Reservation requests, event days, blocked dates, business settings, SMTP and branding are
venue-scoped; snapshots and mail history inherit their venue through the reservation. Users, roles,
sessions, setup and audit retention remain global. TABLES availability is explicitly unsupported.

See [Multi-Venue Foundation](multi-venue.md) for ownership, host resolution, migration and known risks.

## Table Plan Domain

Phase 2 adds an admin-only Telegraph table-plan domain: versioned areas, physical tables,
separate geometry, relational combinations and private immutable floorplans. The saved viewer
is lightweight; only editing loads Konva. Full-plan writes use a bounded, same-origin multipart
route, area locks and 409 revision conflicts. Capabilities gate both navigation and server access.
Admin context is URL-bound so tabs do not share mutable venue context. Cleanup/backup share a
DB lock to protect current image files. No TABLES booking or resource assignment is implemented.
See [Table Plan](table-plan.md).
