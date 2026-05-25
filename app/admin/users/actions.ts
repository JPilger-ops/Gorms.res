"use server";

import { revalidatePath } from "next/cache";
import {
  createUserSchema,
  resetUserPasswordSchema,
  updateUserSchema,
} from "@/src/lib/user-validation";
import { requirePermission } from "@/src/server/guards";
import { createUser, resetUserPassword, updateUser } from "@/src/server/users";

export type UserActionState = {
  message?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

export async function createUserAction(
  _previousState: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const session = await requirePermission("users:manage");
  const parsed = createUserSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "Bitte Eingaben prüfen.",
    };
  }

  const result = await createUser(parsed.data, session);

  if (!result.ok) {
    return { message: result.message };
  }

  revalidatePath("/admin/users");

  return {
    message: "Benutzer wurde erstellt.",
    success: true,
  };
}

export async function updateUserAction(
  _previousState: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const session = await requirePermission("users:manage");
  const parsed = updateUserSchema.safeParse({
    email: formData.get("email"),
    id: formData.get("id"),
    isActive: formData.get("isActive") === "true",
    name: formData.get("name"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "Bitte Eingaben prüfen.",
    };
  }

  const result = await updateUser(parsed.data, session);

  if (!result.ok) {
    return { message: result.message };
  }

  revalidatePath("/admin/users");

  return {
    message: "Benutzer wurde gespeichert.",
    success: true,
  };
}

export async function resetUserPasswordAction(
  _previousState: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const session = await requirePermission("users:manage");
  const parsed = resetUserPasswordSchema.safeParse({
    id: formData.get("id"),
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "Bitte Eingaben prüfen.",
    };
  }

  const result = await resetUserPassword(parsed.data, session);

  if (!result.ok) {
    return { message: result.message };
  }

  revalidatePath("/admin/users");

  return {
    message: "Passwort wurde gesetzt. Bestehende Sitzungen des Benutzers wurden beendet.",
    success: true,
  };
}
