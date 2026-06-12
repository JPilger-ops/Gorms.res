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

The reservation overview links to a detail page for each request. The detail page shows contact
data, the stored availability snapshot, outgoing mail history and the response workflow.

Admins and employees can send an acceptance, decline or question from the detail page. Acceptance
and decline change the status only after the guest e-mail was sent successfully. Questions keep the
request pending.

The detail page also provides internal `.ics` downloads:

- Anfrage-ICS: available for every request.
- Bestätigungs-ICS: available after the request was accepted.

These files contain guest contact data and are intended for internal use only.

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
