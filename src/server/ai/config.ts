import { env } from "@/src/lib/env";

export type AiAssistantStatus = {
  baseUrl: string;
  draftsEnabled: boolean;
  enabled: boolean;
  model: string;
  statusLabel: string;
  timeoutMs: number;
  uiMessage: string;
};

export function getAiAssistantStatus(): AiAssistantStatus {
  if (!env.AI_ENABLED) {
    return {
      baseUrl: env.OLLAMA_BASE_URL,
      draftsEnabled: false,
      enabled: false,
      model: env.OLLAMA_MODEL,
      statusLabel: "Deaktiviert",
      timeoutMs: env.AI_TIMEOUT_MS,
      uiMessage: "KI ist deaktiviert. Die Anfrage kann vollständig manuell bearbeitet werden.",
    };
  }

  if (!env.AI_DRAFTS_ENABLED) {
    return {
      baseUrl: env.OLLAMA_BASE_URL,
      draftsEnabled: false,
      enabled: true,
      model: env.OLLAMA_MODEL,
      statusLabel: "Konfiguriert",
      timeoutMs: env.AI_TIMEOUT_MS,
      uiMessage: "KI ist konfiguriert, Antwortentwürfe sind aber nicht freigegeben.",
    };
  }

  return {
    baseUrl: env.OLLAMA_BASE_URL,
    draftsEnabled: true,
    enabled: true,
    model: env.OLLAMA_MODEL,
    statusLabel: "Entwürfe aktiv",
    timeoutMs: env.AI_TIMEOUT_MS,
    uiMessage: "KI-Entwürfe können auf Knopfdruck erzeugt werden. Bitte vor dem Senden prüfen.",
  };
}
