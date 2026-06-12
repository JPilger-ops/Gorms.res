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

    const reservations = await client.query(
      `
        update reservation_requests
        set guest_name = 'Anonymisiert',
            guest_email = $2,
            guest_phone = $3,
            message = null,
            updated_at = now()
        where created_at < $1
          and guest_email <> $2
        returning id
      `,
      [reservationCutoff, anonymizedEmail, anonymizedText],
    );
    let outgoingEmailsAnonymized = 0;

    if (reservations.rows.length > 0) {
      const reservationIds = reservations.rows.map((row) => row.id);
      const outgoingEmails = await client.query(
        `
          update reservation_outgoing_emails
          set recipient = $2,
              subject = $3,
              body = $3,
              smtp_error = null
          where reservation_request_id = any($1::uuid[])
          returning id
        `,
        [reservationIds, anonymizedEmail, anonymizedText],
      );

      outgoingEmailsAnonymized = outgoingEmails.rowCount;
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
