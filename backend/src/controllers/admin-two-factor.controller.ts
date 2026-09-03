import type { Request, Response } from 'express';
import { requestMetadata } from '../lib/requestMetadata.js';
import { requireAdminIdentity } from '../middleware/requireAdmin.js';
import {
  adminDisableTwoFactor,
  adminRevokeTwoFactorChallenges,
  getTwoFactorOverview,
  getTwoFactorUserDetail,
  listAdminActions,
  listTwoFactorChallenges,
  listTwoFactorEvents,
  listTwoFactorUsers,
  type Page,
} from '../services/admin-two-factor.service.js';
import type {
  AdminActionsQuery,
  AdminTwoFactorChallengesQuery,
  AdminTwoFactorEventsQuery,
  AdminTwoFactorUsersQuery,
} from '../schemas/admin.schema.js';

/**
 * ─── Admin → 2FA ─────────────────────────────────────────────────────
 *
 * TWO IDENTITIES, AND THEY COME FROM DIFFERENT PLACES ON PURPOSE:
 *
 *   the ACTING admin  →  requireAdminIdentity(req), i.e. the row requireAdmin re-read from MySQL
 *                        after `authenticate` verified a signed token. Never from the input.
 *   the TARGET account →  req.params.id, validated as a positive integer, and confined to the path
 *                        so every privileged call names its target in the route and the access log.
 *
 * Nothing here reads an actor from a body, so there is no attacker-controlled identity competing
 * with the real one — the same rule the customer-side security controller follows, extended to the
 * one case where a second account is legitimately involved.
 *
 * Every response is built from explicitly selected columns in the service. No handler spreads a
 * raw user row, so a hash cannot reach a response by being added to a table later.
 */

/** One envelope for every paginated read, so a client pages all six the same way. */
function paged<T>(res: Response, page: Page<T>) {
  res.json({ data: page.rows, meta: { total: page.total, limit: page.limit, offset: page.offset } });
}

export async function getOverview(_req: Request, res: Response) {
  res.json({ data: await getTwoFactorOverview() });
}

export async function getUsers(req: Request, res: Response) {
  const query = req.query as AdminTwoFactorUsersQuery;
  paged(res, await listTwoFactorUsers(query));
}

export async function getUserDetail(req: Request, res: Response) {
  res.json({ data: await getTwoFactorUserDetail(Number(req.params.id)) });
}

export async function getEvents(req: Request, res: Response) {
  const query = req.query as AdminTwoFactorEventsQuery;
  paged(res, await listTwoFactorEvents(query));
}

export async function getChallenges(req: Request, res: Response) {
  const query = req.query as AdminTwoFactorChallengesQuery;
  paged(res, await listTwoFactorChallenges(query));
}

export async function getActions(req: Request, res: Response) {
  const query = req.query as AdminActionsQuery;
  paged(res, await listAdminActions(query));
}

/**
 * Forces 2FA off for one account.
 *
 * The response says whether anything actually changed, so the UI can tell an operator "it was
 * already off" instead of implying they just removed a protection that was not there.
 */
export async function postDisableUserTwoFactor(req: Request, res: Response) {
  const result = await adminDisableTwoFactor(
    requireAdminIdentity(req),
    Number(req.params.id),
    req.body.reason,
    requestMetadata(req),
  );
  res.json({ data: result });
}

/** Closes the 2FA codes/tickets open on one account, ending a sign-in in progress. */
export async function postRevokeUserTwoFactorChallenges(req: Request, res: Response) {
  const result = await adminRevokeTwoFactorChallenges(
    requireAdminIdentity(req),
    Number(req.params.id),
    req.body.reason,
    requestMetadata(req),
  );
  res.json({ data: result });
}
