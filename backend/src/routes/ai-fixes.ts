import { Router } from 'express';
import { postAiFixDecision, postAiFixDecisions, postAiFixPlanBulk } from '../controllers/finding.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  bulkDecideFixProposalsSchema,
  bulkPlanAiFixesSchema,
  decideFixProposalSchema,
  fixProposalIdParamSchema,
} from '../schemas/finding.schema.js';
import { storeIdQuerySchema } from '../schemas/common.schema.js';

/**
 * Proposal-level operations, keyed by proposal id rather than finding id — which is why they live
 * here and not on the findings router. Generation stays under /findings/:id, because a proposal
 * only exists in the context of the finding it resolves.
 */
export const aiFixesRouter = Router();

aiFixesRouter.use(authenticate);

// Plan across several selected findings — the bulk Fix Center entry point.
aiFixesRouter.post('/plan', validateRequest({ query: storeIdQuerySchema, body: bulkPlanAiFixesSchema }), asyncHandler(postAiFixPlanBulk));

// The decisions taken on one preview screen. Declared before '/:id/...' so 'decisions' is never
// parsed as a proposal id.
aiFixesRouter.post('/decisions', validateRequest({ query: storeIdQuerySchema, body: bulkDecideFixProposalsSchema }), asyncHandler(postAiFixDecisions));

aiFixesRouter.post(
  '/:id/decision',
  validateRequest({ params: fixProposalIdParamSchema, query: storeIdQuerySchema, body: decideFixProposalSchema }),
  asyncHandler(postAiFixDecision),
);
