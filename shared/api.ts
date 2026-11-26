import { z } from "zod";

export const apiErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "INTERNAL",
]);

export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    fields: z.record(z.string(), z.array(z.string())).optional(),
  }),
});

export const healthResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ status: z.literal("ok") }),
});

export const readyResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ status: z.literal("ready") }),
});

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
