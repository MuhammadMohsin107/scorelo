import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { insertReturning } from '../db/returning.js';
import { stores, users } from '../db/schema.js';
import { ApiError } from '../middleware/error.js';
import { env } from '../config/env.js';
import { refreshTokenTtlMs, signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt.js';
import { toPublicUser } from '../lib/publicUser.js';
import { mailerConfigured, sendMail } from '../lib/mailer.js';
import { buildVerificationEmail } from '../lib/emails/emailVerification.js';
import { CHALLENGE_TTL_MS, issueOtpChallenge, recordDelivery, redeemOtpChallenge } from './auth-challenge.service.js';
import { createSession, revokeAllSessions, revokeSessionByToken, rotateSession } from './session.service.js';
import { recordSecurityEvent } from './security-event.service.js';
import { beginTwoFactorChallenge, completeTwoFactorChallenge } from './two-factor.service.js';
import type { RequestMetadata } from '../lib/requestMetadata.js';
import type { LoginInput, SignupInput } from '../schemas/auth.schema.js';

const SALT_ROUNDS = 12;

/**
 * Issues a token pair and records the device it was issued to.
 *
 * WHAT CHANGED IN PHASE 2: the refresh hash now lands in a `user_sessions` row instead of
 * overwriting two columns on `users`. That single change is what makes more than one signed-in
 * device possible — the old shape could hold exactly one value, so every login silently ended the
 * previous session.
 *
 * WHAT DID NOT CHANGE: the tokens themselves. Same JWTs, same secrets, same 15-minute access and
 * 30-day refresh TTLs, same SHA-256 hashing, same rotation. jwt.ts is untouched.
 *
 * The legacy `users.refresh_token_hash` / `refresh_token_expires_at` columns are no longer written
 * or read. They remain in the schema for rollback and are not dropped in this phase.
 */
async function issueTokenPair(userId: number, metadata: RequestMetadata) {
  const accessToken = signAccessToken(userId);
  const refreshToken = signRefreshToken(userId);
  await createSession(userId, refreshToken, new Date(Date.now() + refreshTokenTtlMs()), metadata);
  return { accessToken, refreshToken };
}

/**
 * Sends a verification code and reports whether it actually went out.
 *
 * Delivery is recorded on the challenge rather than thrown, because a code that failed to send is
 * still a valid code — it just has not reached anyone yet. Separating "is this credential good?"
 * from "did the mail leave?" is what lets resend retry delivery, and what lets signup answer the
 * caller honestly instead of reporting a success the customer will never see evidence of.
 *
 * NOTHING SECRET IS LOGGED: not the code, not the address. Only the transport's own message.
 */
async function deliverVerificationCode(
  user: { id: number; email: string; fullName: string },
  purpose: 'signup' | 'password-reset',
): Promise<boolean> {
  const { challengeId, code } = await issueOtpChallenge(
    user.id,
    purpose === 'signup' ? 'email_verification' : 'password_reset',
  );

  const message = buildVerificationEmail({
    to: user.email,
    fullName: user.fullName,
    code,
    expiresInMinutes: Math.round(CHALLENGE_TTL_MS / 60_000),
    purpose,
  });

  try {
    await sendMail(message);
    await recordDelivery(challengeId);
    return true;
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown transport error';
    await recordDelivery(challengeId, reason);
    console.error(`[scorelo-auth] verification email failed to send (user ${user.id}): ${reason}`);
    return false;
  }
}

/** Re-sends a signup verification code, superseding whatever was outstanding. */
export async function resendEmailVerification(email: string): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  // Unknown address, or one already verified: do nothing at all. The controller answers
  // identically either way, so neither case is distinguishable from a successful send.
  if (!user) {
    console.log('[scorelo-auth] verification resend requested for an address with no account');
    return;
  }
  if (user.emailVerifiedAt !== null) {
    console.log(`[scorelo-auth] verification resend ignored: already verified (user ${user.id})`);
    return;
  }
  if (!mailerConfigured()) {
    console.error('[scorelo-auth] verification resend requested but SMTP is not configured; no email sent');
    return;
  }

  await deliverVerificationCode(user, 'signup');
}

/**
 * Redeems a signup verification code and marks the address confirmed.
 *
 * RETURNS NO SESSION, deliberately. The request carries an address and a code but no password, so
 * issuing tokens here would let whoever reads the inbox take the account without ever holding the
 * credential. Confirming an address answers "is this address yours?" — it is not a second
 * authentication factor, and it must not become a way past the first one.
 */
