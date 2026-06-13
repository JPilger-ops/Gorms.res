import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const DEFAULT_PUBLIC_URL = "https://xn--heideknig-57a.gorms.de";
const DEFAULT_ADMIN_URL = "https://login.gorms.de";

function requireEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function nextWednesdayDate() {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + 14);

  while (date.getUTCDay() !== 3) {
    date.setUTCDate(date.getUTCDate() + 1);
  }

  return date.toISOString().slice(0, 10);
}

function normalizeUrl(value) {
  return value.replace(/\/+$/, "");
}

async function assertSlotAvailable({ date, guestCount, publicUrl, time }) {
  const url = new URL("/api/reservation-slots", publicUrl);
  url.searchParams.set("date", date);
  url.searchParams.set("guestCount", String(guestCount));

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Slot API returned ${response.status}.`);
  }

  const data = await response.json();
  const slot = data.slots?.find((item) => item.time === time);

  if (!slot) {
    throw new Error(`Slot ${date} ${time} is not returned by the app.`);
  }

  if (slot.hardBlocked) {
    throw new Error(`Slot ${date} ${time} is hard-blocked: ${slot.reasons?.join(", ")}`);
  }
}

async function run() {
  if (process.env.SMOKE_CONFIRM_SEND_EMAILS !== "I_UNDERSTAND") {
    throw new Error(
      "Set SMOKE_CONFIRM_SEND_EMAILS=I_UNDERSTAND. This live smoke test creates a real request and sends real emails.",
    );
  }

  const adminEmail = requireEnv("SMOKE_ADMIN_EMAIL");
  const adminPassword = requireEnv("SMOKE_ADMIN_PASSWORD");
  const publicUrl = normalizeUrl(process.env.SMOKE_PUBLIC_URL ?? DEFAULT_PUBLIC_URL);
  const adminUrl = normalizeUrl(process.env.SMOKE_ADMIN_URL ?? DEFAULT_ADMIN_URL);
  const date = process.env.SMOKE_DATE ?? nextWednesdayDate();
  const time = process.env.SMOKE_TIME ?? "12:00";
  const guestCount = Number(process.env.SMOKE_GUEST_COUNT ?? "2");
  const guestEmail = process.env.SMOKE_GUEST_EMAIL ?? adminEmail;
  const phone = process.env.SMOKE_GUEST_PHONE ?? "+49 211 000000";
  const marker = `smoke-${new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14)}`;
  const guestName = `Smoke Testgast ${marker}`;
  const subject = `Absage zur Smoke-Testanfrage ${marker}`;
  const body = `Guten Tag ${guestName},

vielen Dank fuer Ihre Testanfrage. Diese Anfrage wird im Rahmen einer technischen Live-Pruefung manuell abgesagt.

Freundliche Gruesse
Waldwirtschaft Heidekoenig`;

  await assertSlotAvailable({ date, guestCount, publicUrl, time });

  const browser = await chromium.launch({ headless: process.env.SMOKE_HEADLESS !== "false" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.setDefaultTimeout(Number(process.env.SMOKE_TIMEOUT_MS ?? "120000"));

  try {
    console.log(`Opening public form on ${publicUrl}.`);
    await page.goto(publicUrl, { waitUntil: "networkidle" });
    await page.locator('input[name="date"]').fill(date);
    await page.locator('input[name="guestCount"]').fill(String(guestCount));
    await page
      .locator(`select[name="time"] option[value="${time}"]`)
      .waitFor({ state: "attached" });
    await page.locator('select[name="time"]').selectOption(time);
    await page.locator('input[name="guestName"]').fill(guestName);
    await page.locator('input[name="email"]').fill(guestEmail);
    await page.locator('input[name="phone"]').fill(phone);
    await page.locator('textarea[name="message"]').fill(`Live smoke test ${marker}`);
    await page.locator('input[name="privacyAccepted"]').check();

    console.log(`Submitting public request for ${date} ${time}.`);
    await page.getByRole("button", { name: "Anfrage senden" }).click();
    await page.getByText(/Vielen Dank f.r Ihre Anfrage/).waitFor({ timeout: 180000 });

    console.log("Logging into admin app.");
    await page.goto(`${adminUrl}/login`, { waitUntil: "networkidle" });
    await page.getByLabel("E-Mail").fill(adminEmail);
    await page.getByLabel("Passwort").fill(adminPassword);
    await page.getByRole("button", { name: "Anmelden" }).click();
    await page.waitForURL(/\/admin/, { timeout: 120000 });

    console.log("Opening created reservation.");
    await page.goto(`${adminUrl}/admin/reservations`, { waitUntil: "networkidle" });
    await page.getByRole("link", { exact: true, name: guestName }).click();
    await page.waitForURL(/\/admin\/reservations\//, { timeout: 120000 });

    const detailUrl = page.url();
    const reservationId = detailUrl.match(/\/admin\/reservations\/([^?/#]+)/)?.[1];

    if (!reservationId) {
      throw new Error(`Could not parse reservation id from ${detailUrl}.`);
    }

    console.log("Sending manual decline.");
    const declineForm = page.locator("form").filter({ hasText: "Absage senden" }).first();
    await declineForm.locator('input[name="subject"]').fill(subject);
    await declineForm.locator('textarea[name="body"]').fill(body);
    await declineForm.getByRole("button", { name: "Geprüfte Absage jetzt senden" }).click();
    await page.waitForURL(new RegExp(`/admin/reservations/${reservationId}\\?decision=decline`), {
      timeout: 180000,
    });
    await page.getByText("Absage gesendet").waitFor({ timeout: 120000 });
    await page
      .getByText(/Die pers.nliche Absage wurde per E-Mail versendet/)
      .waitFor({ timeout: 120000 });

    console.log(
      JSON.stringify({
        adminUrl: page.url(),
        date,
        guestName,
        ok: true,
        reservationId,
        time,
      }),
    );
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
