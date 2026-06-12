# E-Mail Flow

## Internal Notification

For every valid reservation request, the app sends an internal e-mail to the configured notification
address. Default:

```env
RESERVATION_NOTIFICATION_EMAIL=Welcome@der-heidekoenig.de
```

The internal e-mail includes:

- date and time
- guest count
- name
- e-mail
- phone
- optional message
- stored Gorms.res availability status
- accepted and pending guest counts in the overlapping time window
- capacity, time window, season and latest reservation time
- warnings and manual review reasons
- direct admin detail link
- clear note that this is only a request
- `.ics` calendar attachment

The initial internal notification is recorded in the reservation mail history as
`staff_notification`. The guest receipt is recorded as `guest_receipt`. Failed SMTP attempts are
stored as `failed` when the message content could be built.

## Guest Receipt

The guest receives an automatic receipt e-mail. It must not sound like a confirmed reservation. It
states that the reservation is valid only after personal confirmation.

## Decision Workflow

Admins and employees can send an acceptance, decline, or question from the reservation detail page.
Acceptance and decline update the reservation status only after the guest e-mail was sent
successfully. Questions leave the status unchanged.

When an acceptance succeeds, the app sends an additional internal confirmation e-mail to
`RESERVATION_NOTIFICATION_EMAIL`. This internal e-mail includes a second `.ics` attachment with
calendar status `CONFIRMED`. Guest-facing `.ics` files are intentionally not sent in V1.1.

If the internal confirmation e-mail fails after the guest acceptance was already sent, the
reservation remains accepted. The failed internal message is recorded in the reservation mail
history for follow-up.

## SMTP

Defaults target IONOS:

```env
SMTP_HOST=smtp.ionos.de
SMTP_PORT=587
SMTP_PROVIDER=ionos
```

SMTP can be configured in the admin panel. The SMTP password is never displayed after saving.

## Subject Templates

Supported variables:

- `{{date}}`
- `{{time}}`
- `{{guestName}}`
- `{{guestCount}}`
- `{{phone}}`
- `{{email}}`

Default internal subject:

```text
Neue Reservierungsanfrage: {{date}} um {{time}} - {{guestName}} - {{guestCount}} Personen
```

Default guest subject:

```text
Ihre Reservierungsanfrage bei der Waldwirtschaft Heidekönig
```
