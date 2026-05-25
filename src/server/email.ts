import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import type { ReservationRequestInput } from "@/src/lib/reservation-validation";
import {
  renderReservationSubjectTemplate,
  validateEmailSubjectTemplate,
} from "@/src/server/email-templates";
import { createReservationRequestIcs } from "@/src/server/calendar";
import { getEmailTemplateSettings, getSmtpSettings } from "@/src/server/settings";

export class EmailConfigurationError extends Error {
  constructor() {
    super("SMTP is not configured.");
  }
}

export class EmailTemplateError extends Error {
  constructor() {
    super("Email template is invalid.");
  }
}

export type ReservationEmailData = ReservationRequestInput & {
  id: string;
};

async function getSmtpTransporter() {
  const settings = await getSmtpSettings();

  if (!settings.user || !settings.password || !settings.fromAddress) {
    throw new EmailConfigurationError();
  }

  const mailer: Transporter<SMTPTransport.SentMessageInfo> = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.port === 465,
    auth: {
      user: settings.user,
      pass: settings.password,
    },
  });

  return { fromAddress: settings.fromAddress, fromName: settings.fromName, mailer };
}

function formatReservationText(input: ReservationEmailData) {
  return [
    "Neue Reservierungsanfrage",
    "",
    "Wichtig: Es handelt sich um eine Anfrage, nicht um eine bestätigte Reservierung.",
    "",
    `Datum: ${input.date}`,
    `Uhrzeit: ${input.time}`,
    `Personen: ${input.guestCount}`,
    `Name: ${input.guestName}`,
    `E-Mail: ${input.email}`,
    `Telefon: ${input.phone}`,
    input.message ? `Nachricht: ${input.message}` : "Nachricht: -",
    "",
    `Anfrage-ID: ${input.id}`,
  ].join("\n");
}

function formatReservationHtml(input: ReservationEmailData) {
  const rows = [
    ["Datum", input.date],
    ["Uhrzeit", input.time],
    ["Personen", String(input.guestCount)],
    ["Name", input.guestName],
    ["E-Mail", input.email],
    ["Telefon", input.phone],
    ["Nachricht", input.message || "-"],
    ["Anfrage-ID", input.id],
  ];

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #171712;">
      <h1 style="font-size: 20px;">Neue Reservierungsanfrage</h1>
      <p><strong>Wichtig:</strong> Es handelt sich um eine Anfrage, nicht um eine bestätigte Reservierung.</p>
      <table cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
        ${rows
          .map(
            ([label, value]) => `
              <tr>
                <th align="left" style="border-bottom: 1px solid #ddd;">${label}</th>
                <td style="border-bottom: 1px solid #ddd;">${value}</td>
              </tr>
            `,
          )
          .join("")}
      </table>
    </div>
  `;
}

function formatGuestConfirmationText(input: ReservationEmailData) {
  return [
    `Guten Tag ${input.guestName},`,
    "",
    "vielen Dank für Ihre Anfrage bei der Waldwirtschaft Heidekönig.",
    "Die Reservierung ist erst nach unserer persönlichen Bestätigung gültig.",
    "",
    "Ihre Anfrage:",
    `Datum: ${input.date}`,
    `Uhrzeit: ${input.time}`,
    `Personen: ${input.guestCount}`,
    "",
    "Wir melden uns persönlich bei Ihnen.",
    "",
    "Waldwirtschaft Heidekönig",
  ].join("\n");
}

function formatGuestConfirmationHtml(input: ReservationEmailData) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #171712;">
      <h1 style="font-size: 20px;">Vielen Dank für Ihre Anfrage</h1>
      <p>Guten Tag ${input.guestName},</p>
      <p>vielen Dank für Ihre Anfrage bei der Waldwirtschaft Heidekönig.</p>
      <p><strong>Die Reservierung ist erst nach unserer persönlichen Bestätigung gültig.</strong></p>
      <table cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
        <tr>
          <th align="left" style="border-bottom: 1px solid #ddd;">Datum</th>
          <td style="border-bottom: 1px solid #ddd;">${input.date}</td>
        </tr>
        <tr>
          <th align="left" style="border-bottom: 1px solid #ddd;">Uhrzeit</th>
          <td style="border-bottom: 1px solid #ddd;">${input.time}</td>
        </tr>
        <tr>
          <th align="left" style="border-bottom: 1px solid #ddd;">Personen</th>
          <td style="border-bottom: 1px solid #ddd;">${input.guestCount}</td>
        </tr>
      </table>
      <p>Wir melden uns persönlich bei Ihnen.</p>
      <p>Waldwirtschaft Heidekönig</p>
    </div>
  `;
}

export async function sendInternalReservationEmail(input: ReservationEmailData) {
  const { fromAddress, fromName, mailer } = await getSmtpTransporter();
  const templates = await getEmailTemplateSettings();
  const validation = validateEmailSubjectTemplate(templates.internalEmailSubjectTemplate);
  const calendar = createReservationRequestIcs(input);

  if (!validation.valid) {
    throw new EmailTemplateError();
  }

  const from = {
    name: fromName,
    address: fromAddress,
  };

  await mailer.sendMail({
    from,
    to: templates.reservationNotificationEmail,
    replyTo: input.email,
    subject: renderReservationSubjectTemplate(templates.internalEmailSubjectTemplate, input),
    text: formatReservationText(input),
    html: formatReservationHtml(input),
    attachments: [
      {
        content: calendar,
        contentType: "text/calendar; charset=utf-8; method=PUBLISH",
        filename: `reservierungsanfrage-${input.date}-${input.time.replace(":", "")}.ics`,
      },
    ],
  });
}

export async function sendGuestReservationReceiptEmail(input: ReservationEmailData) {
  const { fromAddress, fromName, mailer } = await getSmtpTransporter();
  const templates = await getEmailTemplateSettings();
  const validation = validateEmailSubjectTemplate(templates.guestEmailSubjectTemplate);

  if (!validation.valid) {
    throw new EmailTemplateError();
  }

  const from = {
    name: fromName,
    address: fromAddress,
  };

  await mailer.sendMail({
    from,
    to: input.email,
    subject: renderReservationSubjectTemplate(templates.guestEmailSubjectTemplate, input),
    text: formatGuestConfirmationText(input),
    html: formatGuestConfirmationHtml(input),
  });
}

export async function sendSmtpTestEmail(to: string) {
  const { fromAddress, fromName, mailer } = await getSmtpTransporter();

  await mailer.sendMail({
    from: {
      name: fromName,
      address: fromAddress,
    },
    to,
    subject: "SMTP-Test Waldwirtschaft Heidekönig",
    text: [
      "Diese Testmail wurde aus dem Adminbereich der Reservierungsanfragen-App gesendet.",
      "",
      "Wenn Sie diese E-Mail erhalten, ist die SMTP-Konfiguration grundsätzlich funktionsfähig.",
    ].join("\n"),
  });
}
