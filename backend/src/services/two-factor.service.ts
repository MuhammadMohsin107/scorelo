import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { ApiError } from '../middleware/error.js';
import { mailerConfigured, sendMail } from '../lib/mailer.js';
import { buildVerificationEmail } from '../lib/emails/emailVerification.js';
import { CHALLENGE_TTL_MS, issueOtpChallenge, issueTicket, peekTicketUser, recordDelivery, redeemOtpChallenge, redeemTicket } from './auth-challenge.service.js';
import { recordSecurityEvent } from './security-event.service.js';
import type { RequestMetadata } from '../lib/requestMetadata.js';

/**
 * ─── Email one-time-code 2FA ─────────────────────────────────────────
 *
 * THE DISTINCTION THAT MATTERS. Phase 1's email verification answers "is this address yours?" —
 * asked once, permanently. This answers "are you presenting a second factor right now?" — asked at
 * every sign-in. They use the same OTP machinery and are not the same claim, which is why they
 * have separate challenge purposes, separate columns, and separate code paths. Verifying an
 * address still issues no session; only completing this flow does.
 *
 * THE FACTOR IS CONTROL OF THE VERIFIED INBOX. Nothing secret is stored for it — there is no
 * shared secret to leak, unlike an authenticator app. The trade-off, stated plainly: email 2FA is
 * only as strong as the customer's mailbox, and it is weaker than TOTP against an attacker who
 * has already compromised that mailbox. It is also the only second factor available without a new
 * dependency, and it is a real improvement over a password alone.
 *
 * THE TWO-STEP SHAPE mirrors password reset exactly, and for the same reason:
 *
 *   password verified  →  6-digit code emailed  +  256-bit pending-login ticket returned
 *   ticket + code      →  session issued
 *
 * The ticket is what proves the password step actually happened. Without it, anyone who read the
 * emailed code could complete a sign-in having never known the password — which would make the
 * second factor a replacement for the first rather than an addition to it.
 */

export interface TwoFactorChallenge {
  /** Single-use, 256-bit, ten minutes. Proves the password step succeeded. */
  ticket: string;
  /** False when the code could not be delivered. The caller reports this honestly. */
  codeSent: boolean;
}

/**
 * Starts the second step of a sign-in. Called only after bcrypt has accepted the password.
 *
 * Returns a ticket even when delivery fails, so the customer lands on the code screen and can ask
 * for a resend rather than being bounced back to a password form that will just succeed again.
 */
export async function beginTwoFactorChallenge(
  user: { id: number; email: string; fullName: string },
): Promise<TwoFactorChallenge> {
  const { challengeId, code } = await issueOtpChallenge(user.id, 'login_2fa');
  const { ticket } = await issueTicket(user.id, 'login_2fa_ticket');

  if (!mailerConfigured()) {
    console.error(`[scorelo-auth] 2FA code not sent: SMTP is not configured (user ${user.id})`);
    await recordDelivery(challengeId, 'SMTP not configured');
    return { ticket, codeSent: false };
  }

  const message = buildVerificationEmail({
    to: user.email,
    fullName: user.fullName,
    code,
    expiresInMinutes: Math.round(CHALLENGE_TTL_MS / 60_000),
    purpose: 'login',
  });

  try {
    await sendMail(message);
    await recordDelivery(challengeId);
    return { ticket, codeSent: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown transport error';
    await recordDelivery(challengeId, reason);
    // Never the code, never the address.
    console.error(`[scorelo-auth] 2FA email failed to send (user ${user.id}): ${reason}`);
    return { ticket, codeSent: false };
  }
}

/**
 * Completes the second step, returning the user id when both credentials check out.
 *
 * BOTH ARE REQUIRED. The ticket is redeemed first — it identifies WHO is signing in, and it is
 * consumed whether or not the code then matches, so a stolen ticket cannot be used to grind
 * through codes across many requests. The code is checked against its own five-attempt budget.
 *
 * Returns null for every failure, so the caller has one indistinguishable rejection.
 */
export async function completeTwoFactorChallenge(ticket: string, code: string): Promise<number | null> {
  const userId = await redeemTicket(ticket, 'login_2fa_ticket');
  if (userId === null) return null;

  const redeemed = await redeemOtpChallenge(userId, 'login_2fa', code);
  if (!redeemed) {
    console.warn(`[scorelo-auth] 2FA rejected: wrong or expired code (user ${userId})`);
    return null;
  }

  return userId;
}

/** Re-sends the code for a sign-in already in progress, without re-checking the password.
 *
 * The ticket is NOT consumed — it still has to survive to the verification step. It is only read,
 * to establish which account is mid-login. A caller without a valid ticket gets nothing, so this
 * cannot be used to mail codes to an address the caller has not already authenticated against. */
export async function resendTwoFactorCode(ticket: string): Promise<boolean> {
  const userId = await peekTicketUser(ticket, 'login_2fa_ticket');
  if (userId === null) return false;

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user || !mailerConfigured()) return false;

  const { challengeId, code } = await issueOtpChallenge(user.id, 'login_2fa');
  const message = buildVerificationEmail({
    to: user.email,
    fullName: user.fullName,
    code,
    expiresInMinutes: Math.round(CHALLENGE_TTL_MS / 60_000),
    purpose: 'login',
  });

  try {
    await sendMail(message);
    await recordDelivery(challengeId);
    return true;
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown transport error';
    await recordDelivery(challengeId, reason);
    console.error(`[scorelo-auth] 2FA resend failed (user ${user.id}): ${reason}`);
    return false;
  }
}

