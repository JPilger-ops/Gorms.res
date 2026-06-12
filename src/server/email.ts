import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import type { ReservationRequestInput } from "@/src/lib/reservation-validation";
import {
  renderReservationSubjectTemplate,
  validateEmailSubjectTemplate,
} from "@/src/server/email-templates";
import {
  createAcceptedReservationInternalIcs,
  createReservationRequestIcs,
} from "@/src/server/calendar";
import { buildAdminReservationUrl } from "@/src/server/reservation-ics";
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

export type ReservationDecisionEmailData = {
  body: string;
  guestEmail: string;
  guestName: string;
  replyTo?: string;
  subject: string;
};

export type ReservationAcceptedInternalEmailData = {
  acceptedByName: string;
  date: string;
  email: string;
  guestCount: number;
  guestName: string;
  id: string;
  message?: string | null;
  phone: string;
  time: string;
};

export type InternalReservationAcceptedEmailContent = {
  html: string;
  recipient: string;
  subject: string;
  text: string;
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function textToHtml(value: string) {
  return escapeHtml(value).replaceAll("\n", "<br>");
}

export function buildInternalReservationAcceptedEmailContent(
  input: ReservationAcceptedInternalEmailData,
  recipient: string,
): InternalReservationAcceptedEmailContent {
  const subject = `Reservierung bestätigt: ${input.date} um ${input.time} - ${input.guestName} - ${input.guestCount} Personen`;
  const text = [
    "Reservierung wurde bestätigt",
    "",
    "Diese interne Nachricht dokumentiert die bestätigte Reservierung.",
    "",
    `Datum: ${input.date}`,
    `Uhrzeit: ${input.time}`,
    `Personen: ${input.guestCount}`,
    `Name: ${input.guestName}`,
    `E-Mail: ${input.email}`,
    `Telefon: ${input.phone}`,
    input.message ? `Nachricht: ${input.message}` : "Nachricht: -",
    `Bestätigt durch: ${input.acceptedByName}`,
    "",
    `Anfrage-ID: ${input.id}`,
  ].join("\n");
  const rows = [
    ["Datum", input.date],
    ["Uhrzeit", input.time],
    ["Personen", String(input.guestCount)],
    ["Name", input.guestName],
    ["E-Mail", input.email],
    ["Telefon", input.phone],
    ["Nachricht", input.message || "-"],
    ["Bestätigt durch", input.acceptedByName],
    ["Anfrage-ID", input.id],
  ];

  return {
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #171712;">
        <h1 style="font-size: 20px;">Reservierung wurde bestätigt</h1>
        <p>Diese interne Nachricht dokumentiert die bestätigte Reservierung.</p>
        <table cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
          ${rows
            .map(
              ([label, value]) => `
                <tr>
                  <th align="left" style="border-bottom: 1px solid #ddd;">${escapeHtml(label)}</th>
                  <td style="border-bottom: 1px solid #ddd;">${escapeHtml(value)}</td>
                </tr>
              `,
            )
            .join("")}
        </table>
      </div>
    `,
    recipient,
    subject,
    text,
  };
}

export async function sendInternalReservationEmail(input: ReservationEmailData) {
  const { fromAddress, fromName, mailer } = await getSmtpTransporter();
  const templates = await getEmailTemplateSettings();
  const validation = validateEmailSubjectTemplate(templates.internalEmailSubjectTemplate);
  const calendar = createReservationRequestIcs({
    ...input,
    adminUrl: buildAdminReservationUrl(input.id),
  });

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

export async function sendInternalReservationAcceptedEmail(
  input: ReservationAcceptedInternalEmailData,
  content: InternalReservationAcceptedEmailContent,
) {
  const { fromAddress, fromName, mailer } = await getSmtpTransporter();
  const calendar = createAcceptedReservationInternalIcs(input);

  await mailer.sendMail({
    from: {
      name: fromName,
      address: fromAddress,
    },
    to: content.recipient,
    replyTo: input.email,
    subject: content.subject,
    text: content.text,
    html: content.html,
    attachments: [
      {
        content: calendar,
        contentType: "text/calendar; charset=utf-8; method=PUBLISH",
        filename: `reservierung-bestaetigt-${input.date}-${input.time.replace(":", "")}.ics`,
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

export async function sendGuestReservationDecisionEmail(input: ReservationDecisionEmailData) {
  const { fromAddress, fromName, mailer } = await getSmtpTransporter();

  await mailer.sendMail({
    from: {
      name: fromName,
      address: fromAddress,
    },
    to: input.guestEmail,
    replyTo: input.replyTo,
    subject: input.subject,
    text: input.body,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #171712;">
        <p>Guten Tag ${escapeHtml(input.guestName)},</p>
        <div>${textToHtml(input.body)}</div>
      </div>
    `,
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
