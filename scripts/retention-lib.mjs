import { positiveInteger, reservationRetentionDays } from "../src/lib/venue-defaults.mjs";

export async function cleanupRetention(
  pool,
  {
    now = new Date(),
    venueId,
    userId,
    reservationFallback = process.env.RESERVATION_RETENTION_DAYS,
    auditFallback = process.env.AUDIT_LOG_RETENTION_DAYS,
  } = {},
) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const venues = await client.query(
      "select v.id, s.value from venues v left join venue_settings s on s.venue_id = v.id and s.key = 'reservation_retention_days' where ($1::uuid is null or v.id = $1) order by v.slug",
      [venueId ?? null],
    );
    if (venueId && !venues.rows.length) throw new Error("Venue is not available.");
    const auditSetting = await client.query(
      "select value from app_settings where key = 'audit_log_retention_days'",
    );
    const auditDays = positiveInteger(
      auditSetting.rows[0]?.value,
      positiveInteger(auditFallback, 90),
    );
    const auditLogCutoff = new Date(now.getTime() - auditDays * 86400000);
    const result = {
      auditLogCutoff,
      auditLogsDeleted: 0,
      auditLogsScrubbed: 0,
      outgoingEmailsAnonymized: 0,
      reservationsAnonymized: 0,
      venueResults: [],
    };
    for (const venue of venues.rows) {
      const days = reservationRetentionDays(venue.id, venue.value, reservationFallback);
      const cutoff = new Date(now.getTime() - days * 86400000);
      const old = await client.query(
        "select id from reservation_requests where venue_id = $1 and created_at < $2",
        [venue.id, cutoff],
      );
      const ids = old.rows.map((row) => row.id);
      const reservations = await client.query(
        "update reservation_requests set guest_name = 'Anonymisiert', guest_email = 'anonymisiert@invalid.local', guest_phone = '[anonymisiert]', message = null, updated_at = $2 where id = any($1::uuid[]) and guest_email <> 'anonymisiert@invalid.local' returning id",
        [ids, now],
      );
      const emails = await client.query(
        "update reservation_outgoing_emails set recipient = 'anonymisiert@invalid.local', subject = '[anonymisiert]', body = '[anonymisiert]', smtp_error = null where reservation_request_id = any($1::uuid[]) and (recipient <> 'anonymisiert@invalid.local' or subject <> '[anonymisiert]' or body <> '[anonymisiert]' or smtp_error is not null) returning id",
        [ids],
      );
      const audit = await client.query(
        "update audit_log set metadata = $2::jsonb where entity_type = 'reservation_request' and entity_id = any($1::text[]) and metadata->>'retention' is distinct from 'reservation metadata scrubbed' returning id",
        [
          ids,
          JSON.stringify({
            reservationRetentionDays: days,
            retention: "reservation metadata scrubbed",
          }),
        ],
      );
      result.reservationsAnonymized += reservations.rowCount;
      result.outgoingEmailsAnonymized += emails.rowCount;
      result.auditLogsScrubbed += audit.rowCount;
      result.venueResults.push({
        venueId: venue.id,
        reservationRetentionDays: days,
        reservationCutoff: cutoff,
        reservationsAnonymized: reservations.rowCount,
      });
    }
    const deleted = await client.query("delete from audit_log where created_at < $1 returning id", [
      auditLogCutoff,
    ]);
    result.auditLogsDeleted = deleted.rowCount;
    await client.query(
      "insert into audit_log (venue_id, user_id, action, entity_type, entity_id, metadata) values ($1, $2, 'retention.cleanup', 'system', 'retention', $3::jsonb)",
      [
        venueId ?? null,
        userId ?? null,
        JSON.stringify({
          auditLogRetentionDays: auditDays,
          auditLogsDeleted: result.auditLogsDeleted,
          auditLogsScrubbed: result.auditLogsScrubbed,
          outgoingEmailsAnonymized: result.outgoingEmailsAnonymized,
          reservationsAnonymized: result.reservationsAnonymized,
          venues: result.venueResults.map(({ venueId, reservationRetentionDays }) => ({
            venueId,
            reservationRetentionDays,
          })),
        }),
      ],
    );
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
