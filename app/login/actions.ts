"use server";

import { redirect } from "next/navigation";
import { loginSchema } from "@/src/lib/auth-validation";
import { recordSecurityEvent } from "@/src/server/audit-log";
import { login } from "@/src/server/auth";
import { assertAdminHostAction } from "@/src/server/guards";
import { checkRateLimit } from "@/src/server/rate-limit";
import { getClientRateLimitKey } from "@/src/server/request-security";

export type LoginActionState = {
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  if (!(await assertAdminHostAction())) {
    return { message: "Login ist unter dieser Adresse nicht verfügbar." };
  }

  const rateLimitKey = await getClientRateLimitKey("login");

  if (!checkRateLimit(rateLimitKey, 8, 15 * 60 * 1000)) {
    await recordSecurityEvent({
      action: "auth.login_rate_limited",
      metadata: {},
    });
    return { message: "Bitte später erneut versuchen." };
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      message: "Bitte Eingaben prüfen.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const ok = await login(parsed.data);

  if (!ok) {
    await recordSecurityEvent({
      action: "auth.login_failed",
      metadata: {},
    });
    return { message: "E-Mail oder Passwort ist ungültig." };
  }

  redirect("/admin");
}
