"use server";

import { redirect } from "next/navigation";
import { requireAdminHost } from "@/src/server/guards";
import { clearSessionCookie, deleteCurrentSession } from "@/src/server/sessions";

export async function logoutAction() {
  await requireAdminHost();
  await deleteCurrentSession();
  await clearSessionCookie();

  redirect("/login");
}
