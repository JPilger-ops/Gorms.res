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
- clear note that this is only a request
- `.ics` calendar attachment

## Guest Receipt

The guest receives an automatic receipt e-mail. It must not sound like a confirmed reservation. It
states that the reservation is valid only after personal confirmation.

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