/**
 * Turns 2FA on for the signed-in customer.
 *
 * TWO GUARDS, both load-bearing:
 *
 *   1. THE CURRENT PASSWORD. An access token lives fifteen minutes and needs no password to use.
 *      Without this, a stolen token could enable 2FA on an inbox the thief controls — turning a
 *      protection into a lockout.
 *
 *   2. A VERIFIED EMAIL ADDRESS. The second factor IS the inbox. Enabling it on an address nobody
 *      has proved they can read would lock the customer out of their own account permanently, with
 *      no recovery codes in this phase to rescue them. This is refused rather than warned about.
 */
export async function enableTwoFactor(
  userId: number,
  currentPassword: string,
  metadata: RequestMetadata,
): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) {
    await recordSecurityEvent({ userId, type: 'login_failed', metadata });
    throw new ApiError(400, 'Your current password is not correct.', 'CURRENT_PASSWORD_INVALID');
  }

  if (user.emailVerifiedAt === null) {
    throw new ApiError(
      400,
      'Verify your email address before turning on two-factor authentication — the codes are sent there.',
      'EMAIL_NOT_VERIFIED',
    );
  }

  // Refusing here rather than enabling-and-hoping: with no working mail, the very next sign-in
  // would be impossible and there is no backup factor to fall back on.
  if (!mailerConfigured()) {
    throw new ApiError(
      503,
      'Two-factor authentication cannot be enabled right now. Please try again shortly.',
      'EMAIL_DELIVERY_UNAVAILABLE',
    );
  }

  if (user.twoFactorEnabledAt !== null) return;

  await db.update(users).set({ twoFactorEnabledAt: new Date() }).where(eq(users.id, userId));
  await recordSecurityEvent({ userId, type: 'two_factor_enabled', metadata });
  console.log(`[scorelo-auth] 2FA enabled for user ${userId}`);
}

/**
 * Turns 2FA off.
 *
 * Password-gated for the same reason enabling is: removing a protection is exactly what an
 * attacker holding a session would want to do first, and a fifteen-minute access token must not be
 * enough to do it.
 */
export async function disableTwoFactor(
  userId: number,
  currentPassword: string,
  metadata: RequestMetadata,
): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) {
    await recordSecurityEvent({ userId, type: 'login_failed', metadata });
    throw new ApiError(400, 'Your current password is not correct.', 'CURRENT_PASSWORD_INVALID');
  }

  if (user.twoFactorEnabledAt === null) return;

  await db.update(users).set({ twoFactorEnabledAt: null }).where(eq(users.id, userId));
  await recordSecurityEvent({ userId, type: 'two_factor_disabled', metadata });
  console.log(`[scorelo-auth] 2FA disabled for user ${userId}`);
}

