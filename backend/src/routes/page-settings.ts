import { Router } from 'express';
import { getPageSettings, upsertPageSettings } from '../controllers/pageSettings.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { pageSettingsSlugSchema, upsertPageSettingsSchema } from '../schemas/pageSettings.schema.js';
import { storeIdQuerySchema } from '../schemas/common.schema.js';

export const pageSettingsRouter = Router();

pageSettingsRouter.use(authenticate);
pageSettingsRouter.get('/:slug', validateRequest({ params: pageSettingsSlugSchema, query: storeIdQuerySchema }), asyncHandler(getPageSettings));
pageSettingsRouter.put('/:slug', validateRequest({ params: pageSettingsSlugSchema, query: storeIdQuerySchema, body: upsertPageSettingsSchema }), asyncHandler(upsertPageSettings));
