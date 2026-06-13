import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for retention cleanup.");
}

function retentionValue(rows, key, fallback) {
  const value = rows.find((row) => row.key === key)?.value;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function cutoffDate(retentionDays, now = new Date()) {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
}

const anonymizedEmail = "anonymisiert@invalid.local";
const anonymizedText = "[anonymisiert]";

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
});

try {
  const settings = await pool.query(
    "select key, value from app_settings where key in ('reservation_retention_days', 'audit_log_retention_days')",
  );
  const reservationRetentionDays = retentionValue(
    settings.rows,
    "reservation_retention_days",
    Number(process.env.RESERVATION_RETENTION_DAYS || 30),
  );
  const auditLogRetentionDays = retentionValue(
    settings.rows,
    "audit_log_retention_days",
    Number(process.env.AUDIT_LOG_RETENTION_DAYS || 90),
  );
  const reservationCutoff = cutoffDate(reservationRetentionDays);
  const auditLogCutoff = cutoffDate(auditLogRetentionDays);

  const client = await pool.connect();

  try {
    await client.query("begin");

    const oldReservations = await client.query(
      "select id from reservation_requests where created_at < $1",
      [reservationCutoff],
    );
    const oldReservationIds = oldReservations.rows.map((row) => row.id);

    const reservations = await client.query(
      `
        update reservation_requests
        set guest_name = 'Anonymisiert',
            guest_email = $2,
            guest_phone = $3,
            message = null,
            updated_at = now()
        where id = any($1::uuid[])
          and guest_email <> $2
        returning id
      `,
      [oldReservationIds, anonymizedEmail, anonymizedText],
    );
    let outgoingEmailsAnonymized = 0;
    let auditLogsScrubbed = 0;

    if (oldReservationIds.length > 0) {
      const outgoingEmails = await client.query(
        `
          update reservation_outgoing_emails
          set recipient = $2,
              subject = $3,
              body = $3,
              smtp_error = null
          where reservation_request_id = any($1::uuid[])
            and (
              recipient <> $2
              or subject <> $3
              or body <> $3
              or smtp_error is not null
            )
          returning id
        `,
        [oldReservationIds, anonymizedEmail, anonymizedText],
      );

      outgoingEmailsAnonymized = outgoingEmails.rowCount;

      const scrubbedAuditLogs = await client.query(
        `
          update audit_log
          set metadata = $2::jsonb
          where entity_type = 'reservation_request'
            and entity_id = any($1::text[])
            and metadata->>'retention' is distinct from 'reservation metadata scrubbed'
          returning id
        `,
        [
          oldReservationIds,
          JSON.stringify({
            reservationRetentionDays,
            retention: "reservation metadata scrubbed",
          }),
        ],
      );

      auditLogsScrubbed = scrubbedAuditLogs.rowCount;
    }

    const auditLogs = await client.query(
      "delete from audit_log where created_at < $1 returning id",
      [auditLogCutoff],
    );

    await client.query(
      "insert into audit_log (action, entity_type, entity_id, metadata) values ($1, $2, $3, $4::jsonb)",
      [
        "retention.cleanup",
        "system",
        "retention",
        JSON.stringify({
          auditLogRetentionDays,
          auditLogsDeleted: auditLogs.rowCount,
          auditLogsScrubbed,
          outgoingEmailsAnonymized,
          reservationRetentionDays,
          reservationsAnonymized: reservations.rowCount,
        }),
      ],
    );

    await client.query("commit");

    console.log(
      [
        "Retention cleanup completed.",
        `Reservations anonymized: ${reservations.rowCount}`,
        `Outgoing emails anonymized: ${outgoingEmailsAnonymized}`,
        `Audit logs scrubbed: ${auditLogsScrubbed}`,
        `Audit logs deleted: ${auditLogs.rowCount}`,
        `Reservation cutoff: ${reservationCutoff.toISOString()}`,
        `Audit log cutoff: ${auditLogCutoff.toISOString()}`,
      ].join("\n"),
    );
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