export async function verifyEmail(email: string, code: string, metadata: RequestMetadata): Promise<boolean> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    console.warn('[scorelo-auth] email verification rejected: no account for that address');
    return false;
  }

  // Already verified is a no-op success: a customer who clicks twice, or has the code open on two
  // devices, has done nothing wrong and must not see an error. No second event is recorded —
  // nothing actually happened.
  if (user.emailVerifiedAt !== null) return true;

  const redeemed = await redeemOtpChallenge(user.id, 'email_verification', code);
  if (!redeemed) return false;

  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, user.id));
  await recordSecurityEvent({ userId: user.id, type: 'email_verified', metadata });
  console.log(`[scorelo-auth] email verified for user ${user.id}`);
  return true;
}

export interface SignupResult {
  user: ReturnType<typeof toPublicUser>;
  emailVerificationRequired: boolean;
  verificationSent: boolean;
  /** Present only while verification is not enforced — see the comment in signup(). */
  accessToken?: string;
  refreshToken?: string;
}

export async function signup(input: SignupInput, metadata: RequestMetadata): Promise<SignupResult> {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
  if (existing) throw new ApiError(409, 'An account with this email already exists', 'EMAIL_TAKEN');

  // PREFLIGHT, before anything is written. With verification enforced, an account created while
  // mail is undeliverable is an account nobody can ever log into — so refuse the whole request
  // rather than leave that wreckage behind. Checked here and not inside the transaction because
  // the cheapest failure is the one that happens before any state exists.
  if (env.requireEmailVerification && !mailerConfigured()) {
    console.error('[scorelo-auth] signup refused: verification is required but SMTP is not configured');
    throw new ApiError(
      503,
      'Account creation is temporarily unavailable. Please try again shortly.',
      'EMAIL_DELIVERY_UNAVAILABLE',
    );
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const user = await insertReturning(users, {
    fullName: input.fullName,
    email: input.email,
    passwordHash,
    jobTitle: input.jobTitle,
  });
  if (!user) throw new ApiError(500, 'Unable to create account', 'SIGNUP_FAILED');

  // A brand-new account has no shop connected yet. This placeholder row keeps every service
  // that resolves "the user's store" working from the moment of signup, and platform
  // 'Not connected' is exactly what resolveStoreForInstall() looks for: the first Shopify
  // install CLAIMS this row and overwrites its identity, rather than creating a second store.
  // Nothing here is presented as real store data — no audit can run until a shop is connected.
  await db.insert(stores).values({
    ownerId: user.id,
    workspaceName: `${input.fullName}'s workspace`,
    name: 'My store',
    url: 'https://example.com',
    platform: 'Not connected',
    industry: 'Unspecified',
    country: 'Unspecified',
    timezone: '(UTC+00:00) UTC',
    currency: 'USD — US Dollar',
  });

  // Issued after the account and its store exist, so a delivery failure cannot leave a half-built
  // signup behind. The code is minted whether or not the flag is on: the flag governs enforcement
  // at login, not whether verification is offered.
  const verificationSent = mailerConfigured() ? await deliverVerificationCode(user, 'signup') : false;
  if (!mailerConfigured()) {
    console.warn(`[scorelo-auth] signup completed without a verification email: SMTP not configured (user ${user.id})`);
  }

  // TOKENS ONLY WHILE VERIFICATION IS NOT ENFORCED. With the flag off this preserves exactly
  // today's behaviour — sign up, land in the app. With it on, an unverified account must not hold
  // a session, or the login gate would be trivially skipped by signing up instead.
  const tokens = env.requireEmailVerification ? null : await issueTokenPair(user.id, metadata);

  return {
    user: toPublicUser(user),
    emailVerificationRequired: env.requireEmailVerification,
    verificationSent,
    ...(tokens ?? {}),
  };
}

export async function login(input: LoginInput, metadata: RequestMetadata) {
  const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);

  // NO EVENT FOR AN UNKNOWN ADDRESS. security_events is keyed to a real user id, and there is no
  // user here to attribute it to. Inventing a row — or a placeholder user — would both fabricate
  // history and turn the table into a record of which addresses strangers have guessed.
  if (!user) throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatches) {
    // A real failed attempt against a real account — this is exactly what an owner needs to see.
    // The submitted password is NOT recorded, here or anywhere.
    await recordSecurityEvent({ userId: user.id, type: 'login_failed', metadata });
    throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  // CHECKED ONLY AFTER THE PASSWORD PASSES. Ordered this way on purpose: a caller who reaches
  // this line already holds the correct credential, so learning that the address exists but is
  // unverified tells them nothing they did not already know. Checking first would turn login into
  // an account-existence oracle for anyone willing to guess addresses.
  if (env.requireEmailVerification && user.emailVerifiedAt === null) {
    console.warn(`[scorelo-auth] login blocked: email not verified (user ${user.id})`);
    throw new ApiError(
      403,
      'Verify your email address before signing in. Check your inbox for the code we sent.',
      'EMAIL_NOT_VERIFIED',
    );
  }

  // ─── Second factor ────────────────────────────────────────────────
  // Reached only after bcrypt accepted the password, so revealing that 2FA is on tells a caller
  // nothing they did not already know — they hold the credential. No session and no token is
  // issued here: the sign-in is not finished, and treating it as finished would make the second
  // factor decorative.
  if (user.twoFactorEnabledAt !== null) {
    const challenge = await beginTwoFactorChallenge(user);
    return {
      twoFactorRequired: true as const,
      ticket: challenge.ticket,
      codeSent: challenge.codeSent,
    };
  }

  const tokens = await issueTokenPair(user.id, metadata);
  await recordSecurityEvent({ userId: user.id, type: 'login_success', metadata });
  return { twoFactorRequired: false as const, user: toPublicUser(user), ...tokens };
}

