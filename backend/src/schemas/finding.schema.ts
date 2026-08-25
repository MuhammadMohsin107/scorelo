import { z } from 'zod';
import { storeIdQueryShape } from './common.schema.js';

const statusSchema = z.enum(['open', 'reviewed', 'resolved', 'ignored']);
const severitySchema = z.enum(['critical', 'high', 'medium', 'low']);
const pillarSchema = z.enum(['seo', 'content', 'speed', 'cro', 'ai-discovery']);

export const findingListQuerySchema = z.object({
  pillar: pillarSchema.optional(),
  subPillar: z.string().trim().min(1).max(120).optional(),
  status: statusSchema.optional(),
  severity: severitySchema.optional(),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  ...storeIdQueryShape,
}).strict();

export const findingIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
}).strict();

export const updateFindingStatusSchema = z.object({
  status: statusSchema,
}).strict();

export const bulkFindingStatusSchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1).max(100),
  status: statusSchema,
}).strict();

export type FindingListQuery = z.infer<typeof findingListQuerySchema>;
export type UpdateFindingStatusInput = z.infer<typeof updateFindingStatusSchema>;
export type BulkFindingStatusInput = z.infer<typeof bulkFindingStatusSchema>;
