import { z } from 'zod';
import { TWO_FACTOR_EVENT_TYPES } from '../services/security-event.service.js';

/**
 * ─── Admin 2FA endpoint inputs ───────────────────────────────────────
 *
 * THE DIFFERENCE FROM security.schema.ts, and it is the whole reason this file exists separately:
 * those schemas deliberately carry no `userId`, because a customer acts only on themselves.
 * An admin acts on OTHER accounts, so a target id is unavoidable here. It is confined to the PATH
 * (`/users/:id`), never the body, so a target is always visible in the route and in the access log
 * rather than buried in a payload — and the ACTING admin's id still comes from the authenticated
 * request, never from any part of the input.
 *
 * Every schema is `.strict()`, so an unexpected field is a 400 rather than something quietly
 * ignored. That matters most on the action endpoints: a caller who thinks they sent
 * `{ reason, alsoRevokeSessions: true }` must not have half their intent silently dropped.
 */

/** Target ids are internal auto-increment integers; anything else is malformed, not "not found". */
export const adminUserIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
}).strict();

/**
 * Shared pagination. Bounded so no admin call can ask for an unbounded table scan — the user and
 * event tables grow without limit, and "give me everything" is the query that takes the API down.
 */
const paginationShape = {
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).max(100_000).optional(),
};

/**
 * The 2FA roster filter.
 *
 * `search` matches the name or the address, and is capped at 200 characters. It is passed to
 * Drizzle as a bound parameter (never string-concatenated into SQL), and `%`/`_` are escaped in
 * the service so a caller cannot turn a search into a full-table LIKE '%%' scan.
 */
export const adminTwoFactorUsersQuerySchema = z.object({
  ...paginationShape,
  /** true → only accounts with 2FA on; false → only accounts with it off; omitted → both. */
  enabled: z.stringbool().optional(),
  /** true → only verified addresses; false → only unverified. Unverified accounts are the ones
   * that CANNOT turn 2FA on, which is what makes this worth filtering on. */
  emailVerified: z.stringbool().optional(),
  /** Admins only — the roster view that answers "are our own operators protected?". */
  adminsOnly: z.stringbool().optional(),
  search: z.string().trim().min(1).max(200).optional(),
}).strict();

/** The cross-account 2FA event feed. `type` is constrained to the 2FA vocabulary, so this endpoint
 * cannot be widened into a general read of every security event by passing an arbitrary string. */
export const adminTwoFactorEventsQuerySchema = z.object({
  ...paginationShape,
  userId: z.coerce.number().int().positive().optional(),
  type: z.enum(TWO_FACTOR_EVENT_TYPES).optional(),
}).strict();

/**
 * Challenge / delivery health.
 *
 * `open` = issued, unspent and unexpired right now. `undelivered` = a send was attempted and
 * failed, which is the queue an operator actually works through when customers report missing
 * codes. `all` is every 2FA challenge row in the window.
 */
export const adminTwoFactorChallengesQuerySchema = z.object({
  ...paginationShape,
  userId: z.coerce.number().int().positive().optional(),
  status: z.enum(['all', 'open', 'undelivered']).optional(),
}).strict();

/** The operator trail. */
export const adminActionsQuerySchema = z.object({
  ...paginationShape,
  targetUserId: z.coerce.number().int().positive().optional(),
  actorUserId: z.coerce.number().int().positive().optional(),
}).strict();

/**
 * The body of every privileged 2FA action.
 *
 * A REASON IS MANDATORY. These endpoints remove a protection from an account whose owner did not
 * ask; a row in the operator trail saying only "an admin did this" is not something a later
 * investigation can use. Ten characters is enough to stop a single keystroke passing as a
 * justification without turning the field into a form to fill in.
 *
 * Bounded to 500 to match `admin_security_actions.reason` — validating at the column width means a
 * long reason is refused with a clear 400 rather than silently truncated into the audit record.
 *
 * NOTE WHAT IS NOT HERE: no password, no code, no ticket, no target id. The admin's own password is
 * not taken because it would not be checked against the account being changed, and an unverifiable
 * secret in a request body is worse than no secret at all.
 */
export const adminTwoFactorActionSchema = z.object({
  reason: z.string().trim().min(10).max(500),
}).strict();

export type AdminTwoFactorUsersQuery = z.infer<typeof adminTwoFactorUsersQuerySchema>;
export type AdminTwoFactorEventsQuery = z.infer<typeof adminTwoFactorEventsQuerySchema>;
export type AdminTwoFactorChallengesQuery = z.infer<typeof adminTwoFactorChallengesQuerySchema>;
export type AdminActionsQuery = z.infer<typeof adminActionsQuerySchema>;
export type AdminTwoFactorActionInput = z.infer<typeof adminTwoFactorActionSchema>;
