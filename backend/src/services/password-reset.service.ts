import bcrypt from 'bcryptjs';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { passwordResetTokens, users } from '../db/schema.js';
import { env } from '../config/env.js';
import { ApiError } from '../middleware/error.js';
import { mailerConfigured, sendMail } from '../lib/mailer.js';
import { buildPasswordResetLinkEmail } from '../lib/emails/passwordResetLink.js';
import {
  consumeAllChallenges,
  issueTicket,
  redeemOtpChallenge,
  redeemTicket,
} from './auth-challenge.service.js';
import { revokeAllSessions } from './session.service.js';
import { recordSecurityEvent } from './security-event.service.js';
import type { RequestMetadata } from '../lib/requestMetadata.js';
import type { ForgotPasswordInput, ResetPasswordInput } from '../schemas/auth.schema.js';

/**
 * ─── Password reset ──────────────────────────────────────────────────
 * Extends the existing auth service rather than replacing any of it: the same bcrypt cost, the
 * same `users.password_hash` column, the same ApiError conventions. Login, signup, refresh and
 * logout are untouched.
 */

/** Matches SALT_ROUNDS in auth.service.ts. Both must move together or reset would silently
 * write a weaker hash than signup does. */
const SALT_ROUNDS = 12;

/**
 * 30 minutes. Long enough to survive a slow inbox or a coffee break, short enough that a link
 * sitting in an unattended mailbox stops being a credential quickly.
 */
export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

/** Same construction as auth.service.ts's refresh-token hashing, for one consistent scheme.
 * SHA-256 (not bcrypt) is correct here: the input is already high-entropy random, so there is
 * nothing to slow down a dictionary attack against — and lookup must be an indexed point-read. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// `resolveLegacyToken` keeps its name because the CODE flow is still supported alongside this
// one: /auth/verify-reset-code exchanges a six-digit code for a ticket, and resetPassword accepts
// either credential. Both paths land on the same transaction, so a link already in an inbox and a
// code already in flight both keep working.

/**
 * Requests a reset.
 *
 * ALWAYS RESOLVES THE SAME WAY, whatever happened internally — unknown address, known address,
 * SMTP down. The caller returns one fixed message. Any difference in response, status code or
 * timing would turn this endpoint into an account-existence oracle, which is precisely the attack
 * the generic response exists to prevent.
 *
 * Delivery failures are logged server-side (where operators can see them) and swallowed
 * client-side. That is not hiding an error: telling the requester "we could not send mail to that
 * address" confirms the address is on file.
 */
export async function requestPasswordReset(input: ForgotPasswordInput): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);

  // No account: stop here silently. Nothing is written, nothing is sent, and the caller's
  // response is identical to the success path.
  if (!user) {
    console.log('[scorelo-auth] password reset requested for an address with no account');
    return;
  }

  if (!mailerConfigured()) {
    // Do NOT mint a code we cannot deliver — it would sit in the table as a live credential
    // that nobody can use, and the customer would wait for mail that is never coming.
    //
    // Unlike signup, this failure CANNOT be reported to the caller: this endpoint answers
    // identically for every address by design, and "we could not send mail to you" would confirm
    // the address is on file. Operators see it in the log; the requester sees the same 202.
    console.error('[scorelo-auth] password reset requested but SMTP is not configured; no email sent');
    return;
  }

  // ── One-time link ──────────────────────────────────────────────────
  // The emailed credential is a LINK again. It was briefly a six-digit code, which made the
  // customer the transport: read the code, switch windows, retype it before it expired. The token
  // below is 256 bits of CSPRNG output, so the link is also the stronger of the two — a code is a
  // million-space number that has to be rate-limited to stay safe, and this is not guessable at all.
  //
  // Only the SHA-256 hash is stored. A dump of `password_reset_tokens` therefore yields nothing
  // usable, and the raw token exists only in the email.
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  // Any earlier unused link for this account is spent first. Requesting a new one is what a
  // customer does when the old mail is lost or was intercepted, and leaving the previous link
  // live would mean the "new" request did not actually replace anything.
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)));

  await db.insert(passwordResetTokens).values({ userId: user.id, tokenHash: hashToken(token), expiresAt });

  const resetUrl = `${env.frontendUrl.replace(/\/+$/, '')}/reset-password?token=${encodeURIComponent(token)}`;

  try {
    await sendMail(buildPasswordResetLinkEmail({
      to: user.email,
      fullName: user.fullName,
      resetUrl,
      expiresInMinutes: Math.round(RESET_TOKEN_TTL_MS / 60_000),
    }));
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    // Logged without the address, the token or the URL — all three would leak what the generic
    // response protects. The row is burned so an undeliverable link cannot sit there live.
    console.error(`[scorelo-auth] password reset email failed to send: ${reason}`);
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.tokenHash, hashToken(token)), isNull(passwordResetTokens.usedAt)));
  }
}

