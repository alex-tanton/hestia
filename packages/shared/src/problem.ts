import { z } from 'zod';

/** RFC 9457 problem details: the only error body the API returns. */
export const problemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int().min(400).max(599),
  detail: z.string().optional(),
});

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';
