import { AdminShell } from "@/components/admin/admin-shell";
import { CreateUserForm, ResetUserPasswordForm, UserEditForm } from "@/app/admin/users/user-forms";
import { requirePermission } from "@/src/server/guards";
import { getAdminUsers } from "@/src/server/users";

export const dynamic = "force-dynamic";

function formatDateTime(value: Date | null) {
  if (!value) {
    return "Noch nie";
  }

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

function roleLabel(role: string) {
  return role === "admin" ? "Admin" : "Mitarbeiter";
}

export default async function UsersPage() {
  const session = await requirePermission("users:manage");
  const users = await getAdminUsers();

  return (
    <AdminShell session={session}>
      <div className="space-y-6">
        <div className="glass-panel p-5 sm:p-7">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="eyebrow">Benutzerverwaltung</p>
              <h2 className="mt-2 text-3xl font-semibold">Zugänge und Rollen verwalten</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-muted">
              Admins können Benutzer erstellen, Rollen vergeben, Zugänge deaktivieren und Passwörter
              neu setzen. Mitarbeiter haben keinen Zugriff auf diese Verwaltung.
            </p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <CreateUserForm />

          <section className="glass-panel p-5 sm:p-6">
            <div className="mb-5">
              <p className="eyebrow">Bestehende Benutzer</p>
              <h3 className="mt-2 text-2xl font-semibold">Konten</h3>
            </div>

            {users.length ? (
              <div className="space-y-4">
                {users.map((user) => (
                  <article
                    className="rounded-3xl border border-border bg-surface/50 p-4"
                    key={user.id}
                  >
                    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <h4 className="text-xl font-semibold">{user.name}</h4>
                          <span className="rounded-full border border-border bg-surface/70 px-3 py-1 text-xs font-bold text-muted">
                            {roleLabel(user.role)}
                          </span>
                          <span
                            className={`rounded-full border border-border bg-surface/70 px-3 py-1 text-xs font-bold ${
                              user.isActive ? "text-success" : "text-danger"
                            }`}
                          >
                            {user.isActive ? "Aktiv" : "Deaktiviert"}
                          </span>
                        </div>
                        <p className="mt-2 break-words text-sm text-muted">{user.email}</p>
                      </div>

                      <div className="rounded-2xl border border-border bg-surface/65 px-4 py-3 text-sm">
                        <p className="font-semibold">Letzter Login</p>
                        <p className="mt-1 text-muted">{formatDateTime(user.lastLoginAt)}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <UserEditForm
                        email={user.email}
                        id={user.id}
                        isActive={user.isActive}
                        isCurrentUser={user.id === session.userId}
                        name={user.name}
                        role={user.role}
                      />

                      <details className="rounded-2xl border border-border bg-surface/45 p-4">
                        <summary className="cursor-pointer text-sm font-semibold">
                          Passwort neu setzen
                        </summary>
                        <div className="mt-4">
                          <ResetUserPasswordForm id={user.id} />
                        </div>
                      </details>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-surface/65 p-5 text-sm leading-6 text-muted">
                Keine Benutzer vorhanden.
              </div>
            )}
          </section>
        </div>
      </div>
    </AdminShell>
  );
}
