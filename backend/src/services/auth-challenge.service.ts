import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { authChallenges } from '../db/schema.js';
import { ApiError } from '../middleware/error.js';
import { generateOtp, generateTicket, hashOtp, hashTicket, verifyOtp } from '../lib/otp.js';

/**
 * ─── Out-of-band challenge engine ────────────────────────────────────
 *
 * The single implementation of "issue a short-lived credential, then redeem it exactly once".
 * Email verification and password reset both use it, which is the point: expiry, single-use,
 * attempt limits and superseding are the rules that must never differ between two flows, and the
 * surest way to make them differ is to write them twice.
 *
 * WHAT THIS SERVICE IS NOT: a second authentication factor. Nothing here issues a session or a
 * token pair. Proving control of an email address answers "is this address yours?" — it does not
 * answer "are you presenting a second factor right now?", and conflating the two would turn a
 * code read out of an inbox into a way past the password. Callers get a boolean and a user id.
 */

export type ChallengePurpose =
  | 'email_verification'
  | 'password_reset'
  | 'password_reset_ticket'
  | 'login_2fa'
  | 'login_2fa_ticket';

/** The pool handle or a transaction from it. Helpers below accept either so a caller can fold
 * them into a larger transaction — a password reset must consume its challenges in the same
 * atomic step that writes the new hash, not in a second one that could fail on its own. */
type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Long enough to find the mail and type six digits; short enough that a code sitting in an
 * unattended inbox stops being a credential quickly. Matches the reset link's spirit (30m) at the
 * shorter end appropriate to a low-entropy code. */
export const CHALLENGE_TTL_MS = 10 * 60 * 1000;

/** Wrong guesses allowed before the challenge dies. With 10^6 codes and a 10-minute window, five
 * attempts puts a blind guess at roughly 1 in 200,000 per challenge — and the endpoint is rate
 * limited on top of that. */
const MAX_ATTEMPTS = 5;

/**
 * THE ONLY failure a caller may surface.
 *
 * Invalid, expired, already used, and attempts-exhausted are deliberately indistinguishable from
 * outside. Any difference would let someone probe which codes have existed and how far a guessing
 * run has got. Operators still get the precise reason in the server log.
 */
export function challengeRejected(): ApiError {
  return new ApiError(400, 'That code is invalid or has expired. Request a new one.', 'CHALLENGE_INVALID');
}

/** Marks every open challenge of one purpose as spent. Called before issuing a replacement and
 * again after a successful redemption, so a user can never hold two live codes for one purpose. */
async function supersedeOpen(userId: number, purpose: ChallengePurpose, tx: Executor = db): Promise<void> {
  await tx
    .update(authChallenges)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(authChallenges.userId, userId),
        eq(authChallenges.purpose, purpose),
        isNull(authChallenges.consumedAt),
      ),
    );
}

export interface IssuedOtp {
  challengeId: number;
  /** The raw code. Exists here, in the outgoing email, and nowhere else — never persisted,
   * never logged, never returned by an API. */
  code: string;
  expiresAt: Date;
}

/**
 * Issues a fresh one-time code, invalidating any previous one for the same purpose.
 *
 * Supersede-then-insert runs in one transaction so there is no instant where the user holds two
 * valid codes, or none.
 */
export async function issueOtpChallenge(userId: number, purpose: ChallengePurpose): Promise<IssuedOtp> {
  const code = generateOtp();
  const codeHash = await hashOtp(code);
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

  const challengeId = await db.transaction(async (tx) => {
    await supersedeOpen(userId, purpose, tx);
    const [header] = await tx
      .insert(authChallenges)
      .values({ userId, purpose, codeHash, expiresAt, maxAttempts: MAX_ATTEMPTS });
    return header.insertId;
  });

  return { challengeId, code, expiresAt };
}

/**
 * Records what happened when the code was mailed.
 *
 * Separate from issuing because delivery is not part of the credential's validity: a code that
 * failed to send is still a perfectly good code, it just has not reached anyone yet. Keeping the
 * two apart is what lets resend retry delivery without minting a new secret when that is not
 * wanted — and what lets signup answer honestly instead of pretending mail went out.
 */
export async function recordDelivery(challengeId: number, error?: string): Promise<void> {
  const [existing] = await db
    .select({ deliveryAttempts: authChallenges.deliveryAttempts })
    .from(authChallenges)
    .where(eq(authChallenges.id, challengeId))
    .limit(1);
  if (!existing) return;

  await db
    .update(authChallenges)
    .set({
      deliveryAttempts: existing.deliveryAttempts + 1,
      // Only a successful send stamps sentAt, so "was this ever delivered" stays answerable.
      ...(error ? {} : { sentAt: new Date() }),
      // Truncated to the column width. A transport message, never an address and never a code.
      lastDeliveryError: error ? error.slice(0, 255) : null,
    })
    .where(eq(authChallenges.id, challengeId));
}

/**
 * Redeems a one-time code.
 *
 * Returns true only when the code was correct, live, unspent and within its attempt budget. Every
 * other outcome returns false and is logged with its real reason — the caller must convert all of
 * them into the single response from challengeRejected().
 *
 * A wrong guess costs an attempt. Reaching the limit consumes the challenge outright rather than
 * leaving a dead row that still answers queries, so an exhausted code cannot be ground down over
 * multiple requests.
 */
