"use client";

type FeedbackState = {
  message?: string;
  success?: boolean;
};

export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return (
    <p className="rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
      {messages[0]}
    </p>
  );
}

export function FormFeedback({ state }: { state: FeedbackState }) {
  if (!state.message) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className={`form-feedback ${state.success ? "form-feedback-success" : "form-feedback-error"}`}
      role={state.success ? "status" : "alert"}
    >
      <span aria-hidden="true" className="form-feedback-dot" />
      <span>{state.message}</span>
    </div>
  );
}
