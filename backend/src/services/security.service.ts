import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { ApiError } from '../middleware/error.js';
import { revokeOtherSessions } from './session.service.js';
import { recordSecurityEvent } from './security-event.service.js';
import type { RequestMetadata } from '../lib/requestMetadata.js';
import type { ChangePasswordInput } from '../schemas/security.schema.js';

/**
 * ─── Authenticated password change ───────────────────────────────────
 *
 * Distinct from password RESET, and deliberately so. Reset is for someone locked out and proves
 * control of the inbox; this is for someone already signed in and proves knowledge of the current
 * password. They are different claims, so they are different code paths — neither weakens the
 * other, and neither is a way around it.
 */

/** Matches auth.service.ts and password-reset.service.ts. All three must move together, or one
 * path would silently write a weaker hash than the others. */
const SALT_ROUNDS = 12;

/**
 * Changes the signed-in customer's password.
 *
 * `userId` comes from the authenticated request via requireUserId() and is never taken from a
 * request body — so this cannot be pointed at another account.
 *
 * SESSION POLICY: the current session survives, every other session is revoked. The customer
 * stays signed in where they are; every other device is cut off immediately. That is the point of
 * changing a password under suspicion — and because the revocation happens in the sessions table,
 * the old refresh tokens on those devices stop working at their very next use rather than living
 * out their 30-day TTL.
 *
 * NOTHING SENSITIVE IS LOGGED OR RETURNED: not the old password, not the new one, not either hash.
 */
export async function changePassword(
  userId: number,
  input: ChangePasswordInput,
  metadata: RequestMetadata,
  currentRefreshToken?: string,
): Promise<{ otherSessionsRevoked: number }> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');

  // The current password is the whole authorisation for this change. Without it, a stolen access
  // token — which lives 15 minutes and needs no password to use — would be enough to take an
  // account permanently.
  const currentMatches = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!currentMatches) {
    // Recorded as a failed authentication against a real account: an owner seeing this in their
    // history is being told someone with a live session could not produce their password.
    await recordSecurityEvent({ userId, type: 'login_failed', metadata });
    throw new ApiError(400, 'Your current password is not correct.', 'CURRENT_PASSWORD_INVALID');
  }

  // Re-setting the same password revokes every other device while changing nothing — the customer
  // gets the disruption without the security benefit. Compared with bcrypt against the stored
  // hash rather than by comparing the two plaintexts, which keeps the check constant-time.
  const unchanged = await bcrypt.compare(input.newPassword, user.passwordHash);
  if (unchanged) {
    throw new ApiError(400, 'Choose a password different from your current one.', 'PASSWORD_UNCHANGED');
  }

  const passwordHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);

  await db
    .update(users)
    .set({
      passwordHash,
      passwordChangedAt: new Date(),
      // The legacy single-token columns are not touched here. They are no longer read by anything
      // since sessions became authoritative, and clearing them would imply they still mean
      // something. Revocation happens in user_sessions, below.
    })
    .where(eq(users.id, userId));

  const otherSessionsRevoked = await revokeOtherSessions(userId, currentRefreshToken);

  await recordSecurityEvent({
    userId,
    type: 'password_changed',
    metadata,
    context: { otherSessionsRevoked },
  });

  console.log(`[scorelo-security] password changed for user ${userId}; ${otherSessionsRevoked} other session(s) revoked`);
  return { otherSessionsRevoked };
}
