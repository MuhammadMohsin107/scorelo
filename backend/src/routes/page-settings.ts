import { Router } from 'express';
import { getPageSettings, upsertPageSettings } from '../controllers/pageSettings.controller.js';
import { getAltTextSettings, putAltTextSettings } from '../controllers/altText.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { pageSettingsSlugSchema, upsertPageSettingsSchema } from '../schemas/pageSettings.schema.js';
import { altTextConfigSchema } from '../schemas/altText.schema.js';
import { storeIdQuerySchema } from '../schemas/common.schema.js';

export const pageSettingsRouter = Router();

pageSettingsRouter.use(authenticate);

/**
 * Image alt-text template configuration.
 *
 * It lives on this router because it IS page settings — same table, same store scoping — but it
 * gets typed routes rather than the generic `:slug` pair: the generic PUT accepts any JSON object,
 * and a template that generates text for a merchant's storefront needs its shape and its meaning
 * validated before it is stored.
 *
 * Declared before '/:slug' so 'image-alt-text' is never parsed as a settings slug.
 */
pageSettingsRouter.get('/image-alt-text/template', validateRequest({ query: storeIdQuerySchema }), asyncHandler(getAltTextSettings));
pageSettingsRouter.put('/image-alt-text/template', validateRequest({ query: storeIdQuerySchema, body: altTextConfigSchema }), asyncHandler(putAltTextSettings));

pageSettingsRouter.get('/:slug', validateRequest({ params: pageSettingsSlugSchema, query: storeIdQuerySchema }), asyncHandler(getPageSettings));
pageSettingsRouter.put('/:slug', validateRequest({ params: pageSettingsSlugSchema, query: storeIdQuerySchema, body: upsertPageSettingsSchema }), asyncHandler(upsertPageSettings));
