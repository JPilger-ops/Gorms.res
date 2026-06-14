import { getAiAssistantStatus } from "@/src/server/ai/config";
import { buildAiDraftPrompt } from "@/src/server/ai/prompts";
import {
  aiDraftRequestSchema,
  aiDraftResponseSchema,
  ollamaGenerateResponseSchema,
  type AiDraftRequest,
  type AiDraftResponse,
} from "@/src/server/ai/schemas";

const maxAiRequestMs = 45_000;
const aiResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    content: {
      type: "string",
    },
    riskNotes: {
      type: "array",
      items: {
        type: "string",
      },
    },
  },
  required: ["content", "riskNotes"],
};

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
  const startedAt = Date.now();
  const timeoutMs = Math.min(status.timeoutMs, maxAiRequestMs);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(joinUrl(status.baseUrl, "/api/generate"), {
      body: JSON.stringify({
        format: aiResponseJsonSchema,
        keep_alive: "10m",
        model: status.model,
        options: {
          num_ctx: 2048,
          num_predict: 140,
          repeat_penalty: 1.05,
          temperature: 0.1,
          top_p: 0.8,
        },
        prompt: buildAiDraftPrompt(parsedRequest.data),
        stream: false,
        think: false,
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn("AI draft request failed.", {
        durationMs: Date.now() - startedAt,
        status: response.status,
        task: parsedRequest.data.task,
      });
      return { ok: false, reason: "request_failed" };
    }

    const parsedOllamaResponse = ollamaGenerateResponseSchema.safeParse(await response.json());

    if (!parsedOllamaResponse.success) {
      console.warn("AI draft response envelope invalid.", {
        durationMs: Date.now() - startedAt,
        task: parsedRequest.data.task,
      });
      return { ok: false, reason: "invalid_output" };
    }

    const parsedDraft = aiDraftResponseSchema.safeParse(
      parseDraftJson(parsedOllamaResponse.data.response),
    );

    if (!parsedDraft.success) {
      console.warn("AI draft JSON invalid.", {
        durationMs: Date.now() - startedAt,
        task: parsedRequest.data.task,
      });
      return { ok: false, reason: "invalid_output" };
    }

    console.info("AI draft generated.", {
      contentEmpty: parsedDraft.data.content.length === 0,
      durationMs: Date.now() - startedAt,
      task: parsedRequest.data.task,
    });

    return {
      draft: parsedDraft.data,
      ok: true,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn("AI draft request timed out.", {
        durationMs: Date.now() - startedAt,
        task: parsedRequest.data.task,
        timeoutMs,
      });
      return { ok: false, reason: "timeout" };
    }

    console.warn("AI draft request errored.", {
      durationMs: Date.now() - startedAt,
      task: parsedRequest.data.task,
    });
    return { ok: false, reason: "request_failed" };
  } finally {
    clearTimeout(timeout);
  }
}
