import { z } from "zod";

export const aiDraftTaskSchema = z.enum([
  "acceptance_note",
  "decline_note",
  "policy_polish",
  "question_text",
]);

export type AiDraftTask = z.infer<typeof aiDraftTaskSchema>;

export const aiSpecialRequestPolicySchema = z.object({
  allowedAcceptanceNote: z.string().trim().max(1000).optional(),
  allowedDeclineNote: z.string().trim().max(1000).optional(),
  allowedQuestionText: z.string().trim().max(1000).optional(),
  answerText: z.string().trim().max(1000).optional(),
  category: z.string().trim().min(1).max(80),
  certainty: z.string().trim().min(1).max(80),
  clarificationQuestion: z.string().trim().max(1000).optional(),
  guestQuestionCategories: z.array(z.string().trim().min(1).max(80)).max(10).default([]),
  label: z.string().trim().min(1).max(160),
  neverSay: z.array(z.string().trim().min(1).max(240)).max(20).default([]),
  safeFacts: z.array(z.string().trim().min(1).max(240)).max(20).default([]),
  staffNote: z.string().trim().min(1).max(300),
});

export type AiSpecialRequestPolicy = z.infer<typeof aiSpecialRequestPolicySchema>;

export const aiPromptReservationSchema = z.object({
  availabilityNotes: z.array(z.string().trim().min(1).max(240)).max(20).default([]),
  baseContent: z.string().trim().max(1600).optional(),
  guestCount: z.number().int().positive().max(200),
  guestMessage: z.string().trim().max(2000).optional(),
  requestedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  requestedTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  specialRequests: z.array(aiSpecialRequestPolicySchema).max(10).default([]),
  staffInstruction: z.string().trim().max(1000).optional(),
});

export type AiPromptReservation = z.infer<typeof aiPromptReservationSchema>;

export const aiDraftRequestSchema = z.object({
  reservation: aiPromptReservationSchema,
  task: aiDraftTaskSchema,
});

export type AiDraftRequest = z.infer<typeof aiDraftRequestSchema>;

export const aiDraftResponseSchema = z.object({
  content: z.string().trim().max(1200).default(""),
  riskNotes: z.array(z.string().trim().min(1).max(240)).max(10).default([]),
});

export type AiDraftResponse = z.infer<typeof aiDraftResponseSchema>;

export const ollamaGenerateResponseSchema = z.object({
  done: z.boolean().optional(),
  response: z.string(),
});
