# Product Requirements

## Product Goal

The app accepts reservation requests for Waldwirtschaft Heidekoenig outdoor seating. It is not a
fully automated booking system. Staff manually confirm or decline every request outside the public
guest flow.

The public confirmation copy must keep this distinction clear:

```text
Vielen Dank fuer Ihre Anfrage. Die Reservierung ist erst nach unserer persoenlichen Bestaetigung gueltig.
```

## Guest Workflow

Guests can submit:

- requested date
- requested time
- guest count
- name
- e-mail address
- phone number
- optional message
- privacy acknowledgement

The request is rejected server-side when the date is blocked, the data is invalid, or privacy
acknowledgement is missing.

## Blocking Rules

The public form blocks:

- Sundays, when enabled
- German public holidays for Nordrhein-Westfalen
- manually blocked days
- dates in the past
- times outside configured opening hours
- guest counts outside configured limits

The current default holiday configuration is:

```env
HOLIDAY_COUNTRY=DE
HOLIDAY_STATE=NW
```

## Staff Workflow

Staff receive an internal e-mail with request details and an `.ics` attachment. Guests receive an
automatic receipt e-mail that confirms only that the request was received.

Version 1 prepares status values but does not require staff to accept or decline reservations in the
app.

## Admin Workflow

Admins can manage:

- reservation request overview
- blocked days
- opening hours
- users and roles
- general settings
- SMTP settings
- branding
- retention cleanup
- security/system information

Employees can manage:

- reservation request overview
- blocked days
- opening hours

## Non-Goals

- no public availability calendar
- no automatic reservation confirmation
- no payment flow
- no analytics or marketing tracking
- no external hosted database dependency
