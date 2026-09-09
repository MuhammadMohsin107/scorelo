import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { ApiError } from '../middleware/error.js';
import { mailerConfigured, sendMail } from '../lib/mailer.js';
import { buildVerificationEmail } from '../lib/emails/emailVerification.js';
import { CHALLENGE_TTL_MS, consumeOpenChallenges, issueOtpChallenge, issueTicket, peekTicketUser, recordDelivery, redeemOtpChallenge, redeemTicket } from './auth-challenge.service.js';
import { recordSecurityEvent } from './security-event.service.js';
import {
  clearRecoveryCodes,
  countUnusedRecoveryCodes,
  issueRecoveryCodes,
  redeemRecoveryCode,
} from './recovery-code.service.js';
import { RECOVERY_CODE_COUNT } from '../lib/recoveryCodes.js';
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
 * RECOVERY CODES CLOSE THE LOCKOUT HOLE. Because the factor is an inbox, losing the inbox used to
 * mean losing the account — the only remedy was an operator disabling 2FA by hand. A set of
 * single-use codes is issued when 2FA is switched on and can be presented in place of the emailed
 * code, so the customer owns their own way back in. See recovery-code.service.ts.
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
}

/**
 * Starts the second step of a sign-in. Called only after bcrypt has accepted the password.
 *
 * ISSUES A TICKET AND SENDS NOTHING. The sign-in now has an explicit destination step: the customer
 * confirms which address the code should go to, and only then is a code minted and mailed. That is
 * why this no longer touches the mailer.
 *
 * WHY NOT MAIL IMMEDIATELY, as this used to. A code that goes out the instant a password is
 * accepted means every correct-password probe — including one by someone who bought the password in
 * a dump — puts mail in the customer's inbox. Waiting for the confirmation step costs one screen
 * and means the code is minted when a person is actually there to read it.
 *
 * NO SESSION AND NO TOKEN IS CREATED HERE. The ticket is not a credential for anything except
 * finishing this sign-in.
 */
export async function beginTwoFactorChallenge(
  user: { id: number },
): Promise<TwoFactorChallenge> {
  const { ticket } = await issueTicket(user.id, 'login_2fa_ticket');
  return { ticket };
}

/**
 * Mints a code and mails it — the shared body of "send" and "resend".
 *
 * Returns whether it actually went out. A delivery failure is NOT an error thrown at the customer:
 * the code exists and is valid, it simply has not arrived, and the honest answer lets the UI offer a
 * resend instead of pretending mail was sent.
 *
 * NOTHING SECRET IS LOGGED — not the code, not the address. Only the transport's own message.
 */
async function deliverLoginCode(user: { id: number; email: string; fullName: string }): Promise<boolean> {
  const { challengeId, code } = await issueOtpChallenge(user.id, 'login_2fa');

  if (!mailerConfigured()) {
    console.error(`[scorelo-auth] 2FA code not sent: SMTP is not configured (user ${user.id})`);
    await recordDelivery(challengeId, 'SMTP not configured');
    return false;
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
    return true;
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown transport error';
    await recordDelivery(challengeId, reason);
    console.error(`[scorelo-auth] 2FA email failed to send (user ${user.id}): ${reason}`);
    return false;
  }
}

/**
 * Step 2a of a sign-in: the customer names the address the code should go to, and it is sent.
 *
 * ─── THE GUARD THAT MAKES THIS STEP SAFE ─────────────────────────────
 *
 * THE ADDRESS IS CHECKED, NEVER OBEYED. The submitted value is compared against the account's own
 * registered address and is used for nothing else — the mail is addressed from the database row, not
 * from the request body. This is the whole security question this endpoint raises: if a caller could
 * name any inbox, then anyone holding a stolen password could have the second factor delivered to
 * themselves, and 2FA would protect nothing. So the field is a confirmation, not a choice.
 *
 * TELLING THE CALLER THEY GOT IT WRONG IS SAFE HERE, and deliberately different from
 * /auth/forgot-password, which must stay a uniform 202. To reach this line a caller has already
 * presented the correct password and holds a live ticket — they know the account exists. A clear
 * "that is not the address on this account" therefore discloses nothing they did not already have,
 * and the alternative is a customer staring at an inbox that will never receive anything.
 *
 * THE TICKET IS READ, NOT SPENT. It still has to survive to the verification step; consuming it
 * here would end the sign-in this call exists to advance.
 */
