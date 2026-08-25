import { Router } from 'express';
import { getLatestAuditRun, getLatestSubPillarAnalysis, getScores, listAuditRuns, postRunAudit } from '../controllers/audit.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { auditIdParamSchema, auditListQuerySchema, latestAuditQuerySchema, subPillarParamSchema } from '../schemas/audit.schema.js';
import { storeIdQuerySchema } from '../schemas/common.schema.js';

export const auditsRouter = Router();

auditsRouter.use(authenticate);
auditsRouter.post('/run', validateRequest({ query: storeIdQuerySchema }), asyncHandler(postRunAudit));
auditsRouter.get('/', validateRequest({ query: auditListQuerySchema }), asyncHandler(listAuditRuns));
auditsRouter.get('/latest', validateRequest({ query: latestAuditQuerySchema }), asyncHandler(getLatestAuditRun));
auditsRouter.get('/latest/:pillar/:subPillar', validateRequest({ params: subPillarParamSchema, query: storeIdQuerySchema }), asyncHandler(getLatestSubPillarAnalysis));
auditsRouter.get('/:id/scores', validateRequest({ params: auditIdParamSchema, query: storeIdQuerySchema }), asyncHandler(getScores));
