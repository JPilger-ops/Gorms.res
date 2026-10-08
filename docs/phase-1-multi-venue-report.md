# Phase 1: Multi-Venue Abschlussbericht

Stand: 8. Oktober 2026. Umsetzung im Entwicklungsrepository; kein Commit, kein Push und
kein Deployment. Die laufende Installation, deren Datenbank, NAS und echte SMTP-/KI-Dienste
wurden nicht fuer Tests verwendet. Die temporaeren Testcontainer und Netzwerke wurden entfernt.

## Ergebnis

Die freigegebene Multi-Venue-Grundlage ist umgesetzt. Nur Waldwirtschaft Heidekönig wird
angelegt: UUID `00000000-0000-4000-8000-000000000001`, Slug `heidekoenig`,
Zeitzone `Europe/Berlin`, Strategie `CAPACITY`. `TABLES` ist lediglich ein reservierter Enum-Wert;
die Strategie wird ausdruecklich abgewiesen und niemals durch CAPACITY ersetzt.

Die Serverfunktionen fuer Settings, Branding, Regeln, Verfuegbarkeit, Anfragen, Dashboard,
Sperrtage, Events, Entscheidungen, Mailhistorie, KI und ICS verlangen einen `VenueContext`.
Einzelzugriffe und Schreibaktionen pruefen Anfrage-ID und Betrieb. Fremde IDs fuehren weder
zu Datenauslieferung noch zu KI-Aufrufen oder SMTP-Versand.

Authentifizierung, Benutzer, Rollen, Sessions und Setup bleiben global. Autorisierte Mitarbeiter
koennen alle unterstuetzten aktiven Betriebe bearbeiten; betriebsbezogene Benutzerrechte sind
nicht Bestandteil dieser Phase. Der bestehende Admin zeigt eine Betriebsauswahl erst bei
mehreren aktiven CAPACITY-Betrieben. Formulare tragen den dargestellten Betrieb; fehlender,
manipulierter oder durch einen anderen Tab veralteter Kontext wird serverseitig abgewiesen.

KI bleibt eine editierbare Entwurfshilfe ohne automatische Entscheidungen oder Versand.
Mailtexte, Sonderwunschregeln und Statusablaeufe bleiben bestehen. Die Statusaenderung erfolgt
weiterhin erst nach erfolgreichem Versand der Gastmail. Keine Telegraph-Logik, Tischplanung,
PWA, Gast-ICS oder sonstige Folgefeatures wurden eingefuehrt.

## Migration Und Backfill

Neue Migration: `db/migrations/0003_multi_venue_foundation.sql`, mit eigenem Drizzle-Snapshot
und Journal-Eintrag. Die bisherigen Migrationen und Snapshots bleiben unveraendert.

Die Migration erstellt `venues`, `venue_hosts`, `venue_settings` und die Strategie-Enumeration.
Anfragen, Sperrtage und eigenstaendige Veranstaltungstage erhalten verpflichtende
`venue_id`-Fremdschluessel. Bestehende Datensaetze werden Heidekoenig zugeordnet. Inhalte,
IDs, Status und bisherige Zeitstempel bleiben erhalten. Sperrtage sind jetzt pro
`(venue_id, date)` eindeutig; neue Indizes unterstuetzen betriebsbezogene Abfragen.

Veranstaltungstage besitzen keine Verknuepfung zu Reservierungen. Ihre eigene `venue_id`
ist daher die einzige Quelle ihrer Betriebszuordnung. Verfuegbarkeits-Snapshots und
ausgehende Mails erben den Betrieb ausschliesslich ueber die Anfrage; sie erhalten keine
redundante Betriebs-ID. Betriebliche Audit-Eintraege bekommen einen optionalen Kontext;
bestehende Audit-Metadaten bleiben unveraendert.

37 bekannte Settings-Schluessel werden samt Wert, Secret-Kennzeichen, Bearbeiter und
Aenderungszeit nach `venue_settings` uebertragen und in derselben Migration aus `app_settings`
entfernt. Ciphertext wird weder neu verschluesselt noch veraendert. Setup-Status und
Audit-Aufbewahrung bleiben global; unbekannte Settings werden nicht entfernt.
Infrastruktur-Secrets, Ollama und Backups bleiben Deployment-Konfiguration.

