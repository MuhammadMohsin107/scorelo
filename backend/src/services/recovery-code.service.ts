import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { userRecoveryCodes } from '../db/schema.js';
import { generateRecoveryCodes, hashRecoveryCode, RECOVERY_CODE_COUNT } from '../lib/recoveryCodes.js';

/**
 * ─── Recovery codes ──────────────────────────────────────────────────
 *
 * THE ONLY WRITER to `user_recovery_codes`, for the same reason security-event.service.ts is the
 * only writer to its table: the rules that make a recovery code safe — issued as a set, hashed
 * before storage, redeemable exactly once, replaced wholesale rather than topped up — are rules
 * that must not be reimplemented slightly differently at three call sites.
 *
 * WHAT A RECOVERY CODE IS FOR. Email 2FA's second factor is control of the verified inbox. Inboxes
 * are lost: a work address that gets deprovisioned, a provider lockout, a domain nobody renewed.
 * Without this the only remedy was an operator manually disabling 2FA — a support ticket standing
 * in for a feature, and the main reason people decline to turn 2FA on at all.
 *
 * WHAT IT IS NOT. It is not a second password. It is redeemed only AFTER the password step has
 * already succeeded and only in place of the emailed code, so it substitutes for the second factor
 * and never for the first.
 *
 * NOTHING HERE IS EVER LOGGED — not a code, not a hash.
 */

/** The pool handle or a transaction from it, so a caller can fold these into a larger atomic step. */
type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Replaces a user's entire recovery set and returns the new codes in plaintext.
 *
 * REPLACE, NOT APPEND. Regenerating must invalidate everything issued before it — that is the whole
 * point of the operation, and it is what makes "I think an old printout leaked" actionable. Topping
 * up would leave the leaked set live.
 *
 * Delete-then-insert runs in ONE transaction so there is never an instant where the account has a
 * partial set, or none at all. An interrupted regeneration must leave the previous codes intact
 * rather than stranding the customer with nothing.
 *
 * THE RETURN VALUE IS THE ONLY TIME THE PLAINTEXT EXISTS. After this resolves, only SHA-256 hashes
 * remain, so a set the customer does not save cannot be recovered by us or by an operator. That is
 * the property that makes the codes worth having, and it is why the caller must show them once and
 * say so plainly.
 */
export async function issueRecoveryCodes(userId: number, tx: Executor = db): Promise<string[]> {
  const codes = generateRecoveryCodes(RECOVERY_CODE_COUNT);
  const rows = codes.map((code) => ({ userId, codeHash: hashRecoveryCode(code) }));

  const write = async (executor: Executor) => {
    await executor.delete(userRecoveryCodes).where(eq(userRecoveryCodes.userId, userId));
    await executor.insert(userRecoveryCodes).values(rows);
  };

  // Already inside a caller's transaction: joining it is correct, and opening a nested one here
  // would break the caller's atomicity guarantee rather than add to it.
  if (tx === db) await db.transaction(write);
  else await write(tx);

  return codes;
}

/**
 * Redeems one recovery code, returning whether it was accepted.
 *
 * SINGLE-USE IS ENFORCED IN THE UPDATE'S PREDICATE, not by reading the row and then writing it.
 * `used_at IS NULL` is part of the WHERE clause, so two requests presenting the same code at the
 * same moment cannot both succeed — the database decides, and exactly one row is affected. A
 * read-then-write would have a window between the two where both callers see an unused code.
 *
 * The lookup is by (user_id, code_hash) against an index, so it is a point-read whose cost does not
 * depend on which code was submitted or how many remain — there is no timing signal to measure.
 * Scoping to the user is what stops one account's code ever matching another's row.
 *
 * Returns false for wrong, already-used and never-existed alike. The caller converts all of them
 * into the same rejection, so nothing here can be probed.
 */
export async function redeemRecoveryCode(userId: number, code: string): Promise<boolean> {
  const codeHash = hashRecoveryCode(code);

  const [header] = await db
    .update(userRecoveryCodes)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(userRecoveryCodes.userId, userId),
        eq(userRecoveryCodes.codeHash, codeHash),
        isNull(userRecoveryCodes.usedAt),
      ),
    );

  return header.affectedRows === 1;
}

/**
 * How many codes the account has left.
 *
 * Surfaced to the customer so "you are running low" is a fact rather than a guess, and so the
 * Security page can prompt for a regeneration before the last one is spent.
 */
export async function countUnusedRecoveryCodes(userId: number): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(userRecoveryCodes)
    .where(and(eq(userRecoveryCodes.userId, userId), isNull(userRecoveryCodes.usedAt)));

  // COUNT(*) arrives as a string from some MySQL drivers; Number() makes the contract explicit
  // rather than letting a string leak into an API response typed as a number.
  return Number(row?.count ?? 0);
}

/**
 * Removes every recovery code an account holds.
 *
 * Called when 2FA is switched off. Codes that bypass a second factor which no longer exists are not
 * dormant, they are live credentials with nothing left to protect — leaving them behind would mean
 * a printout from months ago still had meaning if 2FA were ever switched back on.
 */
export async function clearRecoveryCodes(userId: number, tx: Executor = db): Promise<void> {
  await tx.delete(userRecoveryCodes).where(eq(userRecoveryCodes.userId, userId));
}
