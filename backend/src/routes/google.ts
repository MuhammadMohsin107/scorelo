import { Router } from 'express';
import { z } from 'zod';
import {
  getGoogleAuthUrl,
  getGoogleCallback,
  getGooglePerformance,
  getGoogleSites,
  getGoogleStatus,
  postGoogleDisconnect,
  postGoogleSite,
} from '../controllers/google.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { storeIdQuerySchema } from '../schemas/common.schema.js';

/**
 * Google Search Console.
 *
 * `authenticate` is applied per route rather than to the whole router, because /callback CANNOT be
 * authenticated: Google redirects a browser to it with no Scorelo session attached. Its identity
 * comes from the signed `state` instead. Every other route here is authenticated, and applying the
 * middleware individually makes that exception explicit rather than something a reader has to
 * notice from the absence of a `router.use`.
 */
export const googleRouter = Router();

/**
 * A Search Console property id, e.g. `sc-domain:example.com` or `https://example.com/`.
 *
 * Bounded and non-empty here; whether it is a property the connected account may actually read is
 * checked server-side against Google's own list, because that is the real authorization and it
 * cannot be decided from the string's shape.
 */
const siteSchema = z.object({
  siteUrl: z.string().trim().min(1).max(512),
}).strict();

/** How far back to report. Bounded to Google's own 16-month retention. */
const performanceQuerySchema = storeIdQuerySchema.extend({
  days: z.coerce.number().int().min(1).max(480).optional(),
});

googleRouter.get('/auth-url', authenticate, validateRequest({ query: storeIdQuerySchema }), asyncHandler(getGoogleAuthUrl));

// UNAUTHENTICATED BY NECESSITY — see the router comment. Not validated by schema either: the query
// is Google's, and an unexpected shape is handled in the service as a failed connection rather
// than a 400 the merchant would see as a broken page.
googleRouter.get('/callback', asyncHandler(getGoogleCallback));

googleRouter.get('/status', authenticate, validateRequest({ query: storeIdQuerySchema }), asyncHandler(getGoogleStatus));
googleRouter.get('/sites', authenticate, validateRequest({ query: storeIdQuerySchema }), asyncHandler(getGoogleSites));

googleRouter.post(
  '/site',
  authenticate,
  validateRequest({ query: storeIdQuerySchema, body: siteSchema }),
  asyncHandler(postGoogleSite),
);

googleRouter.get(
  '/performance',
  authenticate,
  validateRequest({ query: performanceQuerySchema }),
  asyncHandler(getGooglePerformance),
);

googleRouter.post('/disconnect', authenticate, validateRequest({ query: storeIdQuerySchema }), asyncHandler(postGoogleDisconnect));