Alle unterstuetzten Migrationswege benutzen `scripts/migrate.mjs`. Nach der SQL-Migration
importiert der Runner die bestehenden ENV-Public-Hosts einmalig nach Heidekoenig.
Unicode/Punycode werden auf denselben ASCII-Host normalisiert. Import und Abschlussmarker
sind transaktional und per Advisory Lock serialisiert. Konflikte setzen keinen Marker;
ein erneuter Aufruf ist nach Korrektur sicher moeglich. Spaetere Laeufe ueberschreiben keine
Zuordnungen. Der dokumentierte Domain-CLI lehnt Admin-Hosts und widerspruechliche Zuordnungen ab.

Public-Auslieferung braucht sowohl ENV-Allowlist als auch eine aktive Datenbankzuordnung.
Origin muss zum selben Betrieb gehoeren. Unbekannte, unzugeordnete oder inaktive Hosts werden
abgewiesen. Forwarded-Host-Pruefung bleibt erhalten; der Reverse Proxy muss diese Header
bereinigen und der App-Port darf nur aus vertrauenswuerdigen Netzen erreichbar sein.

Die Reservierungsaufbewahrung bleibt: gueltiger DB-Wert, sonst bisheriger Heidekoenig-ENV-Wert,
sonst 30 Tage. Andere Betriebe bekommen ohne eigenen Wert 30 Tage und keine Heidekoenig-
SMTP-Zugangsdaten aus ENV. DB-Wert 30 bleibt auch bei ENV-Wert 90 erhalten. Audit-Aufbewahrung
wird niemals als Reservierungsaufbewahrung verwendet. Server und Runtime-CLI nutzen dieselbe
Cleanup-Implementierung, auch fuer inaktive Betriebe. Bestehende Anonymisierung von Anfragen,
Mailhistorie und Audit-Metadaten bleibt erhalten; keine Umstellung auf vollstaendige Loeschung.

## Ausgefuehrte Pruefungen

Die eigentlichen Node-/Next-/TypeScript-Pruefungen liefen unter Node 22 in Docker.
PostgreSQL 17 lief ausschliesslich in separaten, temporaeren Datenbanken ohne veroeffentlichte
Ports oder Deployment-/NAS-Volumes. Die Testumgebung ignoriert die Betreiber-`.env`.

