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

The reservation overview also exposes a controlled manual status override as a special case for
admins and employees. This path requires a written reason, writes an audit-log entry and sends no
guest e-mail. It should be used only when the normal acceptance, decline or question workflow does
not fit an operational correction.

If a guest message contains recognizable special-request wording, the detail page shows a
"Sonderwunsch erkannt" warning. The wording comes from the Gorms.res special-request policy engine
and includes operational notes such as dog noted, outdoor area not reservable, A-/B-table not
reservable, allergy to check on site, or deposit required from 30 guests. This is a staff review hint
only; it does not decide, send or change anything automatically.

The detail page also provides internal `.ics` downloads:

- Anfrage-ICS: available for every request.
- Bestätigungs-ICS: available after the request was accepted.

These files contain guest contact data and are intended for internal use only.

The KI-Assistenz area can create editable text drafts only when both `AI_ENABLED=true` and
`AI_DRAFTS_ENABLED=true` are configured on the server. Generated text is inserted into the visible
subject and e-mail body fields only. It cannot send e-mails, create calendar files or change status
values. Staff must review and submit every message manually.

## Blocked Days

Admins and employees can add or remove blocked days. Blocked days are enforced server-side for
public reservation requests.

The same area also manages music and event days. Event days are blocked for normal public
reservation requests by default. The public note is shown in the guest form when the selected date
is unavailable. Enable "Normale Reservierungsanfragen erlauben" only when the event should not
block normal requests.

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
