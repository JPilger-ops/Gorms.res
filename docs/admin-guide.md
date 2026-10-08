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

## Venue Context

Admin pages preserve the explicit `?venue=<UUID>` query in links and forms. A cookie is only a
start preference. Two tabs can independently use Heidekoenig and Telegraph. Missing/contradictory
form context is rejected rather than changing the wrong venue. Users/sessions and security remain
global; role checks still apply to every action.

Admins can select Telegraph after migration 0004. Its navigation contains Tischplan, global users
and system/security, not Heidekoenig's CAPACITY workflows. Employees have no TABLES/editor access.
The selector appears only when multiple supported active venues exist.

## Telegraph Table Plan

Open Tischplan, select/create an area, then Bearbeiten. Tische, Kombinationen and Grundriss provide
separate compact controls. Capacity and wheelchair suitability are set explicitly, not inferred
from table geometry or combinations. Saved resources are archived rather than deleted; rename
before restoring if another live resource now uses that name.

Save explicitly. Verwerfen loads the latest saved plan but leaves editing open. Undo/redo operates
only on the local draft. A changed plan revision causes a conflict message and retains your draft;
inspect/reload rather than overwriting someone else's edit. Images with a new aspect ratio require
preview confirmation and manual review of positions against the new building.

This editor does not assign reservations or enable Telegraph public booking. See
[Table Plan](table-plan.md) for full workflow, bounds, permissions and backup/cleanup requirements.
