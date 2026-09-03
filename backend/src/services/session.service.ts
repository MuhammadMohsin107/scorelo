import { createHash } from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { userSessions } from '../db/schema.js';
import { ApiError } from '../middleware/error.js';
import type { RequestMetadata } from '../lib/requestMetadata.js';

/**
 * ─── Database-backed sessions ────────────────────────────────────────
 *
 * One row per signed-in device, replacing the single `users.refresh_token_hash` column that could
 * only ever hold one value.
 *
 * WHAT DID NOT CHANGE: the refresh token is still the same JWT, signed the same way, with the same
 * 15-minute access / 30-day refresh TTLs, still hashed with SHA-256, still rotated on every use,
 * and an old token is still rejected because its hash no longer matches a live row. jwt.ts is
 * untouched. This service moves WHERE that hash lives; it does not invent a second token system.
 *
 * WHY SHA-256 AND NOT BCRYPT: the token is a signed JWT — high-entropy, nothing for a slow hash to
 * protect — and the lookup has to be a point-read on an indexed column, which a per-row-salted
 * hash cannot support. This is the same reasoning lib/otp.ts applies in the opposite direction for
 * six-digit codes.
 *
 * NO ROW IS EVER FABRICATED. Sessions exist only where a real login created one, and their IP and
 * User-Agent are null unless the request actually carried them.
 */

/** Same construction as auth.service.ts and password-reset.service.ts, for one consistent scheme. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface SessionRow {
  id: number;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
}

/** Records a new signed-in device. Called once per real login, with the token that was just issued. */
export async function createSession(
  userId: number,
  refreshToken: string,
  expiresAt: Date,
  metadata: RequestMetadata,
): Promise<void> {
  await db.insert(userSessions).values({
    userId,
    tokenHash: hashSessionToken(refreshToken),
    expiresAt,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  });
}

/**
 * Rotates a session onto a new refresh token, returning false when the presented token is not
 * usable.
 *
 * PRESERVES THE EXISTING REJECTION BEHAVIOUR EXACTLY. Before Phase 2 a rotated-out token failed
 * because the stored hash no longer matched; now it fails because no live row carries that hash.
 * Same outcome, same three reasons — unknown, revoked, expired — and the caller converts all of
 * them into the one 401 it already returned.
 *
 * The whole rotation is a single UPDATE guarded by the old hash. That matters: two concurrent
 * refreshes with the same token cannot both succeed, because the second finds nothing left to
 * match. Read-then-write would let both through.
 */
export async function rotateSession(
  oldToken: string,
  newToken: string,
  expiresAt: Date,
  metadata: RequestMetadata,
): Promise<boolean> {
  const oldHash = hashSessionToken(oldToken);

  const [session] = await db
    .select()
    .from(userSessions)
    .where(eq(userSessions.tokenHash, oldHash))
    .limit(1);

  if (!session) {
    // Either never issued, or already rotated away — indistinguishable, and both are refusals.
    console.warn('[scorelo-security] refresh rejected: no session for that token');
    return false;
  }
  if (session.revokedAt !== null) {
    console.warn(`[scorelo-security] refresh rejected: session ${session.id} is revoked`);
    return false;
  }
  if (session.expiresAt.getTime() <= Date.now()) {
    console.warn(`[scorelo-security] refresh rejected: session ${session.id} has expired`);
    return false;
  }

  const result = await db
    .update(userSessions)
    .set({
      tokenHash: hashSessionToken(newToken),
      lastUsedAt: new Date(),
      expiresAt,
      // Refreshed from the current request: a session that moves network or client should say so
      // rather than keep showing where it started. Nulls overwrite, because "unknown now" is more
      // honest than a stale value presented as current.
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    })
    .where(and(eq(userSessions.id, session.id), eq(userSessions.tokenHash, oldHash), isNull(userSessions.revokedAt)));

  // affectedRows === 0 means another request rotated this session between the read and the write.
  const rotated = (result as unknown as { affectedRows?: number }[])[0]?.affectedRows !== 0;
  if (!rotated) console.warn(`[scorelo-security] refresh rejected: session ${session.id} rotated concurrently`);
  return rotated;
}

