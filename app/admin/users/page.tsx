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
  const activeUsers = users.filter((user) => user.isActive).length;
  const adminUsers = users.filter((user) => user.role === "admin").length;
  const employeeUsers = users.filter((user) => user.role === "mitarbeiter").length;

  return (
    <AdminShell session={session}>
      <div className="space-y-6">
        <div className="glass-panel admin-hero p-5 sm:p-7">
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

        <div className="grid gap-3 md:grid-cols-4">
          <div className="admin-stat-card">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Konten</p>
            <p className="mt-3 text-3xl font-semibold">{users.length}</p>
            <p className="mt-2 text-sm text-muted">insgesamt angelegt</p>
          </div>
          <div className="admin-stat-card">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Aktiv</p>
            <p className="mt-3 text-3xl font-semibold">{activeUsers}</p>
            <p className="mt-2 text-sm text-muted">können sich anmelden</p>
          </div>
          <div className="admin-stat-card">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Admins</p>
            <p className="mt-3 text-3xl font-semibold">{adminUsers}</p>
            <p className="mt-2 text-sm text-muted">volle Verwaltung</p>
          </div>
          <div className="admin-stat-card">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Mitarbeiter</p>
            <p className="mt-3 text-3xl font-semibold">{employeeUsers}</p>
            <p className="mt-2 text-sm text-muted">operativer Zugriff</p>
          </div>
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <CreateUserForm />

          <section className="glass-panel admin-panel p-4 sm:p-6">
            <div className="mb-5">
              <p className="eyebrow">Bestehende Benutzer</p>
              <h3 className="mt-2 text-2xl font-semibold">Konten</h3>
              <p className="mt-2 text-sm leading-6 text-muted">
                Änderungen werden auditierbar gespeichert. Eigene Rolle und Aktivierung sind gegen
                versehentliche Selbstsperre geschützt.
              </p>
            </div>

            {users.length ? (
              <div className="space-y-4">
                {users.map((user) => (
                  <article className="admin-list-card min-w-0 p-4" key={user.id}>
                    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <h4 className="text-xl font-semibold">{user.name}</h4>
                          <span className="admin-filter-chip pointer-events-none px-3 py-1 text-xs">
                            {roleLabel(user.role)}
                          </span>
                          <span
                            className={`admin-filter-chip pointer-events-none px-3 py-1 text-xs ${
                              user.isActive ? "text-success" : "text-danger"
                            }`}
                          >
                            {user.isActive ? "Aktiv" : "Deaktiviert"}
                          </span>
                        </div>
                        <p className="mt-2 break-words text-sm text-muted">{user.email}</p>
                      </div>

                      <div className="admin-message-preview text-sm">
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

                      <details className="admin-disclosure">
                        <summary>Passwort neu setzen</summary>
                        <p className="mt-3 text-sm leading-6 text-muted">
                          Setzt ein neues Passwort und beendet bestehende Sitzungen dieses
                          Benutzers.
                        </p>
                        <div className="mt-4">
                          <ResetUserPasswordForm id={user.id} />
                        </div>
                      </details>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="admin-message-preview text-sm leading-6 text-muted">
                Keine Benutzer vorhanden.
              </div>
            )}
          </section>
        </div>
      </div>
    </AdminShell>
  );
}
