"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { loginSchema } from "@/src/lib/auth-validation";
import { login } from "@/src/server/auth";
import { assertAdminHostAction } from "@/src/server/guards";
import { checkRateLimit } from "@/src/server/rate-limit";

export type LoginActionState = {
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

function firstForwardedFor(value: string | null) {
  return value?.split(",")[0]?.trim() || "unknown";
}

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  if (!(await assertAdminHostAction())) {
    return { message: "Login ist unter dieser Adresse nicht verfügbar." };
  }

  const headerList = await headers();
  const rateLimitKey = `login:${firstForwardedFor(headerList.get("x-forwarded-for"))}`;

  if (!checkRateLimit(rateLimitKey, 8, 15 * 60 * 1000)) {
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
    return { message: "E-Mail oder Passwort ist ungültig." };
  }

  redirect("/admin");
}
