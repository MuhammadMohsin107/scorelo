import bcrypt from 'bcryptjs';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { passwordResetTokens, users } from '../db/schema.js';
import { env } from '../config/env.js';
import { ApiError } from '../middleware/error.js';
import { mailerConfigured, sendMail } from '../lib/mailer.js';
import { buildPasswordResetEmail } from '../lib/emails/passwordReset.js';
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

/** 32 bytes = 256 bits of entropy from the OS CSPRNG. Not guessable, not enumerable. */
const TOKEN_BYTES = 32;

/** Same construction as auth.service.ts's refresh-token hashing, for one consistent scheme.
 * SHA-256 (not bcrypt) is correct here: the input is already high-entropy random, so there is
 * nothing to slow down a dictionary attack against — and lookup must be an indexed point-read. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** URL-safe, no padding — survives being pasted into a query string unescaped. */
function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

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
    // Do NOT mint a token we cannot deliver — it would sit in the table as a live credential
    // that nobody can use, and the customer would wait for mail that is never coming.
    console.error('[scorelo-auth] password reset requested but SMTP is not configured; no email sent');
    return;
  }

  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await db.transaction(async (tx) => {
    // Supersede every outstanding token for this user. Requesting a new link is an implicit
    // statement that the previous one should stop working — e.g. after forwarding it by mistake.
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)));

    await tx.insert(passwordResetTokens).values({ userId: user.id, tokenHash, expiresAt });
  });

  // The raw token exists only in this variable and the outgoing message — never persisted,
  // never logged.
  const resetUrl = new URL('/reset-password', env.frontendUrl);
  resetUrl.searchParams.set('token', rawToken);

  const message = buildPasswordResetEmail({
    to: user.email,
    fullName: user.fullName,
    resetUrl: resetUrl.toString(),
    expiresInMinutes: Math.round(RESET_TOKEN_TTL_MS / 60_000),
  });

  try {
    await sendMail(message);
  } catch (error) {
    // Logged without the address or the URL — both would leak what the generic response protects.
    console.error(`[scorelo-auth] password reset email failed to send: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

/** Constant-time comparison of two hex digests, so a mismatch leaks nothing through timing. */
function hashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Redeems a reset token and sets the new password.
 *
 * Every rejection path returns the SAME error. A caller must not be able to distinguish "no such
 * token" from "expired" from "already used": the differences would let someone probe which tokens
 * have existed. Operators still get the precise reason in the server log.
 */
export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const invalid = () => new ApiError(400, 'This password reset link is invalid or has expired. Please request a new one.', 'RESET_TOKEN_INVALID');

  const tokenHash = hashToken(input.token);
  const [record] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash)).limit(1);

  if (!record) {
    console.warn('[scorelo-auth] password reset rejected: no matching token');
    throw invalid();
  }
  // Defence in depth. The WHERE above already matched on the unique hash, so this can only fail
  // if that guarantee is ever weakened; the constant-time compare keeps the check itself safe.
  if (!hashesMatch(record.tokenHash, tokenHash)) {
    console.warn('[scorelo-auth] password reset rejected: token hash mismatch');
    throw invalid();
  }
  if (record.usedAt !== null) {
    console.warn(`[scorelo-auth] password reset rejected: token already used (user ${record.userId})`);
    throw invalid();
  }
  if (record.expiresAt.getTime() <= Date.now()) {
    console.warn(`[scorelo-auth] password reset rejected: token expired (user ${record.userId})`);
    throw invalid();
  }

  const [user] = await db.select().from(users).where(eq(users.id, record.userId)).limit(1);
  if (!user) {
    console.warn('[scorelo-auth] password reset rejected: token references a deleted user');
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
        // Revoke every existing session. Whoever asked for this reset may be locking out someone
        // who already has the old credentials, and leaving live refresh tokens would defeat that.
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      })
      .where(eq(users.id, user.id));

    await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, record.id));

    // Any sibling token issued before this one is now moot.
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)));
  });

  console.log(`[scorelo-auth] password reset completed for user ${user.id}; sessions revoked`);
}
