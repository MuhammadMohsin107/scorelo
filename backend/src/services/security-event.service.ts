import { desc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { securityEvents } from '../db/schema.js';
import type { RequestMetadata } from '../lib/requestMetadata.js';

/**
 * ─── Security event log ──────────────────────────────────────────────
 *
 * THE ONLY WRITER to `security_events`. Everything that records an event goes through
 * recordSecurityEvent(), which is what makes the no-credentials rule enforceable: there is one
 * function to audit, not a dozen scattered inserts.
 *
 * WHAT AN EVENT IS: a statement that an action happened, to whom, when, and — where the request
 * genuinely carried them — from what IP and User-Agent. It is never a record of the credential
 * involved. No password, OTP, refresh token, access token, reset ticket or hash of any of them is
 * written here or accepted by this module's types.
 *
 * NOTHING SEEDS THIS TABLE. An account that has taken no security action has no events, and the
 * UI shows an empty history rather than an invented one.
 */

/**
 * The complete vocabulary, matching the CHECK constraint on the table. Adding a member here
 * without adding it to the constraint would fail at insert time rather than silently widening.
 */
export type SecurityEventType =
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'password_changed'
  | 'password_reset'
  | 'email_verified'
  | 'session_revoked'
  | 'sessions_revoked'
  // Turning a second factor on or off is exactly the change an account owner needs to see in
  // their own history — switching it off is the first thing an attacker holding a session does.
  | 'two_factor_enabled'
  | 'two_factor_disabled';

/**
 * Non-secret context. The value type deliberately excludes strings that could carry a credential
 * by convention — callers pass counts and identifiers, never token material.
 *
 * Reviewed at every call site in this codebase: the only values passed are integers (how many
 * sessions a revoke ended) and internal row ids.
 */
export type SecurityEventMetadata = Record<string, number | boolean | null>;

export interface RecordEventInput {
  userId: number;
  type: SecurityEventType;
  /** Real request metadata, or nulls. Never fabricated — see lib/requestMetadata.ts. */
  metadata?: RequestMetadata;
  context?: SecurityEventMetadata;
}

/**
 * Appends one event.
 *
 * NEVER THROWS. An audit write failing must not take down the action it was describing: a
 * customer whose password change succeeded should not see an error because the log insert lost a
 * race. The failure is logged for operators and swallowed for the caller.
 *
 * The trade-off is stated rather than hidden: this log is best-effort evidence for the account
 * owner, not a compliance-grade audit trail with delivery guarantees. Making it authoritative
 * would mean failing the user's action when logging fails, which is the wrong trade here.
 */
export async function recordSecurityEvent(input: RecordEventInput): Promise<void> {
  try {
    await db.insert(securityEvents).values({
      userId: input.userId,
      type: input.type,
      ipAddress: input.metadata?.ipAddress ?? null,
      userAgent: input.metadata?.userAgent ?? null,
      // The column is `metadata`; the input calls it `context` so it cannot be confused with the
      // RequestMetadata above, which is a different thing entirely.
      metadata: input.context ?? null,
    });
  } catch (error) {
    // Message only. The input carries no credential, but this stays deliberately narrow anyway.
    console.error(
      `[scorelo-security] failed to record ${input.type} for user ${input.userId}: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }
}

export interface SecurityEventRow {
  id: number;
  type: SecurityEventType;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  context: SecurityEventMetadata | null;
}

/**
 * One user's own events, newest first.
 *
 * Scoped by the userId the caller resolved from the authenticated request — this function is never
 * given an id from a request body. There is no "all users" variant on purpose.
 */
export async function listSecurityEvents(userId: number, limit = 50): Promise<SecurityEventRow[]> {
  const rows = await db
    .select()
    .from(securityEvents)
    .where(eq(securityEvents.userId, userId))
    .orderBy(desc(securityEvents.createdAt), desc(securityEvents.id))
    .limit(Math.min(Math.max(limit, 1), 100));

  return rows.map((row) => ({
    id: row.id,
    type: row.type as SecurityEventType,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    createdAt: row.createdAt,
    context: (row.metadata as SecurityEventMetadata | null) ?? null,
  }));
}
