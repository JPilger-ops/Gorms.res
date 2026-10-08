import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium, firefox, webkit } from "playwright";
import sharp from "sharp";
import { pool } from "@/src/server/db";
import { createSession } from "@/src/server/sessions";
import { TELEGRAPH_VENUE_ID, type TablePlan } from "@/src/lib/table-plan-types";
import { HEIDEKOENIG_VENUE_ID } from "@/src/lib/venue-defaults.mjs";
import { adminUrl } from "@/src/lib/admin-urls";

export async function checkTablePlanBrowser(token: string, userId: string) {
  assert.equal(process.env.MULTI_VENUE_ISOLATED_TEST, "true");
  assert.equal(new URL(process.env.DATABASE_URL!).hostname, "phase1-db");
  const base = "http://localhost:6143";
  const areaId = "10000000-0000-4000-8000-000000000001";
  const path = adminUrl(`/admin/table-plan/${areaId}`, TELEGRAPH_VENUE_ID);
  const screenshotDir = "build/phase2-verification";
  await mkdir(screenshotDir, { recursive: true });
  const cookie = `heidekoenig_admin_session=${token}; gorms_admin_venue=${HEIDEKOENIG_VENUE_ID}`;
  const auth = { Cookie: cookie, Origin: base };
  const staffId = randomUUID();
  await pool.query(
    "insert into users(id,email,name,password_hash,role) values ($1,'table-plan-staff@example.invalid','Fixture Staff','not-a-real-password','mitarbeiter')",
    [staffId],
  );
  const staffToken = (await createSession(staffId)).token;
  const browserErrors: string[] = [];
  for (const [name, engine] of [
    ["chromium", chromium],
    ["firefox", firefox],
    ["webkit", webkit],
  ] as const) {
    if (process.env.TABLE_PLAN_BROWSER_ENGINE && process.env.TABLE_PLAN_BROWSER_ENGINE !== name)
      continue;
    const browser = await engine.launch({
      headless: true,
      ...(name === "chromium" ? { args: ["--no-sandbox"] } : {}),
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      hasTouch: true,
    });
    await context.addCookies([
      {
        name: "heidekoenig_admin_session",
        value: token,
        url: base,
        httpOnly: true,
        sameSite: "Lax",
      },
      {
        name: "gorms_admin_venue",
        value: HEIDEKOENIG_VENUE_ID,
        url: base,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    try {
      const page = await context.newPage();
      page.on("pageerror", (error) => browserErrors.push(`${name}: ${error.message}`));
      for (const viewport of [
        { width: 1440, height: 1000 },
        { width: 1280, height: 900 },
        { width: 390, height: 844 },
      ]) {
        await page.setViewportSize(viewport);
        await page.goto(base + path);
        await page.getByRole("button", { name: "Bearbeiten", exact: true }).waitFor();
        assert.equal(
          await page.locator("canvas").count(),
          0,
          "Saved viewer must not instantiate Konva.",
        );
        assert.equal(
          await page.locator('link[rel="icon"]').last().getAttribute("href"),
          `/branding/favicon?venue=${TELEGRAPH_VENUE_ID}`,
        );
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
          `${name}/${viewport.width} viewer overflow`,
        );
        assert.equal(
          await page
            .locator(".table-plan-view img")
            .evaluate((image) => (image as HTMLImageElement).naturalWidth > 0),
          true,
        );
        await page.screenshot({
          path: join(screenshotDir, `${name}-viewer-${viewport.width}.png`),
          fullPage: true,
        });
        await page.getByRole("button", { name: "Bearbeiten", exact: true }).click();
        await page.locator(".table-plan-canvas canvas").first().waitFor();
        await page.waitForFunction(
          () => {
            const canvas = document.querySelector(
              ".table-plan-canvas canvas",
            ) as HTMLCanvasElement | null;
            if (!canvas || canvas.width < 100) return false;
            const pixel = canvas.getContext("2d")!.getImageData(10, 10, 1, 1).data;
            return pixel[0] === 242 && pixel[1] === 246 && pixel[2] === 240 && pixel[3] === 255;
          },
          undefined,
          { timeout: 10_000 },
        );
        await page.waitForTimeout(250);
        const pixels = await page
          .locator(".table-plan-canvas canvas")
          .first()
          .evaluate((element) => {
            const canvas = element as HTMLCanvasElement;
            const data = canvas
              .getContext("2d")!
              .getImageData(0, 0, canvas.width, canvas.height).data;
            let nonwhite = 0;
            for (let i = 0; i < data.length; i += 64)
              if (data[i + 3] > 0 && (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250))
                nonwhite++;
            const corner = Array.from(canvas.getContext("2d")!.getImageData(10, 10, 1, 1).data);
            return { nonwhite, corner };
          });
        assert(
          pixels.nonwhite > 50,
          `${name}/${viewport.width}: canvas must render actual image and resources`,
        );
        assert.deepEqual(
          pixels.corner,
          [242, 246, 240, 255],
          "The referenced floorplan must actually be drawn, not only the table overlay.",
        );
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
          `${name}/${viewport.width} editor overflow`,
        );
        await page.screenshot({
          path: join(screenshotDir, `${name}-editor-${viewport.width}.png`),
          fullPage: true,
        });
        await page.getByRole("button", { name: "Schließen", exact: true }).click();
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(base + path);
      await page.getByRole("button", { name: "Bearbeiten", exact: true }).click();
      await page.locator(".table-plan-canvas canvas").first().waitFor();
      await page.locator(".table-plan-resource-list button").first().click();
      await page.waitForTimeout(250);
      const originalCanvas = await page
        .locator(".table-plan-canvas canvas")
        .first()
        .evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL());
      await page.locator(".table-plan-canvas").focus();
      await page.keyboard.press("ArrowRight");
      await page.waitForFunction(
        () => document.querySelector(".table-plan-editor")?.getAttribute("data-dirty") === "true",
      );
      await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
      await page.waitForFunction(
        () => document.querySelector(".table-plan-editor")?.getAttribute("data-dirty") === "false",
      );
      assert.equal(
        await page.getByRole("button", { name: "Rückgängig", exact: true }).isEnabled(),
        false,
      );
      await page.waitForTimeout(250);
      assert.equal(
        await page
          .locator(".table-plan-canvas canvas")
          .first()
          .evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL()),
        originalCanvas,
      );
      await page.screenshot({
        path: join(screenshotDir, `${name}-properties-1440.png`),
        fullPage: true,
      });
      const current = await context.request.get(
        base + adminUrl(`/admin/table-plan/${areaId}/data`, TELEGRAPH_VENUE_ID),
      );
      const plan: TablePlan = (await current.json()).plan;
      const box = (await page.locator(".table-plan-canvas").boundingBox())!;
      const table = plan.tables.find((t) => !t.archived)!;
      const center = {
        x: box.x + 1 + table.layout.x * (box.width - 2),
        y: box.y + 1 + (table.layout.y * (box.width - 2)) / plan.background.aspectRatio,
      };
      await page.mouse.move(center.x, center.y);
      await page.mouse.down();
      await page.mouse.move(center.x + 25, center.y + 15, { steps: 8 });
      await page.mouse.up();
      await page.getByRole("button", { name: "Rückgängig", exact: true }).waitFor();
      assert.equal(
        await page.getByRole("button", { name: "Rückgängig", exact: true }).isEnabled(),
        true,
      );
      await page.waitForTimeout(250);
      const draggedCanvas = await page
        .locator(".table-plan-canvas canvas")
        .first()
        .evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL());
      assert.notEqual(draggedCanvas, originalCanvas, "Gesture must actually move a resource.");
      await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
      await page.waitForTimeout(250);
      assert.equal(
        await page.getByRole("button", { name: "Rückgängig", exact: true }).isEnabled(),
        false,
        "One gesture must create exactly one undo step.",
      );
      assert.equal(
        await page
          .locator(".table-plan-canvas canvas")
          .first()
          .evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL()),
        originalCanvas,
      );
      await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
      await page.getByRole("button", { name: "Speichern", exact: true }).click();
      await page.getByText("Tischplan gespeichert.", { exact: true }).waitFor();
      assert.equal(await page.locator(".table-plan-editor").getAttribute("data-dirty"), "false");
      await page.getByRole("button", { name: "Schließen", exact: true }).click();
      console.log(`CHECK: ${name} drag/save and floorplan preview/cancel/undo/upload completed.`);

      await page.getByRole("button", { name: "Bearbeiten", exact: true }).waitFor();
      await page.getByRole("button", { name: "Bearbeiten", exact: true }).click();
      await page.getByRole("tab", { name: "Grundriss", exact: true }).click();
      const wide = await sharp({
        create: {
          width: 1280,
          height: 640,
          channels: 4,
          background: { r: 242, g: 246, b: 240, alpha: 1 },
        },
      })
        .png()
        .toBuffer();
      await page
        .locator('input[type="file"]')
        .setInputFiles({ name: "wide.png", mimeType: "image/png", buffer: wide });
      await page.getByRole("dialog").waitFor();
      await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
      assert.equal(await page.locator(".table-plan-editor").getAttribute("data-dirty"), "false");
      await page
        .locator('input[type="file"]')
        .setInputFiles({ name: "wide.png", mimeType: "image/png", buffer: wide });
      await page.getByRole("dialog").waitFor();
      await page.getByRole("button", { name: "Proportional übernehmen", exact: true }).click();
      assert.equal(
        await page
          .locator(".table-plan-canvas")
          .evaluate((el) => (el as HTMLElement).style.aspectRatio),
        "2 / 1",
      );
      await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
      assert.equal(await page.locator(".table-plan-editor").getAttribute("data-dirty"), "false");
      const assetPathForUpload =
        base +
        adminUrl(
          `/admin/table-plan/${areaId}/floorplan?asset=${plan.background.asset!.id}`,
          TELEGRAPH_VENUE_ID,
        );
      const safeImage = await (await context.request.get(assetPathForUpload)).body();
      await page
        .locator('input[type="file"]')
        .setInputFiles({ name: "floorplan.png", mimeType: "image/png", buffer: safeImage });
      await page.getByRole("button", { name: "Speichern", exact: true }).click();
      await page.getByText("Tischplan gespeichert.", { exact: true }).waitFor();
      await page.getByRole("button", { name: "Schließen", exact: true }).click();
      await page.getByRole("button", { name: "Bearbeiten", exact: true }).waitFor();

      // Explicit URL wins over a cookie changed in a different tab.
      await context.addCookies([
        {
          name: "gorms_admin_venue",
          value: TELEGRAPH_VENUE_ID,
          url: base,
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      const hkTab = await context.newPage();
      await hkTab.goto(base + adminUrl("/admin/opening-hours", HEIDEKOENIG_VENUE_ID));
      assert.equal(
        await hkTab.locator('input[name="venueId"]').getAttribute("value"),
        HEIDEKOENIG_VENUE_ID,
      );
      assert.equal(
        await hkTab.locator('link[rel="icon"]').last().getAttribute("href"),
        `/branding/favicon?venue=${HEIDEKOENIG_VENUE_ID}`,
      );
      const beforeAudit = (
        await pool.query(
          "select count(*)::int as n from audit_log where venue_id=$1 and action='opening_hours.update'",
          [HEIDEKOENIG_VENUE_ID],
        )
      ).rows[0].n;
      for (const field of ["earliestReservationTime", "latestReservationTime"]) {
        const control = hkTab.locator(`input[name="${field}"]`);
        await control.fill((await control.inputValue()).slice(0, 5));
      }
      await hkTab.locator('button[type="submit"]').last().click();
      await hkTab.getByText("Öffnungszeiten wurden gespeichert.", { exact: true }).waitFor();
      assert.equal(
        (
          await pool.query(
            "select count(*)::int as n from audit_log where venue_id=$1 and action='opening_hours.update'",
            [HEIDEKOENIG_VENUE_ID],
          )
        ).rows[0].n,
        beforeAudit + 1,
      );
      await hkTab.close();
      const second = await context.newPage();
      await page.goto(base + path);
      await second.goto(base + path);
      await page.getByRole("button", { name: "Bearbeiten", exact: true }).click();
      await second.getByRole("button", { name: "Bearbeiten", exact: true }).click();
      await page.getByRole("button", { name: "+ Tisch", exact: true }).click();
      await second.getByRole("button", { name: "+ Tisch", exact: true }).click();
      await page.getByRole("button", { name: "Speichern", exact: true }).click();
      await page.getByText("Tischplan gespeichert.", { exact: true }).waitFor();
      await second.getByRole("button", { name: "Speichern", exact: true }).click();
      await second.getByRole("alert").filter({ hasText: "zwischenzeitlich" }).waitFor();
      assert.equal(await second.locator(".table-plan-editor").getAttribute("data-dirty"), "true");
      second.once("dialog", (d) => d.accept());
      await second.getByRole("button", { name: "Verwerfen", exact: true }).click();
      await second.getByText("Gespeicherten Plan geladen.", { exact: true }).waitFor();
      assert.equal(await second.locator(".table-plan-editor").getAttribute("data-dirty"), "false");
      await second.getByRole("button", { name: "Schließen", exact: true }).click();
      await second.getByRole("button", { name: "Bearbeiten", exact: true }).waitFor();
      await second.close();
      console.log(`CHECK: ${name} explicit context and conflict/discard completed.`);
      await page.getByRole("button", { name: "Schließen", exact: true }).click();
      await page.getByRole("button", { name: "Bearbeiten", exact: true }).waitFor();
      await page.getByRole("link", { name: "Bereiche", exact: true }).click();
      await page.waitForURL(base + adminUrl("/admin/table-plan", TELEGRAPH_VENUE_ID));
      assert(new URL(page.url()).searchParams.get("venue") === TELEGRAPH_VENUE_ID);
      await page.goBack();
      await page.getByRole("button", { name: "Bearbeiten", exact: true }).waitFor();
      const mobile = await context.newPage();
      await mobile.setViewportSize({ width: 390, height: 844 });
      await mobile.goto(base + path);
      await mobile.getByRole("button", { name: "Bearbeiten", exact: true }).tap();
      await mobile.locator(".table-plan-resource-list button").first().tap();
      await mobile.getByRole("button", { name: "Nach rechts", exact: true }).tap();
      assert.equal(await mobile.locator(".table-plan-editor").getAttribute("data-dirty"), "true");
      mobile.once("dialog", (d) => d.accept());
      await mobile.getByRole("button", { name: "Verwerfen", exact: true }).tap();
      await mobile.close();

      if (name === "chromium") {
        const saved: TablePlan = (
          await (
            await context.request.get(
              base + adminUrl(`/admin/table-plan/${areaId}/data`, TELEGRAPH_VENUE_ID),
            )
          ).json()
        ).plan;
        const payload = {
          venueId: TELEGRAPH_VENUE_ID,
          baseRevision: saved.area.revision,
          aspectChangeAcknowledged: false,
          floorplanAction: "keep",
          plan: saved,
        };
        const savePath = base + adminUrl(`/admin/table-plan/${areaId}/save`, TELEGRAPH_VENUE_ID);
        const post = (headers: Record<string, string>, value = payload) =>
          context.request.post(savePath, {
            headers,
            multipart: { payload: JSON.stringify(value) },
          });
        assert.equal((await post({ ...auth, Origin: "http://localhost:6144" })).status(), 403);
        assert.equal((await post({ ...auth, Origin: "https://localhost:6143" })).status(), 403);
        assert.equal((await post({ Cookie: cookie })).status(), 403);
        assert.equal(
          (await post({ ...auth, Cookie: `heidekoenig_admin_session=${staffToken}` })).status(),
          404,
        );
        assert.equal(
          (await post(auth, { ...payload, venueId: HEIDEKOENIG_VENUE_ID })).status(),
          404,
        );
        assert.equal(
          (
            await context.request.get(
              base + adminUrl(`/admin/table-plan/${areaId}/data`, HEIDEKOENIG_VENUE_ID),
            )
          ).status(),
          404,
        );
        const assetPath =
          base +
          adminUrl(
            `/admin/table-plan/${areaId}/floorplan?asset=${saved.background.asset!.id}`,
            TELEGRAPH_VENUE_ID,
          );
        assert.equal((await context.request.get(assetPath)).status(), 200);
        const optimizerPath =
          base +
          `/_next/image?url=${encodeURIComponent(new URL(assetPath).pathname + new URL(assetPath).search)}&w=640&q=75`;
        assert.equal((await context.request.get(optimizerPath)).status(), 400);
        assert.equal(
          (await context.request.get(optimizerPath, { headers: { Cookie: "" } })).status(),
          400,
        );
        assert.equal(
          (await context.request.get(assetPath, { headers: { Cookie: "" } })).status(),
          401,
        );
        assert.equal(
          (
            await context.request.get(assetPath, {
              headers: { Cookie: `heidekoenig_admin_session=${staffToken}` },
            })
          ).status(),
          404,
        );
        const spoof = await context.request.get(
          base + adminUrl(`/admin/table-plan/${areaId}/data`, HEIDEKOENIG_VENUE_ID),
          { headers: { "x-gorms-request-path": path } },
        );
        assert.equal(spoof.status(), 404);
        const oversized = await context.request.post(savePath, {
          headers: { ...auth, "Content-Type": "multipart/form-data; boundary=fixture" },
          data: Buffer.alloc(9 * 1024 * 1024 + 10),
        });
        assert.equal(oversized.status(), 413);
        assert.equal(
          (
            await context.request.get(
              base + `/admin/table-plan?venue=${TELEGRAPH_VENUE_ID}&venue=${HEIDEKOENIG_VENUE_ID}`,
            )
          ).status(),
          404,
        );
        await pool.query("update users set is_active=false where id=$1", [staffId]);
        assert.equal(
          (await post({ ...auth, Cookie: `heidekoenig_admin_session=${staffToken}` })).status(),
          401,
        );
        console.log(
          "PASS: HTTP Host/session/role/context spoofing, strict Origin including scheme/port, private assets, disabled user and streamed size limit.",
        );
      }
      console.log(
        `PASS: ${name} viewer/editor 1440/1280/390 screenshots + pixel/overflow checks, actual drag one-step undo/redo, save/reload, touch controls, two-tab 409 and URL/cookie separation.`,
      );
    } catch (error) {
      for (const [index, page] of context.pages().entries()) {
        await page
          .screenshot({ path: join(screenshotDir, `${name}-failure-${index}.png`), fullPage: true })
          .catch(() => {});
        console.error(
          `${name} fixture page ${index}: ${page.url()}; buttons=${JSON.stringify(await page.getByRole("button").allTextContents())}; alerts=${JSON.stringify(await page.getByRole("alert").allTextContents())}`,
        );
        console.error(
          "Canvas diagnostic:",
          await page.locator("canvas").evaluateAll((canvases) =>
            canvases.map((c) => ({
              width: (c as HTMLCanvasElement).width,
              height: (c as HTMLCanvasElement).height,
            })),
          ),
          browserErrors,
        );
      }
      throw error;
    } finally {
      await context.close();
      await browser.close();
    }
  }
  assert.deepEqual(browserErrors, [], "No browser runtime exceptions");
  assert.equal(
    (await pool.query("select role from users where id=$1", [userId])).rows[0].role,
    "admin",
  );
}