export async function sendTwoFactorCode(ticket: string, email: string): Promise<{ codeSent: boolean }> {
  const userId = await peekTicketUser(ticket, 'login_2fa_ticket');
  if (userId === null) {
    throw new ApiError(
      401,
      'Your sign-in has expired. Please enter your password again.',
      'TWO_FACTOR_TICKET_INVALID',
    );
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    throw new ApiError(401, 'Your sign-in has expired. Please enter your password again.', 'TWO_FACTOR_TICKET_INVALID');
  }

  // Same normalization the login and signup schemas apply, so a customer who types their address
  // with different capitalisation or a stray space is not refused for a difference that is not real.
  if (email.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
    console.warn(`[scorelo-auth] 2FA send refused: address did not match the account (user ${user.id})`);
    throw new ApiError(
      400,
      'That is not the email address on this account.',
      'TWO_FACTOR_EMAIL_MISMATCH',
    );
  }

  return { codeSent: await deliverLoginCode(user) };
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
  if (!user) return false;

  // No address is accepted here. A resend goes to the account's registered inbox and nowhere else —
  // the destination was already settled by sendTwoFactorCode(), and re-opening that choice would
  // reintroduce exactly the redirect this flow's guard exists to prevent.
  return deliverLoginCode(user);
}

/**
 * Completes a sign-in with a RECOVERY CODE instead of the emailed one.
 *
 * WHEN THIS IS THE ONLY WAY IN: the second factor is an inbox, and the customer has lost it. That
 * is the whole reason the codes exist.
 *
 * SAME TWO-CREDENTIAL SHAPE AS THE NORMAL PATH. The ticket proves the password step happened; the
 * recovery code stands in for the emailed code. A recovery code alone gets nobody in, so it is a
 * replacement for the SECOND factor and never for the first.
 *
 * THE TICKET IS CONSUMED WHETHER OR NOT THE CODE MATCHES, exactly as in completeTwoFactorChallenge
 * — so a stolen ticket cannot be used to grind through guesses across many requests. Combined with
 * 80 bits per code and the route's rate limit, guessing is not a viable path.
 *
 * Returns null for every failure, so the caller has one indistinguishable rejection.
 */
export async function completeTwoFactorWithRecoveryCode(
  ticket: string,
  recoveryCode: string,
): Promise<number | null> {
  const userId = await redeemTicket(ticket, 'login_2fa_ticket');
  if (userId === null) return null;

  const redeemed = await redeemRecoveryCode(userId, recoveryCode);
  if (!redeemed) {
    // Wrong, already spent, and never-existed are one line here and one rejection to the caller.
    console.warn(`[scorelo-auth] recovery code rejected (user ${userId})`);
    return null;
  }

  // Any emailed code still in flight is now moot — the sign-in it belonged to has completed by
  // another route, and leaving it live would mean a code sitting in an inbox still had meaning.
  await consumeOpenChallenges(userId, ['login_2fa']);

  console.log(`[scorelo-auth] sign-in completed with a recovery code (user ${userId})`);
  return userId;
}

/**
 * How many recovery codes the signed-in customer has left, for the Security page.
 *
 * Returns a COUNT, never the codes or their hashes — there is no endpoint anywhere that can read a
 * stored recovery code back, by design.
 */
export async function getRecoveryCodeStatus(userId: number): Promise<{ remaining: number; total: number }> {
  return { remaining: await countUnusedRecoveryCodes(userId), total: RECOVERY_CODE_COUNT };
}

/**
 * Issues a fresh set of recovery codes, voiding every previous one.
 *
 * PASSWORD-GATED, like enabling and disabling, and for the same reason: an access token lives
 * fifteen minutes and needs no password to use, so without this a stolen token could mint a working
 * set of second-factor bypasses for an attacker to keep. That is a quieter version of switching 2FA
 * off, and it must cost the same thing to do.
 *
 * REFUSED WHEN 2FA IS OFF. Codes that bypass a second factor that does not exist are not a feature,
 * and generating them would leave live bypass credentials lying against an account that never asked
 * for a second factor at all.
 */
