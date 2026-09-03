import { Router } from 'express';
import {
  getActions,
  getChallenges,
  getEvents,
  getOverview,
  getUserDetail,
  getUsers,
  postDisableUserTwoFactor,
  postRevokeUserTwoFactorChallenges,
} from '../controllers/admin-two-factor.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { rateLimit } from '../middleware/rateLimit.js';
import {
  adminActionsQuerySchema,
  adminTwoFactorActionSchema,
  adminTwoFactorChallengesQuerySchema,
  adminTwoFactorEventsQuerySchema,
  adminTwoFactorUsersQuerySchema,
  adminUserIdParamSchema,
} from '../schemas/admin.schema.js';

/**
 * ─── /api/admin ──────────────────────────────────────────────────────
 *
 * TWO GUARDS AT THE ROUTER LEVEL, in this order and applied once:
 *
 *   authenticate  →  proves WHO is calling (a signed access token)
 *   requireAdmin  →  proves WHAT THEY MAY DO (users.is_platform_admin, re-read from MySQL)
 *
 * Mounted on the router rather than repeated per route, so a route added here later cannot be left
 * unguarded by omission — the same reasoning securityRouter states for `authenticate`. There is no
 * public surface on this router and no route that opts out of either guard.
 *
 * Everything under /two-factor operates the EXISTING 2FA system. No endpoint here issues a code,
 * mints a ticket, creates a session, or reads a credential. There is deliberately no
 * admin-force-ENABLE: enabling requires the account owner's own password
 * (/api/security/two-factor/enable), because the second factor is their inbox and turning it on
 * over their head would lock them out of their own account with no recovery codes to rescue them.
 * There is likewise no endpoint that grants admin — self-escalation would be the whole point of
 * compromising an admin session, so the grant stays an operator UPDATE against the database.
 */
export const adminRouter = Router();

adminRouter.use(authenticate);
adminRouter.use(requireAdmin);

// ─── Monitoring (reads) ──────────────────────────────────────────────
// Unrated: these are authenticated, admin-only, bounded by `limit`, and an operator refreshing a
// dashboard is the expected traffic. The write endpoints below are a different matter.

adminRouter.get('/two-factor/overview', asyncHandler(getOverview));

adminRouter.get(
  '/two-factor/users',
  validateRequest({ query: adminTwoFactorUsersQuerySchema }),
  asyncHandler(getUsers),
);

// Declared AFTER the fixed '/two-factor/users' path and BEFORE nothing else that could shadow it;
// the param schema rejects anything that is not a positive integer, so a stray word is a 400
// rather than a lookup for NaN.
adminRouter.get(
  '/two-factor/users/:id',
  validateRequest({ params: adminUserIdParamSchema }),
  asyncHandler(getUserDetail),
);

adminRouter.get(
  '/two-factor/events',
  validateRequest({ query: adminTwoFactorEventsQuerySchema }),
  asyncHandler(getEvents),
);

adminRouter.get(
  '/two-factor/challenges',
  validateRequest({ query: adminTwoFactorChallengesQuerySchema }),
  asyncHandler(getChallenges),
);

adminRouter.get(
  '/two-factor/actions',
  validateRequest({ query: adminActionsQuerySchema }),
  asyncHandler(getActions),
);

// ─── Privileged actions (writes) ─────────────────────────────────────
// Rate limited despite already being admin-only, and for a reason the read routes do not share: a
// stolen admin access token lives fifteen minutes and needs no password to use. These are the two
// endpoints someone holding one would point at the whole user table, so the ceiling bounds how
// many accounts a single compromised token can touch before it expires. Thirty an hour is far more
// than a human support queue needs and far less than a script wants.
const privilegedActionLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: 'Too many administrative actions. Please wait before continuing.',
});

adminRouter.post(
  '/two-factor/users/:id/disable',
  privilegedActionLimit,
  validateRequest({ params: adminUserIdParamSchema, body: adminTwoFactorActionSchema }),
  asyncHandler(postDisableUserTwoFactor),
);

adminRouter.post(
  '/two-factor/users/:id/challenges/revoke',
  privilegedActionLimit,
  validateRequest({ params: adminUserIdParamSchema, body: adminTwoFactorActionSchema }),
  asyncHandler(postRevokeUserTwoFactorChallenges),
);
