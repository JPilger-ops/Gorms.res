import { env } from "@/src/lib/env";

export type AiAssistantStatus = {
  baseUrl: string;
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
      enabled: false,
      model: env.OLLAMA_MODEL,
      statusLabel: "Deaktiviert",
      timeoutMs: env.AI_TIMEOUT_MS,
      uiMessage: "KI ist deaktiviert. Die Anfrage kann vollständig manuell bearbeitet werden.",
    };
  }

  return {
    baseUrl: env.OLLAMA_BASE_URL,
    enabled: true,
    model: env.OLLAMA_MODEL,
    statusLabel: "Vorbereitet, noch nicht aktiv",
    timeoutMs: env.AI_TIMEOUT_MS,
    uiMessage:
      "KI ist konfiguriert, aber in dieser Version noch nicht mit Antwortentwürfen verbunden.",
  };
}
