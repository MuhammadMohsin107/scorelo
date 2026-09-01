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

/** `force` re-generates instead of serving the cached text — the only way to spend again on a
 * finding that already has AI output, so it must be explicit. */
export const aiRecommendationSchema = z.object({
  force: z.boolean().optional(),
}).strict();

export const bulkFindingStatusSchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1).max(100),
  status: statusSchema,
}).strict();

export type FindingListQuery = z.infer<typeof findingListQuerySchema>;
export type UpdateFindingStatusInput = z.infer<typeof updateFindingStatusSchema>;
export type AiRecommendationInput = z.infer<typeof aiRecommendationSchema>;
export type BulkFindingStatusInput = z.infer<typeof bulkFindingStatusSchema>;

// ─── AI fix planning ─────────────────────────────────────────────────

/** Resource refs are `type:id` as written by the audit's own evidence rows. Constrained here so a
 * malformed ref is rejected at the edge rather than inside the planner. */
const resourceRefSchema = z.string().trim().regex(/^[a-z]+:[A-Za-z0-9_-]+$/, 'Invalid resource reference').max(96);

export const planAiFixesSchema = z.object({
  /** Narrow planning to specific affected resources. Omit to plan for everything the finding
   * flagged, up to the planner's own per-request cap. */
  resourceIds: z.array(resourceRefSchema).min(1).max(50).optional(),
  limit: z.coerce.number().int().min(1).max(15).optional(),
}).strict();

export const bulkPlanAiFixesSchema = z.object({
  findingIds: z.array(z.coerce.number().int().positive()).min(1).max(25),
}).strict();

export const fixProposalIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
}).strict();

export const decideFixProposalSchema = z.object({
  decision: z.enum(['approve', 'reject']),
}).strict();

/** Approving several previewed proposals in one request — what the Fix Center preview submits. */
export const bulkDecideFixProposalsSchema = z.object({
  approve: z.array(z.coerce.number().int().positive()).max(100).optional(),
  reject: z.array(z.coerce.number().int().positive()).max(100).optional(),
}).strict().refine(
  (value) => (value.approve?.length ?? 0) + (value.reject?.length ?? 0) > 0,
  { message: 'Provide at least one proposal to approve or reject' },
);
