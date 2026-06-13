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
    <p className="field-error">
      <span>{messages[0]}</span>
    </p>
  );
}

export function FormFeedback({ state }: { state: FeedbackState }) {
  if (!state.message) {
    return null;
  }

  const title = state.success ? "Anfrage eingegangen" : "Bitte prüfen";
  const icon = state.success ? "✓" : "!";

  return (
    <div
      aria-live="polite"
      className={`form-feedback ${state.success ? "form-feedback-success" : "form-feedback-error"}`}
      role={state.success ? "status" : "alert"}
    >
      <span aria-hidden="true" className="form-feedback-icon">
        {icon}
      </span>
      <span className="form-feedback-content">
        <span className="form-feedback-label">{title}</span>
        <span className="form-feedback-message">{state.message}</span>
      </span>
    </div>
  );
}