export async function regenerateRecoveryCodes(
  userId: number,
  currentPassword: string,
  metadata: RequestMetadata,
): Promise<string[]> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) {
    await recordSecurityEvent({ userId, type: 'login_failed', metadata });
    throw new ApiError(400, 'Your current password is not correct.', 'CURRENT_PASSWORD_INVALID');
  }

  if (user.twoFactorEnabledAt === null) {
    throw new ApiError(
      400,
      'Turn on two-factor authentication before generating recovery codes.',
      'TWO_FACTOR_NOT_ENABLED',
    );
  }

  const recoveryCodes = await issueRecoveryCodes(userId);
  await recordSecurityEvent({ userId, type: 'recovery_codes_generated', metadata, context: { count: recoveryCodes.length } });
  console.log(`[scorelo-auth] recovery codes regenerated for user ${userId} (${recoveryCodes.length})`);

  return recoveryCodes;
}

export interface EnableTwoFactorResult {
  /** True when 2FA was already on and nothing changed. The caller must not claim a fresh enable. */
  alreadyEnabled: boolean;
  /**
   * The plaintext recovery codes, returned EXACTLY ONCE, in the response to the call that created
   * them. Null when nothing was issued.
   *
   * After this they exist only as SHA-256 hashes, so neither we nor an operator can ever show them
   * again. That is the property that makes them worth having, and it is why the UI has to say so
   * before the customer navigates away.
   */
  recoveryCodes: string[] | null;
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
): Promise<EnableTwoFactorResult> {
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
  // would be impossible. Recovery codes now exist as a fallback, but they are a way back in AFTER
  // something has gone wrong — not a substitute for a second factor that never worked at all.
  if (!mailerConfigured()) {
    throw new ApiError(
      503,
      'Two-factor authentication cannot be enabled right now. Please try again shortly.',
      'EMAIL_DELIVERY_UNAVAILABLE',
    );
  }

  // ALREADY ON is a no-op success, not an error: a double-submitted form or a second tab has done
  // nothing wrong. No codes are returned, because none were issued — handing back a fresh set here
  // would silently void the codes the customer already saved.
  if (user.twoFactorEnabledAt !== null) return { alreadyEnabled: true, recoveryCodes: null };

  // ORDERED SO THE CUSTOMER IS NEVER LOCKED OUT BY A HALF-DONE ENABLE. The codes are written first;
  // only then does 2FA come on. If the second write failed, the account would hold unused recovery
  // codes with 2FA still off — harmless. The reverse order could leave 2FA on with no way back in.
  const recoveryCodes = await issueRecoveryCodes(userId);
  await db.update(users).set({ twoFactorEnabledAt: new Date() }).where(eq(users.id, userId));

  await recordSecurityEvent({ userId, type: 'two_factor_enabled', metadata });
  await recordSecurityEvent({ userId, type: 'recovery_codes_generated', metadata, context: { count: recoveryCodes.length } });
  // The count, never the codes.
  console.log(`[scorelo-auth] 2FA enabled for user ${userId} with ${recoveryCodes.length} recovery codes`);

  return { alreadyEnabled: false, recoveryCodes };
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

  // ONE TRANSACTION, because a half-done disable is the dangerous state. Switching 2FA off while
  // the recovery codes survived would leave live second-factor bypasses attached to an account that
  // no longer has a second factor — credentials with nothing left to guard, still redeemable if 2FA
  // were ever switched back on. They go together or not at all.
  await db.transaction(async (tx) => {
    await tx.update(users).set({ twoFactorEnabledAt: null }).where(eq(users.id, userId));
    await clearRecoveryCodes(userId, tx);
  });

  await recordSecurityEvent({ userId, type: 'two_factor_disabled', metadata });
  console.log(`[scorelo-auth] 2FA disabled for user ${userId}`);
}

