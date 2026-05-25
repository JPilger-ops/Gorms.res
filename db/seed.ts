import "dotenv/config";
import { setupAdminSchema } from "@/src/lib/setup-validation";
import { closeDb } from "@/src/server/db";
import { createInitialAdmin, getSetupStatus } from "@/src/server/setup";

async function main() {
  const status = await getSetupStatus();

  if (!status.canRunSetup) {
    console.log("Setup is already completed or an admin user exists.");
    return;
  }

  const parsed = setupAdminSchema.safeParse({
    setupToken: process.env.SETUP_TOKEN,
    name: process.env.INITIAL_ADMIN_NAME,
    email: process.env.INITIAL_ADMIN_EMAIL,
    password: process.env.INITIAL_ADMIN_PASSWORD,
    passwordConfirm: process.env.INITIAL_ADMIN_PASSWORD,
  });

  if (!parsed.success) {
    throw new Error(
      "INITIAL_ADMIN_NAME, INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PASSWORD and SETUP_TOKEN are required.",
    );
  }

  const result = await createInitialAdmin(parsed.data);

  if (!result.ok) {
    throw new Error(result.message);
  }

  console.log("Initial admin user created and setup marked as completed.");
}

main()
  .finally(async () => {
    await closeDb();
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Setup seed failed.");
    process.exit(1);
  });