export async function redeemOtpChallenge(
  userId: number,
  purpose: ChallengePurpose,
  code: string,
): Promise<boolean> {
  const [challenge] = await db
    .select()
    .from(authChallenges)
    .where(
      and(
        eq(authChallenges.userId, userId),
        eq(authChallenges.purpose, purpose),
        isNull(authChallenges.consumedAt),
      ),
    )
    .orderBy(desc(authChallenges.id))
    .limit(1);

  if (!challenge) {
    console.warn(`[scorelo-auth] ${purpose} rejected: no open challenge (user ${userId})`);
    return false;
  }

  if (challenge.expiresAt.getTime() <= Date.now()) {
    console.warn(`[scorelo-auth] ${purpose} rejected: expired (user ${userId})`);
    await db.update(authChallenges).set({ consumedAt: new Date() }).where(eq(authChallenges.id, challenge.id));
    return false;
  }

  if (challenge.attempts >= challenge.maxAttempts) {
    console.warn(`[scorelo-auth] ${purpose} rejected: attempts exhausted (user ${userId})`);
    await db.update(authChallenges).set({ consumedAt: new Date() }).where(eq(authChallenges.id, challenge.id));
    return false;
  }

  const matches = await verifyOtp(code, challenge.codeHash);
  if (!matches) {
    const attempts = challenge.attempts + 1;
    const exhausted = attempts >= challenge.maxAttempts;
    await db
      .update(authChallenges)
      .set({ attempts, ...(exhausted ? { consumedAt: new Date() } : {}) })
      .where(eq(authChallenges.id, challenge.id));
    console.warn(
      `[scorelo-auth] ${purpose} rejected: wrong code, attempt ${attempts}/${challenge.maxAttempts} (user ${userId})`,
    );
    return false;
  }

  // Consume this one AND every sibling, so a code issued moments earlier cannot be replayed.
  await db.transaction(async (tx) => {
    await tx.update(authChallenges).set({ consumedAt: new Date() }).where(eq(authChallenges.id, challenge.id));
    await supersedeOpen(userId, purpose, tx);
  });

  return true;
}

/** The two purposes that hold a bearer ticket rather than a typed code. */
export type TicketPurpose = 'password_reset_ticket' | 'login_2fa_ticket';

/**
 * Mints the high-entropy ticket a verified code exchanges into.
 *
 * THIS — not the six-digit code — is the credential the next step actually redeems. The code
 * proves the customer read the inbox; the ticket carries 256 bits of CSPRNG entropy. Keeping them
 * separate is what stops either flow being downgraded to the strength of a number a person can
 * type, and it is why the code is never accepted where the ticket is expected.
 *
 * Used identically by password reset and by login 2FA, on purpose: two flows with the same shape
 * must not grow two implementations that can drift apart.
 */
export async function issueTicket(userId: number, purpose: TicketPurpose): Promise<{ ticket: string; expiresAt: Date }> {
  const ticket = generateTicket();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

  await db.transaction(async (tx) => {
    await supersedeOpen(userId, purpose, tx);
    await tx.insert(authChallenges).values({
      userId,
      purpose,
      codeHash: hashTicket(ticket),
      expiresAt,
      // A ticket is not guessed, it is held — there is nothing to attempt.
      maxAttempts: 1,
    });
  });

  return { ticket, expiresAt };
}

/**
 * Redeems a ticket, returning the user it belongs to.
 *
 * Looked up BY HASH rather than by user, because the caller presenting a ticket has not otherwise
 * identified themselves — that is the whole point of a bearer credential. SHA-256 makes that an
 * indexed point-read; bcrypt could not be searched this way, which is the other half of why the
 * two credential shapes use different hashes.
 *
 * The purpose is part of the predicate, so a reset ticket cannot be presented where a login ticket
 * is expected, or the reverse.
 */
export async function redeemTicket(ticket: string, purpose: TicketPurpose): Promise<number | null> {
  const [challenge] = await db
    .select()
    .from(authChallenges)
    .where(
      and(
        eq(authChallenges.purpose, purpose),
        eq(authChallenges.codeHash, hashTicket(ticket)),
        isNull(authChallenges.consumedAt),
      ),
    )
    .limit(1);

  if (!challenge) {
    console.warn(`[scorelo-auth] ${purpose} rejected: no matching open ticket`);
    return null;
  }
  if (challenge.expiresAt.getTime() <= Date.now()) {
    console.warn(`[scorelo-auth] ${purpose} rejected: expired (user ${challenge.userId})`);
    return null;
  }

  await db.update(authChallenges).set({ consumedAt: new Date() }).where(eq(authChallenges.id, challenge.id));
  return challenge.userId;
}

/**
 * Reads which user an open ticket belongs to WITHOUT consuming it.
 *
 * Exists for exactly one caller: resending a 2FA code mid-sign-in. That step needs to know which
 * account is in flight, but must not spend the ticket — the customer still has to redeem it once
 * the replacement code arrives. Consuming here would end the sign-in the resend was meant to save.
 *
 * It grants nothing on its own: without a valid unexpired ticket it returns null, so it cannot be
 * used to trigger mail to an address the caller has not already authenticated against.
 */
export async function peekTicketUser(ticket: string, purpose: TicketPurpose): Promise<number | null> {
  const [challenge] = await db
    .select({ userId: authChallenges.userId, expiresAt: authChallenges.expiresAt })
    .from(authChallenges)
    .where(
      and(
        eq(authChallenges.purpose, purpose),
        eq(authChallenges.codeHash, hashTicket(ticket)),
        isNull(authChallenges.consumedAt),
      ),
    )
    .limit(1);

  if (!challenge || challenge.expiresAt.getTime() <= Date.now()) return null;
  return challenge.userId;
}

/** Invalidates every open challenge a user holds, whatever its purpose. Called after a successful
 * password reset: any code or ticket still in flight belongs to a request that is now moot. */
export async function consumeAllChallenges(userId: number, tx: Executor = db): Promise<void> {
  await tx
    .update(authChallenges)
    .set({ consumedAt: new Date() })
    .where(and(eq(authChallenges.userId, userId), isNull(authChallenges.consumedAt)));
}
