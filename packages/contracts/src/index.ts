import { z } from 'zod';

export const requestIdHeader = 'x-request-id';

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string().optional()
  })
});

export type ApiErrorEnvelope = z.infer<typeof apiErrorSchema>;

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  service: z.string(),
  timestamp: z.string(),
  dependencies: z.record(z.enum(['ok', 'error'])).optional()
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const identityStageSchema = z.enum(['brief', 'strategy', 'visuals', 'assets', 'finalize']);

export type IdentityStage = z.infer<typeof identityStageSchema>;
