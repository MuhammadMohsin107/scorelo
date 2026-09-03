import { Router } from 'express';
import {
  getSecurityEvents,
  getSessions,
  postChangePassword,
  postDisableTwoFactor,
  postEnableTwoFactor,
  postRevokeOtherSessions,
  postRevokeSession,
} from '../controllers/security.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { rateLimit } from '../middleware/rateLimit.js';
import {
  changePasswordSchema,
  eventsQuerySchema,
  revokeOthersSchema,
  revokeSessionSchema,
  sessionIdParamSchema,
  twoFactorToggleSchema,
} from '../schemas/security.schema.js';

/**
 * Settings → Security. Every route is authenticated; there is no public surface here.
 *
 * `authenticate` is applied once at the router level rather than per route, so a route added later
 * cannot be left unauthenticated by omission — the same pattern the other authenticated routers
 * use.
 */
export const securityRouter = Router();

securityRouter.use(authenticate);

securityRouter.get('/sessions', asyncHandler(getSessions));

securityRouter.post(
  '/sessions/revoke-others',
  validateRequest({ body: revokeOthersSchema }),
  asyncHandler(postRevokeOtherSessions),
);

// Declared AFTER '/sessions/revoke-others' so 'revoke-others' is never parsed as a session id.
securityRouter.post(
  '/sessions/:id/revoke',
  validateRequest({ params: sessionIdParamSchema, body: revokeSessionSchema }),
  asyncHandler(postRevokeSession),
);

securityRouter.get('/events', validateRequest({ query: eventsQuerySchema }), asyncHandler(getSecurityEvents));

// Rate limited by IP alone: the body carries the current password, and this is the endpoint an
// attacker with a stolen access token would use to guess it. Ten attempts per fifteen minutes
// leaves a real customer who mistypes plenty of room while making a guessing run pointless.
securityRouter.post(
  '/password',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many attempts. Please wait a few minutes and try again.' }),
  validateRequest({ body: changePasswordSchema }),
  asyncHandler(postChangePassword),
);

// ─── Two-factor authentication ───────────────────────────────────────
// Both are password-gated in the service, and rate limited here for the same reason the password
// change is: the body carries a password, and this is where one would be guessed.
securityRouter.post(
  '/two-factor/enable',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many attempts. Please wait a few minutes and try again.' }),
  validateRequest({ body: twoFactorToggleSchema }),
  asyncHandler(postEnableTwoFactor),
);

securityRouter.post(
  '/two-factor/disable',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many attempts. Please wait a few minutes and try again.' }),
  validateRequest({ body: twoFactorToggleSchema }),
  asyncHandler(postDisableTwoFactor),
);