| Pruefung                                                                                                               | Ergebnis                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:venue-foundation`                                                                                        | Erfolgreich: Hostnormalisierung, Retention, Strategien, vier Serverzeitzonen, Mitternacht, NRW-Feiertage, Sommer-/Winterzeit und ICS.    |
| `npm run test:multi-venue`                                                                                             | Erfolgreich: Bestandsmigration, Neuinstallation, Isolation, Cleanup und lokaler SMTP-Workflow.                                           |
| `MULTI_VENUE_WEB_TEST=true MULTI_VENUE_TEST_IMAGE=mcr.microsoft.com/playwright:v1.56.1-noble npm run test:multi-venue` | Erfolgreich: gesamte Integration erneut, echter Next-Build und Browser-Smoke bei 1440 und 390 Pixeln.                                    |
| `npm run test:ai-validation`                                                                                           | Erfolgreich. Bestehende KI-Validierung bleibt erhalten.                                                                                  |
| `npm run test:special-requests`                                                                                        | Erfolgreich. Bestehende Sonderwunschregeln bleiben erhalten.                                                                             |
| `npm run lint`                                                                                                         | Erfolgreich.                                                                                                                             |
| `npm run typecheck`                                                                                                    | Erfolgreich.                                                                                                                             |
| `npm run format:check`                                                                                                 | Erfolgreich.                                                                                                                             |
| `npm run build`                                                                                                        | Erfolgreich im Node-22-Browser-Test und Docker-Builder.                                                                                  |
| `npm run db:generate -- --name=verify_no_schema_drift`                                                                 | Erfolgreich: keine Schemaabweichung und keine zusaetzliche Migration erzeugt.                                                            |
| Docker-Build mit separatem Tag `gormsres-phase1-verification`                                                          | Erfolgreich; kein Compose-Deployment.                                                                                                    |
| Runtime-Skripte aus gebautem Image                                                                                     | Erfolgreich: Migration zweimal, Domain-CLI und Cleanup gegen separate PostgreSQL-17-Testdatenbank. DB-Retention 30 gewinnt gegen ENV 90. |
| `git diff --check`                                                                                                     | Erfolgreich.                                                                                                                             |

Explizite Upgrade-Abdeckung:

- V1.1-Schema mit bestehenden Anfragen, Sperrtagen, Events, Audit-Metadaten und
  verschluesselten Settings; Originalfelder werden vor/nach Migration verglichen.
- Unicode, Punycode und zusaetzlicher ENV-Alias werden nach Migration Heidekoenig zugeordnet.
  Wiederholung mit geaenderter ENV veraendert keine Zuordnung.
- Admin-Host und bereits fremd zugeordneter Host lassen den gesamten Import zurueckrollen;
  die Abschlussmarkierung fehlt und ein korrigierter Wiederholungsversuch funktioniert.
- Sechs Retention-Varianten: DB 30/ENV 90, individueller DB-Wert, fehlender DB-Wert mit
  individuellem ENV-Wert, ungueltiger DB-Wert, unkonfigurierter Standard 30 und DB 0 mit
  ENV-Fallback. Settings, Server-Cleanup und Runtime-Cleanup stimmen ueberein.
- Zwei synthetische CAPACITY-Betriebe pruefen getrennte Settings/SMTP/Branding, Sperrtage,
  Events, Auslastung, Listen, Details, Aenderungen, Snapshots, Mailhistorie und Retention.
  Ein synthetischer TABLES-Betrieb wird ausdruecklich abgewiesen.
- 14 CAPACITY-Referenzfaelle und Warnungssemantik ohne automatische Ablehnung.
- Lokaler Fake-SMTP: Fehler verhindert Statusaenderung; erfolgreiche Gastmail wird vor
  Statusaenderung quittiert; interne Anfrage-/Bestaetigungs-ICS bleiben intern.
- Echte Routen pruefen Host/Origin/Forwarded-Host, fremde Detail-/ICS-IDs und Branding.
  Veraltete Formulare duerfen weder Settings noch Audit-Log veraendern.
- Browser-Smoke mit Server- und Browserzeitzone Los Angeles prueft Kalendertage,
  bedingte Betriebsauswahl, Formular-Kontext und horizontale Ueberlaeufe.

Screenshots mit ausschliesslich synthetischen Daten liegen im ignorierten
`build/phase1-verification`. Public- und Admin-Ansichten wurden zusaetzlich visuell betrachtet.
Dies ersetzt keine vollstaendige Safari-/Firefox-/Accessibility-Regression.

Ein wiederholter Docker-Build scheiterte zwischenzeitlich beim Image-Export an einem fehlenden
lokalen Cache-Snapshot, nachdem Next bereits erfolgreich gebaut hatte. Der Build ohne Cache
war erfolgreich; der allgemeine Docker-Cache wurde nicht geloescht. Zu Beginn wurde ein
fehlendes natives Tailwind-Paket im vorhandenen Entwicklungs-`node_modules` durch sauberes
`npm ci --include=optional` unter Node 22 behoben. Das Lockfile wurde nicht geaendert.

## Bewusste Verhaltensunterschiede

Alle folgenden Unterschiede sind Bestandteil des freigegebenen Plans; keine weiteren
fachlichen Aenderungen wurden vorgenommen:

- Datum-only-Arithmetik und Darstellung sind nicht mehr von Server-/Browserzeitzone abhaengig.
  "Heute" und Vergangenheit werden anhand der Betriebszeitzone bestimmt.
- Interne ICS konvertiert Berliner Ortszeit korrekt: 14:00 im Juni wird 12:00Z,
  14:00 im Januar wird 13:00Z. Nicht existierende oder mehrdeutige DST-Uhrzeiten werden
  abgewiesen. UID, Dauer und Kalenderstatus bleiben erhalten.
- Public-Hosts brauchen nach dem einmaligen Import neben der bisherigen ENV-Allowlist
  eine Betriebszuordnung. Ein nachtraeglicher ENV-Alias allein reicht nicht mehr.
- Betriebliche Settings, Branding, Datenschutz und Seitenmetadaten nutzen den aufgeloesten
  Betrieb. Upload-Dateien und bisherige URLs bleiben erhalten.
- Admin-Formulare mit fehlendem/veraltetem Betriebskontext werden abgewiesen. Globale
  Auth-/Rollenrechte bleiben unveraendert; die Betriebsauswahl ist keine Autorisierung.
- Manueller Reservierungs-Cleanup ist auf den ausgewaehlten Betrieb beschraenkt;
  Audit-Aufbewahrung bleibt installationsweit. Geplanter Cleanup bearbeitet alle Betriebe.

Keine Abweichung vom freigegebenen Funktionsumfang. Die Tests verwenden temporaere synthetische
Betriebe; die Migration legt ausschliesslich Heidekoenig an.

## Verbleibende Risiken

1. **Bestehende Dependency-Sicherheitsbefunde:** `npm audit` meldet beim unveraenderten Lockfile
   17 Befunde: 1 kritisch, 13 hoch, 2 mittel, 1 niedrig. Darunter Next.js 16.2.9 und Nodemailer
   8.0.8. Das ist keine individuelle Ausnutzbarkeitsbewertung. Vor einem Produktionsrelease
   ist ein gesondert geprueftes Sicherheitsupdate erforderlich; keine stillschweigenden Updates
   oder `audit fix --force` wurden ausgefuehrt.
2. **Bestehender Auslastungsfehler absichtlich erhalten:** PostgreSQL liefert `HH:MM:SS`,
   die bisherige CAPACITY-Schleife akzeptiert nur `HH:MM` und ueberspringt diese Anfragen.
   Der Test weist dieses Bestandsverhalten nach. Die korrekte Betriebstrennung der Zaehler
   wird zusaetzlich mit einem ausschliesslich im Test normalisierten Zeit-Parser geprueft.
   Die operative Runtime wurde nicht veraendert. Vor Verlass auf Auslastungswarnungen ist
   eine separat freigegebene Korrektur notwendig.
3. **Migration auf echten Daten noch ausstehend:** DDL-Locks, Laufzeit bei produktiven
   Datenmengen und ein Restore auf dem Zielserver wurden nicht geprueft. Vor spaeterem
   Deployment Backup und Restore-Test sowie passenden Wartungszeitraum einplanen.
4. **Schluessel separat sichern:** Unveraendertes PostgreSQL-/Upload-Backup allein reicht
   bei Verlust des Verschluesselungsschluessels nicht zur Wiederherstellung der SMTP-Secrets.
5. **Weitere Betriebe noch nicht freigegeben:** Public-Texte und Sonderwunsch-Policy beschreiben
   weiterhin Heidekoenig. Vor Aktivierung anderer Betriebe ist deren eigene Policy zu pruefen.
   Per-Betrieb-Benutzerrechte sind nicht implementiert; die bestehenden Rollen gelten global.
6. **Bestehender konkurrierender Mailworkflow:** Optimistische Statuspruefung verhindert
   Status-Ueberschreiben, kann aber eine bereits verschickte konkurrierende Mail nicht rueckholen.
7. **Bestehende Snapshot-Aufbewahrung:** Verfuegbarkeits-Snapshots und deren Regelhinweise
   behalten ihre bisherige Aufbewahrung. Moeglicher persoenlicher Kontext braucht eine
   gesonderte Datenschutzpruefung; Phase 1 legt keine zusaetzlichen Kopien an.
8. **Proxy-Vertrauensgrenze:** Der bestehende Reverse Proxy muss Forwarded-Header bereinigen;
   direkte untrusted Zugriffe auf den App-Port bleiben durch Firewallregeln zu verhindern.

## Betroffene Dateien

Geaenderte oder neu hinzugefuegte Repository-Dateien dieser Phase:

```text
.dockerignore
Dockerfile
README.md
app/admin/actions.ts
app/admin/blocked-days/actions.ts
app/admin/blocked-days/blocked-day-form.tsx
app/admin/blocked-days/page.tsx
app/admin/blocked-days/reservation-event-form.tsx
app/admin/opening-hours/actions.ts
app/admin/opening-hours/opening-hours-form.tsx
app/admin/opening-hours/page.tsx
app/admin/page.tsx
app/admin/reservations/[id]/actions.ts
app/admin/reservations/[id]/decision-form.tsx
app/admin/reservations/[id]/ics/[kind]/route.ts
app/admin/reservations/[id]/page.tsx
app/admin/reservations/actions.ts
app/admin/reservations/page.tsx
app/admin/reservations/reservation-status-form.tsx
app/admin/settings/actions.ts
app/admin/settings/branding-form.tsx
app/admin/settings/page.tsx
app/admin/settings/retention-cleanup-form.tsx
app/admin/settings/settings-form.tsx
app/admin/settings/smtp-form.tsx
app/admin/system/page.tsx
app/api/reservation-slots/route.ts
app/branding/[asset]/route.ts
app/datenschutz/page.tsx
app/page.tsx
app/reservieren/actions.ts
app/reservieren/page.tsx
components/admin/admin-shell.tsx
components/admin/venue-context.tsx
components/reservation/public-reservation-page.tsx
components/reservation/reservation-form.tsx
db/migrations/0003_multi_venue_foundation.sql
db/migrations/meta/0003_snapshot.json
db/migrations/meta/_journal.json
db/schema.ts
docs/admin-guide.md
docs/architecture.md
docs/backup-and-restore.md
docs/branding.md
docs/database.md
docs/development-workflow.md
docs/domain-routing.md
docs/multi-venue.md
docs/phase-1-multi-venue-report.md
docs/privacy-and-retention.md
docs/security.md
docs/settings-and-secrets.md
package.json
scripts/check-ai-validation.ts
scripts/check-multi-venue.ts
scripts/check-venue-foundation.ts
scripts/cleanup-reservations.mjs
scripts/cleanup-reservations.ts
scripts/migrate.mjs
scripts/retention-lib.d.mts
scripts/retention-lib.mjs
scripts/test-multi-venue.sh
scripts/venue-hosts-lib.d.mts
scripts/venue-hosts-lib.mjs
scripts/venue-hosts.mjs
src/lib/dates.ts
src/lib/env.ts
src/lib/hostnames.d.mts
src/lib/hostnames.mjs
src/lib/venue-defaults.d.mts
src/lib/venue-defaults.mjs
src/server/ai/prompts.ts
src/server/ai/reservation-drafts.ts
src/server/ai/schemas.ts
src/server/blocked-days.ts
src/server/branding.ts
src/server/calendar.ts
src/server/dashboard.ts
src/server/db.ts
src/server/email.ts
src/server/guards.ts
src/server/holidays.ts
src/server/host-guard.ts
src/server/reservation-availability.ts
src/server/reservation-decisions.ts
src/server/reservation-detail.ts
src/server/reservation-events.ts
src/server/reservation-ics.ts
src/server/reservation-outgoing-emails.ts
src/server/reservation-rules.ts
src/server/reservations.ts
src/server/retention.ts
src/server/settings.ts
src/server/system-status.ts
src/server/venues.ts
```

Unveraendert bleiben insbesondere `package-lock.json`, `.env.example`, Docker Compose,
Backup-/Restore-Format, Upload-Struktur, Auth-/Session-/Benutzermodelle und die bisherigen
SQL-Migrationen/Drizzle-Snapshots. Lokale Build- und Screenshot-Artefakte sind ignoriert.

Details zum spaeteren, ausdruecklich separat freizugebenden Betrieb und Upgrade:
[Multi-Venue Foundation](multi-venue.md), [Domain-Routing](domain-routing.md),
[Backup/Restore](backup-and-restore.md), [Settings und Secrets](settings-and-secrets.md).
