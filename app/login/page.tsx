import { notFound, redirect } from "next/navigation";
import { LoginForm } from "@/app/login/login-form";
import { isAdminHostRequest } from "@/src/server/host-guard";
import { getCurrentSession } from "@/src/server/sessions";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!(await isAdminHostRequest())) {
    notFound();
  }

  const session = await getCurrentSession();

  if (session) {
    redirect("/admin");
  }

  return (
    <main className="app-shell flex items-center" id="main-content">
      <section className="page-frame grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="space-y-6 py-8 sm:py-14">
          <p className="eyebrow">Waldwirtschaft Heidekönig</p>
          <h2 className="max-w-2xl text-4xl font-semibold leading-[1.05] text-balance sm:text-6xl">
            Geschützter Backend-Zugang
          </h2>
          <p className="max-w-xl text-lg leading-8 text-muted">
            Reservierungsanfragen, Sperrtage, Öffnungszeiten und Einstellungen werden über die
            Admin-Domain verwaltet.
          </p>
        </div>

        <LoginForm />
      </section>
    </main>
  );
}
