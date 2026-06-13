import { getAiAssistantStatus } from "@/src/server/ai/config";
import { buildAiDraftPrompt } from "@/src/server/ai/prompts";
import {
  aiDraftRequestSchema,
  aiDraftResponseSchema,
  ollamaGenerateResponseSchema,
  type AiDraftRequest,
  type AiDraftResponse,
} from "@/src/server/ai/schemas";

export type AiDraftResult =
  | {
      draft: AiDraftResponse;
      ok: true;
    }
  | {
      ok: false;
      reason: "disabled" | "invalid_input" | "invalid_output" | "request_failed" | "timeout";
    };

function joinUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

function parseDraftJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export async function generateAiDraft(request: AiDraftRequest): Promise<AiDraftResult> {
  const status = getAiAssistantStatus();

  if (!status.enabled || !status.draftsEnabled) {
    return { ok: false, reason: "disabled" };
  }

  const parsedRequest = aiDraftRequestSchema.safeParse(request);

  if (!parsedRequest.success) {
    return { ok: false, reason: "invalid_input" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), status.timeoutMs);

  try {
    const response = await fetch(joinUrl(status.baseUrl, "/api/generate"), {
      body: JSON.stringify({
        format: "json",
        model: status.model,
        options: {
          temperature: 0.2,
        },
        prompt: buildAiDraftPrompt(parsedRequest.data),
        stream: false,
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, reason: "request_failed" };
    }

    const parsedOllamaResponse = ollamaGenerateResponseSchema.safeParse(await response.json());

    if (!parsedOllamaResponse.success) {
      return { ok: false, reason: "invalid_output" };
    }

    const parsedDraft = aiDraftResponseSchema.safeParse(
      parseDraftJson(parsedOllamaResponse.data.response),
    );

    if (!parsedDraft.success) {
      return { ok: false, reason: "invalid_output" };
    }

    return {
      draft: parsedDraft.data,
      ok: true,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, reason: "timeout" };
    }

    return { ok: false, reason: "request_failed" };
  } finally {
    clearTimeout(timeout);
  }
}
