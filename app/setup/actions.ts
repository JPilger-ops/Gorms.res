"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { setupAdminSchema } from "@/src/lib/setup-validation";
import { assertAdminHostAction } from "@/src/server/guards";
import { checkRateLimit } from "@/src/server/rate-limit";
import { createInitialAdmin } from "@/src/server/setup";

export type SetupActionState = {
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

function firstForwardedFor(value: string | null) {
  return value?.split(",")[0]?.trim() || "unknown";
}

export async function createInitialAdminAction(
  _previousState: SetupActionState,
  formData: FormData,
): Promise<SetupActionState> {
  if (!(await assertAdminHostAction())) {
    return { message: "Setup ist unter dieser Adresse nicht verfügbar." };
  }

  const headerList = await headers();
  const rateLimitKey = `setup:${firstForwardedFor(headerList.get("x-forwarded-for"))}`;

  if (!checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000)) {
    return { message: "Bitte später erneut versuchen." };
  }

  const parsed = setupAdminSchema.safeParse({
    setupToken: formData.get("setupToken"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
  });

  if (!parsed.success) {
    return {
      message: "Bitte Eingaben prüfen.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await createInitialAdmin(parsed.data);

  if (!result.ok) {
    return { message: result.message };
  }

  redirect("/login");
}
