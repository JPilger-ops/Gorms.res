"use client";

type FeedbackState = {
  message?: string;
  success?: boolean;
};

export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="field-error">{messages[0]}</p>;
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
      <span className="min-w-0">
        <span className="form-feedback-label">{state.success ? "Erfolg" : "Bitte prüfen"}</span>
        <span className="block">{state.message}</span>
      </span>
    </div>
  );
}
