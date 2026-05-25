"use client";

import { useActionState } from "react";
import {
  createUserAction,
  resetUserPasswordAction,
  updateUserAction,
  type UserActionState,
} from "@/app/admin/users/actions";
import { roles, type UserRole } from "@/src/lib/permissions";

const initialState: UserActionState = {};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-sm font-medium text-danger">{messages[0]}</p>;
}

function FormMessage({ state }: { state: UserActionState }) {
  if (!state.message) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
        state.success ? "border-success bg-surface/80 text-success" : "border-border bg-surface/70"
      }`}
      role={state.success ? "status" : "alert"}
    >
      {state.message}
    </div>
  );
}

function RoleSelect({ defaultValue, disabled }: { defaultValue: UserRole; disabled?: boolean }) {
  return (
    <select
      className="glass-control min-h-12 w-full px-4 outline-none disabled:opacity-60"
      defaultValue={defaultValue}
      disabled={disabled}
      name="role"
      required
    >
      {roles.map((role) => (
        <option key={role} value={role}>
          {role === "admin" ? "Admin" : "Mitarbeiter"}
        </option>
      ))}
    </select>
  );
}

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUserAction, initialState);

  return (
    <form action={formAction} className="glass-panel space-y-4 p-4 sm:p-6">
      <div>
        <p className="eyebrow">Neuer Benutzer</p>
        <h3 className="mt-2 text-2xl font-semibold">Zugang anlegen</h3>
      </div>

      <FormMessage state={state} />

      <label className="block space-y-2">
        <span className="text-sm font-semibold">Name</span>
        <input
          className="glass-control min-h-12 w-full px-4 outline-none"
          name="name"
          required
          type="text"
        />
        <FieldError messages={state.fieldErrors?.name} />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-semibold">E-Mail</span>
        <input
          autoComplete="email"
          className="glass-control min-h-12 w-full px-4 outline-none"
          name="email"
          required
          type="email"
        />
        <FieldError messages={state.fieldErrors?.email} />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-semibold">Rolle</span>
        <RoleSelect defaultValue="mitarbeiter" />
        <FieldError messages={state.fieldErrors?.role} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-semibold">Passwort</span>
          <input
            autoComplete="new-password"
            className="glass-control min-h-12 w-full px-4 outline-none"
            name="password"
            required
            type="password"
          />
          <FieldError messages={state.fieldErrors?.password} />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold">Passwort bestätigen</span>
          <input
            autoComplete="new-password"
            className="glass-control min-h-12 w-full px-4 outline-none"
            name="passwordConfirm"
            required
            type="password"
          />
          <FieldError messages={state.fieldErrors?.passwordConfirm} />
        </label>
      </div>

      <button
        className="primary-action w-full disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        aria-busy={pending}
        type="submit"
      >
        {pending ? "Wird erstellt..." : "Benutzer erstellen"}
      </button>
    </form>
  );
}

export function UserEditForm({
  email,
  id,
  isActive,
  isCurrentUser,
  name,
  role,
}: {
  email: string;
  id: string;
  isActive: boolean;
  isCurrentUser: boolean;
  name: string;
  role: UserRole;
}) {
  const [state, formAction, pending] = useActionState(updateUserAction, initialState);

  return (
    <form
      action={formAction}
      className="min-w-0 space-y-4 rounded-2xl border border-border bg-surface/65 p-4"
    >
      <input name="id" type="hidden" value={id} />
      {isCurrentUser ? (
        <>
          <input name="role" type="hidden" value={role} />
          <input name="isActive" type="hidden" value="true" />
        </>
      ) : null}

      <FormMessage state={state} />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-semibold">Name</span>
          <input
            className="glass-control min-h-12 w-full px-4 outline-none"
            defaultValue={name}
            name="name"
            required
            type="text"
          />
          <FieldError messages={state.fieldErrors?.name} />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold">E-Mail</span>
          <input
            autoComplete="email"
            className="glass-control min-h-12 w-full px-4 outline-none"
            defaultValue={email}
            name="email"
            required
            type="email"
          />
          <FieldError messages={state.fieldErrors?.email} />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold">Rolle</span>
          <RoleSelect defaultValue={role} disabled={isCurrentUser} />
          <FieldError messages={state.fieldErrors?.role} />
        </label>

        <label className="flex min-h-12 items-center gap-3 self-end rounded-2xl border border-border bg-surface/55 px-4">
          <input
            className="h-4 w-4"
            defaultChecked={isActive}
            disabled={isCurrentUser}
            name="isActive"
            type="checkbox"
            value="true"
          />
          <span className="text-sm font-semibold">
            {isCurrentUser ? "Eigener Benutzer bleibt aktiv" : "Benutzer ist aktiv"}
          </span>
        </label>
      </div>

      <button
        className="secondary-action w-full disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        aria-busy={pending}
        type="submit"
      >
        {pending ? "Wird gespeichert..." : "Benutzer speichern"}
      </button>
    </form>
  );
}

export function ResetUserPasswordForm({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(resetUserPasswordAction, initialState);

  return (
    <form
      action={formAction}
      className="min-w-0 space-y-4 rounded-2xl border border-border bg-surface/65 p-4"
    >
      <input name="id" type="hidden" value={id} />

      <FormMessage state={state} />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-semibold">Neues Passwort</span>
          <input
            autoComplete="new-password"
            className="glass-control min-h-12 w-full px-4 outline-none"
            name="password"
            required
            type="password"
          />
          <FieldError messages={state.fieldErrors?.password} />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold">Passwort bestätigen</span>
          <input
            autoComplete="new-password"
            className="glass-control min-h-12 w-full px-4 outline-none"
            name="passwordConfirm"
            required
            type="password"
          />
          <FieldError messages={state.fieldErrors?.passwordConfirm} />
        </label>
      </div>

      <button
        className="secondary-action w-full disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        aria-busy={pending}
        type="submit"
      >
        {pending ? "Wird gesetzt..." : "Passwort setzen"}
      </button>
    </form>
  );
}
