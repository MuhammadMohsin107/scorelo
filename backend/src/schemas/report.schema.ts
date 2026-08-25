import { z } from 'zod';
import { storeIdQueryShape } from './common.schema.js';

export const reportTrendQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(12),
  ...storeIdQueryShape,
}).strict();

export type ReportTrendQuery = z.infer<typeof reportTrendQuerySchema>;