/**
 * Finishes a sign-in that stopped for a second factor.
 *
 * TWO CREDENTIALS, BOTH REQUIRED. The ticket proves the password step happened; the code proves
 * the inbox was read. Neither alone gets in — which is the entire point of a second factor, and
 * the reason the ticket exists rather than this endpoint taking `{ email, code }`.
 *
 * Every failure returns the same 401. Wrong code, expired code, spent code, exhausted attempts and
 * an unknown ticket are indistinguishable from outside, so nothing here can be probed.
 */
export async function completeTwoFactorLogin(ticket: string, code: string, metadata: RequestMetadata) {
  const userId = await completeTwoFactorChallenge(ticket, code);
  if (userId === null) throw new ApiError(401, 'That code is invalid or has expired.', 'TWO_FACTOR_INVALID');

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new ApiError(401, 'That code is invalid or has expired.', 'TWO_FACTOR_INVALID');

  // The session is created HERE, not at the password step — so an interrupted sign-in leaves no
  // usable credential behind.
  const tokens = await issueTokenPair(user.id, metadata);
  await recordSecurityEvent({ userId: user.id, type: 'login_success', metadata });
  return { user: toPublicUser(user), ...tokens };
}

/**
 * Rotates a refresh token, keeping the caller on the SAME session row.
 *
 * The rejection rules are unchanged from before Phase 2 — a rotated-out token, a revoked one and
 * an expired one are all refused with the same 401, and the reason is never disclosed. What moved
 * is where the hash is checked: a session row rather than a column on `users`.
 *
 * A refresh token issued BEFORE this phase has no session row, so it lands in the same rejection
 * as any unknown token. That signs existing customers out once, at cutover. No row is fabricated
 * to paper over it — a session record invented for a device nobody observed would be exactly the
 * kind of made-up security data this work exists to remove.
 */
export async function refresh(refreshToken: string, metadata: RequestMetadata) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
  }

  const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
  if (!user) throw new ApiError(401, 'Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');

  const accessToken = signAccessToken(user.id);
  const newRefreshToken = signRefreshToken(user.id);
  const expiresAt = new Date(Date.now() + refreshTokenTtlMs());

  // One guarded UPDATE. Two concurrent refreshes with the same token cannot both succeed.
  const rotated = await rotateSession(refreshToken, newRefreshToken, expiresAt, metadata);
  if (!rotated) throw new ApiError(401, 'Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');

  return { accessToken, refreshToken: newRefreshToken };
}

/**
 * Ends a session, server-side.
 *
 * HOW THE CORRECT SESSION IS IDENTIFIED. An access token carries only `{sub, type}` — no session
 * identifier — so the access token alone cannot say WHICH device is signing out. Two options
 * existed: add a `sid` claim to the JWT, or have the client present the refresh token it is
 * already holding. The second was chosen because it requires no change to jwt.ts and opens no new
 * exposure: the refresh token ALREADY travels in a POST body to /auth/refresh over the same
 * origin and the same TLS. Logout reuses that established path rather than inventing one.
 *
 * The raw token is used for exactly one thing — a SHA-256 hash to find the row — and is never
 * stored, never logged, and never echoed back.
 *
 * WITHOUT a refresh token the request cannot name a session, so every session is revoked. That is
 * the safe direction to fail, and it matches what logout did before Phase 2, when there was only
 * one credential to clear. It is never weaker than the old behaviour.
 */
export async function logout(userId: number, metadata: RequestMetadata, refreshToken?: string): Promise<void> {
  if (refreshToken) {
    const revoked = await revokeSessionByToken(userId, refreshToken);
    if (revoked) {
      await recordSecurityEvent({ userId, type: 'logout', metadata });
      return;
    }
    // A token that matches nothing this user owns falls through to the safe path rather than
    // silently succeeding while leaving live sessions behind.
    console.warn(`[scorelo-security] logout: presented token matched no live session (user ${userId})`);
  }

  const ended = await revokeAllSessions(userId);
  await recordSecurityEvent({ userId, type: 'logout', metadata, context: { sessionsEnded: ended } });
}
