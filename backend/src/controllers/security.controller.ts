import type { Request, Response } from 'express';
import { requireUserId } from '../lib/requestContext.js';
import { requestMetadata } from '../lib/requestMetadata.js';
import { listSessions, revokeOtherSessions, revokeSession } from '../services/session.service.js';
import { listSecurityEvents, recordSecurityEvent } from '../services/security-event.service.js';
import { changePassword } from '../services/security.service.js';
import { disableTwoFactor, enableTwoFactor } from '../services/two-factor.service.js';

/**
 * ─── Settings → Security ─────────────────────────────────────────────
 *
 * Every handler resolves WHOSE data this is with requireUserId(req) — the id the `authenticate`
 * middleware put on the request after verifying a signed access token. No handler reads a user id
 * from a body, a query string or a path parameter, so there is no attacker-controlled identity to
 * confuse with the real one.
 *
 * Nothing here fabricates a value. When there are no sessions or no events, the response is an
 * empty array and the UI says so.
 */

export async function getSessions(req: Request, res: Response) {
  res.json({ data: await listSessions(requireUserId(req)) });
}

/**
 * Revokes one session.
 *
 * Ownership is enforced inside revokeSession(), where user_id is part of the UPDATE's predicate
 * rather than a check performed alongside it. A session belonging to someone else raises 404 —
 * the same answer as an id that never existed — so this endpoint cannot be used to discover which
 * session ids are real.
 */
export async function postRevokeSession(req: Request, res: Response) {
  const userId = requireUserId(req);
  const sessionId = Number(req.params.id);

  await revokeSession(userId, sessionId);
  await recordSecurityEvent({
    userId,
    type: 'session_revoked',
    metadata: requestMetadata(req),
    context: { sessionId },
  });

  res.status(204).send();
}

/**
 * Signs out every other device.
 *
 * The optional `refreshToken` in the body is the caller's own, used only to work out which row to
 * spare. Absent — or matching nothing — every session goes, which is the safe direction to fail.
 */
export async function postRevokeOtherSessions(req: Request, res: Response) {
  const userId = requireUserId(req);
  const revoked = await revokeOtherSessions(userId, req.body?.refreshToken);

  // Only recorded when something actually happened. An event saying "0 sessions revoked" would be
  // history of a non-event.
  if (revoked > 0) {
    await recordSecurityEvent({
      userId,
      type: 'sessions_revoked',
      metadata: requestMetadata(req),
      context: { revoked },
    });
  }

  res.json({ data: { revoked } });
}

export async function getSecurityEvents(req: Request, res: Response) {
  const limit = typeof req.query.limit === 'number' ? req.query.limit : undefined;
  res.json({ data: await listSecurityEvents(requireUserId(req), limit) });
}

/**
 * Changes the password of the signed-in customer, and nobody else.
 *
 * The response carries how many other sessions were ended so the UI can tell the customer plainly
 * what just happened to their other devices. It never carries a password or a hash.
 */
/** Turns email 2FA on. Refuses when the address is unverified — the codes go there. */
export async function postEnableTwoFactor(req: Request, res: Response) {
  await enableTwoFactor(requireUserId(req), req.body.currentPassword, requestMetadata(req));
  res.json({ data: { twoFactorEnabled: true } });
}

export async function postDisableTwoFactor(req: Request, res: Response) {
  await disableTwoFactor(requireUserId(req), req.body.currentPassword, requestMetadata(req));
  res.json({ data: { twoFactorEnabled: false } });
}

export async function postChangePassword(req: Request, res: Response) {
  const result = await changePassword(
    requireUserId(req),
    req.body,
    requestMetadata(req),
    req.body?.refreshToken,
  );
  res.json({ data: { message: 'Password updated.', otherSessionsRevoked: result.otherSessionsRevoked } });
}
