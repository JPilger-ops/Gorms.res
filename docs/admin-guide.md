# Admin Guide

## Login

Use:

```text
https://login.gorms.de/login
```

Admin, login and setup routes are intentionally unavailable on the public guest host.

## Navigation

Admins see:

- Dashboard
- Reservierungsanfragen
- Blockierte Tage
- Öffnungszeiten
- Einstellungen
- Benutzerverwaltung
- System / Sicherheit

Employees see:

- Dashboard
- Reservierungsanfragen
- Blockierte Tage
- Öffnungszeiten

## Reservation Requests

The reservation overview shows incoming requests and contact details for manual follow-up. Version
1 does not require staff to confirm reservations inside the app.

## Blocked Days

Admins and employees can add or remove blocked days. Blocked days are enforced server-side for
public reservation requests.

## Opening Hours

Admins and employees can update earliest/latest reservation times.

## Settings

Admins can update business rules, notification recipient, subject templates, privacy text and
retention values.

## SMTP

Admins can update SMTP host, port, user, sender and password. Existing SMTP passwords are never
shown; the UI only lets admins replace the password.

## Users

Admins can create, edit, deactivate and reset passwords for users. Deactivated users cannot log in.