/**
 * The user's live sessions, newest activity first. Scoped to the id resolved from the request.
 *
 * NO "THIS DEVICE" FLAG, deliberately. Identifying the current session would mean the server
 * seeing the caller's refresh token, and a GET can only carry one in the query string — where it
 * would land in proxy access logs, browser history and Referer headers. A convenience badge is not
 * worth putting a live credential in a URL, and the alternative (a `sid` claim in the JWT) was
 * ruled out of this phase. The revoke-others action does not need it: it receives the token in a
 * POST body, which is the same path /auth/refresh already uses.
 */
export async function listSessions(userId: number): Promise<SessionRow[]> {
  const now = Date.now();

  const rows = await db
    .select()
    .from(userSessions)
    .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)))
    .orderBy(desc(userSessions.lastUsedAt));

  return rows
    // Expired-but-unrevoked rows are dead credentials; showing them would tell a customer they are
    // signed in somewhere they are not.
    .filter((row) => row.expiresAt.getTime() > now)
    .map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      lastUsedAt: row.lastUsedAt,
      expiresAt: row.expiresAt,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
    }));
}

/**
 * Revokes one session the caller owns.
 *
 * OWNERSHIP IS PART OF THE PREDICATE, not a separate check — the UPDATE matches on user_id as well
 * as id, so a session belonging to someone else simply is not found. There is no window between
 * "verify owner" and "revoke" for the two to disagree.
 *
 * A session that does not exist and one that belongs to another account both raise the SAME 404.
 * A 403 for the second case would confirm the id exists, which is exactly the enumeration this
 * avoids.
 */
export async function revokeSession(userId: number, sessionId: number): Promise<void> {
  const [session] = await db
    .select({ id: userSessions.id })
    .from(userSessions)
    .where(and(eq(userSessions.id, sessionId), eq(userSessions.userId, userId), isNull(userSessions.revokedAt)))
    .limit(1);

  if (!session) throw new ApiError(404, 'Session not found', 'SESSION_NOT_FOUND');

  await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(userSessions.id, sessionId), eq(userSessions.userId, userId)));
}

/**
 * Revokes every live session except the one presented, returning how many were ended.
 *
 * `exceptToken` is the caller's own refresh token. When it is absent — or matches nothing — every
 * session is revoked, which is the safe direction to fail: the worst outcome is signing the
 * customer out of the device they are holding, not leaving a credential alive by accident.
 */
export async function revokeOtherSessions(userId: number, exceptToken?: string): Promise<number> {
  const keepHash = exceptToken ? hashSessionToken(exceptToken) : null;

  const open = await db
    .select({ id: userSessions.id, tokenHash: userSessions.tokenHash })
    .from(userSessions)
    .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)));

  const doomed = open.filter((row) => row.tokenHash !== keepHash).map((row) => row.id);
  if (doomed.length === 0) return 0;

  const now = new Date();
  for (const id of doomed) {
    await db.update(userSessions).set({ revokedAt: now }).where(eq(userSessions.id, id));
  }
  return doomed.length;
}

/**
 * Revokes the single session a refresh token belongs to. Returns false when it matched nothing.
 *
 * This is how logout ends the current device without touching the others.
 */
export async function revokeSessionByToken(userId: number, refreshToken: string): Promise<boolean> {
  const [session] = await db
    .select({ id: userSessions.id })
    .from(userSessions)
    .where(
      and(
        eq(userSessions.tokenHash, hashSessionToken(refreshToken)),
        // Scoped to the authenticated user, so a token belonging to another account cannot be
        // used to revoke that account's session.
        eq(userSessions.userId, userId),
        isNull(userSessions.revokedAt),
      ),
    )
    .limit(1);

  if (!session) return false;

  await db.update(userSessions).set({ revokedAt: new Date() }).where(eq(userSessions.id, session.id));
  return true;
}

/** Revokes every live session a user holds. Used when a password reset invalidates everything. */
export async function revokeAllSessions(userId: number): Promise<number> {
  const open = await db
    .select({ id: userSessions.id })
    .from(userSessions)
    .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)));

  if (open.length === 0) return 0;

  const now = new Date();
  for (const row of open) {
    await db.update(userSessions).set({ revokedAt: now }).where(eq(userSessions.id, row.id));
  }
  return open.length;
}
