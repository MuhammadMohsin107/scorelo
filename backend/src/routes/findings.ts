import { Router } from 'express';
import { getFindingById, getFindings, getPriorityFindings, patchBulkFindingStatus, patchFindingStatus } from '../controllers/finding.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { bulkFindingStatusSchema, findingIdParamSchema, findingListQuerySchema, updateFindingStatusSchema } from '../schemas/finding.schema.js';
import { storeIdQuerySchema } from '../schemas/common.schema.js';

export const findingsRouter = Router();

findingsRouter.use(authenticate);
findingsRouter.get('/', validateRequest({ query: findingListQuerySchema }), asyncHandler(getFindings));
findingsRouter.get('/priority', validateRequest({ query: storeIdQuerySchema }), asyncHandler(getPriorityFindings));
findingsRouter.get('/:id', validateRequest({ params: findingIdParamSchema, query: storeIdQuerySchema }), asyncHandler(getFindingById));
findingsRouter.patch('/:id/status', validateRequest({ params: findingIdParamSchema, query: storeIdQuerySchema, body: updateFindingStatusSchema }), asyncHandler(patchFindingStatus));
findingsRouter.post('/bulk-status', validateRequest({ query: storeIdQuerySchema, body: bulkFindingStatusSchema }), asyncHandler(patchBulkFindingStatus));
