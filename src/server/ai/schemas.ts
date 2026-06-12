import { z } from "zod";

export const aiDraftTaskSchema = z.enum(["summary", "acceptance", "decline", "question"]);

export type AiDraftTask = z.infer<typeof aiDraftTaskSchema>;

export const aiPromptReservationSchema = z.object({
  availabilityNotes: z.array(z.string().trim().min(1).max(240)).max(20).default([]),
  guestCount: z.number().int().positive().max(200),
  guestMessage: z.string().trim().max(2000).optional(),
  requestedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  requestedTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  staffInstruction: z.string().trim().max(1000).optional(),
});

export type AiPromptReservation = z.infer<typeof aiPromptReservationSchema>;

export const aiDraftRequestSchema = z.object({
  reservation: aiPromptReservationSchema,
  task: aiDraftTaskSchema,
});

export type AiDraftRequest = z.infer<typeof aiDraftRequestSchema>;

export const aiDraftResponseSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  riskNotes: z.array(z.string().trim().min(1).max(240)).max(10).default([]),
  title: z.string().trim().min(1).max(120),
});

export type AiDraftResponse = z.infer<typeof aiDraftResponseSchema>;

export const ollamaGenerateResponseSchema = z.object({
  done: z.boolean().optional(),
  response: z.string(),
});