/**
 * Step two: exchange a correct reset code for the credential that can actually change a password.
 *
 * The split matters. A six-digit code is something a person can type, which means it is something
 * an attacker can guess — bounded here by five attempts and ten minutes, but bounded is not the
 * same as strong. So the code never sets a password; it only proves inbox control, and what comes
 * back is 256 bits of CSPRNG entropy. The reset flow keeps exactly the credential strength it had
 * before this phase, with an extra step in front of it rather than a weaker one in place of it.
 *
 * Returns null for every rejection — unknown address, wrong code, expired, spent, exhausted — so
 * the caller has one indistinguishable failure to surface.
 */
export async function verifyResetCode(email: string, code: string): Promise<string | null> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    console.warn('[scorelo-auth] reset code rejected: no account for that address');
    return null;
  }

  const redeemed = await redeemOtpChallenge(user.id, 'password_reset', code);
  if (!redeemed) return null;

  const { ticket } = await issueTicket(user.id, 'password_reset_ticket');
  console.log(`[scorelo-auth] reset code verified; ticket issued for user ${user.id}`);
  // The raw ticket exists only in this return value and the single response that carries it.
  return ticket;
}

/** Constant-time comparison of two hex digests, so a mismatch leaks nothing through timing. */
function hashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * LEGACY, TEMPORARY. Redeems an emailed `?token=` link from before the OTP flow.
 *
 * Kept for exactly one release so links already sitting in customers' inboxes still work — no new
 * ones are ever generated (requestPasswordReset now issues a code instead). Its security is
 * unchanged and deliberately untouched: unique-hash lookup, constant-time compare, used/expired
 * checks, one uniform rejection.
 *
 * DELETE THIS, and the `password_reset_tokens` table with it, once the longest outstanding link
 * has passed its 30-minute expiry plus a safety margin.
 */
async function resolveLegacyToken(token: string): Promise<{ userId: number; recordId: number } | null> {
  const tokenHash = hashToken(token);
  const [record] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash)).limit(1);

  if (!record) {
    console.warn('[scorelo-auth] password reset rejected: no matching token');
    return null;
  }
  // Defence in depth. The WHERE above already matched on the unique hash, so this can only fail
  // if that guarantee is ever weakened; the constant-time compare keeps the check itself safe.
  if (!hashesMatch(record.tokenHash, tokenHash)) {
    console.warn('[scorelo-auth] password reset rejected: token hash mismatch');
    return null;
  }
  if (record.usedAt !== null) {
    console.warn(`[scorelo-auth] password reset rejected: token already used (user ${record.userId})`);
    return null;
  }
  if (record.expiresAt.getTime() <= Date.now()) {
    console.warn(`[scorelo-auth] password reset rejected: token expired (user ${record.userId})`);
    return null;
  }
  return { userId: record.userId, recordId: record.id };
}

/**
 * Sets the new password, given whichever credential the caller holds.
 *
 * Two accepted credentials, one behaviour: the current 256-bit `ticket` minted by
 * verifyResetCode(), or the legacy emailed `token`. The schema guarantees exactly one is present.
 * Both are high-entropy and single-use — the six-digit code is NOT accepted here and never has
 * been, which is what keeps a guessable number from ever being the thing that changes a password.
 *
 * Every rejection path returns the SAME error. A caller must not be able to distinguish "no such
 * credential" from "expired" from "already used": the differences would let someone probe which
 * ones have existed. Operators still get the precise reason in the server log.
 */
export async function resetPassword(input: ResetPasswordInput, metadata?: RequestMetadata): Promise<void> {
  const invalid = () => new ApiError(400, 'This password reset link is invalid or has expired. Please request a new one.', 'RESET_TOKEN_INVALID');

  let userId: number | null = null;
  let legacyRecordId: number | null = null;

  if (input.ticket) {
    userId = await redeemTicket(input.ticket, 'password_reset_ticket');
  } else if (input.token) {
    const legacy = await resolveLegacyToken(input.token);
    userId = legacy?.userId ?? null;
    legacyRecordId = legacy?.recordId ?? null;
  }

  if (userId === null) throw invalid();

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    console.warn('[scorelo-auth] password reset rejected: credential references a deleted user');
    throw invalid();
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  // One transaction so the system can never land between "password changed" and "token still
  // usable", or "token consumed" and "password unchanged".
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        passwordHash,
        passwordChangedAt: new Date(),
        // The legacy single-token columns are cleared for tidiness only — nothing reads them since
        // user_sessions became authoritative in Phase 2. The real revocation happens below.
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      })
      .where(eq(users.id, user.id));

    if (legacyRecordId !== null) {
      await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, legacyRecordId));
    }

    // Any sibling credential still in flight is now moot, on BOTH tables. A customer who
    // requested a reset twice, or who has a legacy link and a new code outstanding, must not be
    // left holding a second way in after the password has already changed.
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)));

    await consumeAllChallenges(user.id, tx);
  });

  // EVERY session goes — unlike a password CHANGE, which spares the current device. Whoever asked
  // for this reset may be locking out someone who already holds the old credentials, so there is
  // no device here that has earned the benefit of the doubt.
  const sessionsRevoked = await revokeAllSessions(user.id);

  await recordSecurityEvent({
    userId: user.id,
    type: 'password_reset',
    metadata,
    context: { sessionsRevoked },
  });

  console.log(`[scorelo-auth] password reset completed for user ${user.id}; ${sessionsRevoked} session(s) revoked`);
}
