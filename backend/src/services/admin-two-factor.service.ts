import { and, count, desc, eq, gt, gte, inArray, isNotNull, isNull, like, or, type SQL } from 'drizzle-orm';
import { db } from '../db/client.js';
import { adminSecurityActions, authChallenges, securityEvents, userSessions, users } from '../db/schema.js';
import { ApiError } from '../middleware/error.js';
import { mailerConfigured } from '../lib/mailer.js';
import { consumeOpenChallenges, type ChallengePurpose } from './auth-challenge.service.js';
import {
  recordSecurityEvent,
  TWO_FACTOR_EVENT_TYPES,
  type SecurityEventType,
  type TwoFactorEventType,
} from './security-event.service.js';
import type { AdminIdentity } from '../middleware/requireAdmin.js';
import type { RequestMetadata } from '../lib/requestMetadata.js';

/**
 * ─── Admin: manage and monitor the EXISTING 2FA system ───────────────
 *
 * This service reads and operates the machinery that is already there — `users.two_factor_
 * enabled_at`, `auth_challenges`, `security_events`, `user_sessions`. It issues no codes, mints no
 * tickets, defines no second factor of its own, and never bypasses the customer flow: enabling 2FA
 * still requires the account owner's own password through /api/security/two-factor/enable, because
 * that password is the only thing that proves the person turning on a protection is the person who
 * will have to satisfy it.
 *
 * WHAT NEVER LEAVES THIS MODULE. Every read below selects columns explicitly, and the sensitive
 * ones are simply not in the lists: no `password_hash`, no `refresh_token_hash`, no
 * `auth_challenges.code_hash`, no `user_sessions.token_hash`. There is no "include secrets" flag
 * to get them wrong with. A challenge is reported by its LIFECYCLE — issued, sent, attempted,
 * consumed, expired — which is exactly what an operator diagnosing "the code never arrived" needs,
 * and none of what would let them impersonate the customer.
 *
 * ONE PRIVILEGE, DELIBERATELY NARROW. An admin can switch 2FA OFF for an account and can end the
 * sign-in codes in flight on it. Both are the recovery levers a real support case needs — a
 * customer who has lost access to the verified inbox that IS their second factor cannot help
 * themselves, and there are no recovery codes in this system to rescue them. Neither lever can be
 * used to get INTO an account: no session is issued here, no password is changed, no code is read.
 *
 * NOTHING IS FABRICATED. Every number is a real aggregate over real rows, and an account that has
 * done nothing shows zeroes and empty lists rather than an invented history.
 */

/** The two `auth_challenges` purposes that make up a 2FA sign-in: the typed code and the ticket
 * it is redeemed alongside. Named once so no query site can drift onto a different pair. */
const TWO_FACTOR_PURPOSES = ['login_2fa', 'login_2fa_ticket'] as const satisfies readonly ChallengePurpose[];

/**
 * The events shown on ONE account's 2FA detail view.
 *
 * Wider than TWO_FACTOR_EVENT_TYPES on purpose: the question an operator brings to this page is
 * usually "why can this person not get in", and the sign-in outcomes are half that answer. The
 * cross-account feed stays narrow (2FA types only) because a general all-users read of every
 * security event is a bigger surface than this task needs.
 */
const DETAIL_EVENT_TYPES = [
  ...TWO_FACTOR_EVENT_TYPES,
  'login_success',
  'login_failed',
] as const satisfies readonly SecurityEventType[];

/** Matches the customer-facing endpoints' ceiling. A page is a page; there is no "all" here. */
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

/** Rolling window for the overview's rate figures. Long enough to cover an overnight incident,
 * short enough that "how is 2FA doing right now" is not answered with last month's totals. */
const OVERVIEW_WINDOW_HOURS = 24;

export interface Page<T> {
  rows: T[];
  total: number;
  limit: number;
  offset: number;
}

interface Pagination {
  limit?: number;
  offset?: number;
}

function resolvePage(input: Pagination): { limit: number; offset: number } {
  return {
    limit: Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT),
    offset: Math.max(input.offset ?? 0, 0),
  };
}

/**
 * Escapes the LIKE wildcards in an operator's search term.
 *
 * Without this, a search of `%` matches every row — turning a bounded lookup into a full-table
 * scan of `users` on every keystroke. The value itself is always a bound parameter (Drizzle never
 * concatenates it into SQL), so this is about query cost, not injection.
 */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

async function countUsers(where?: SQL): Promise<number> {
  const [row] = await db.select({ value: count() }).from(users).where(where);
  return Number(row?.value ?? 0);
}

async function countChallenges(where: SQL): Promise<number> {
  const [row] = await db.select({ value: count() }).from(authChallenges).where(where);
  return Number(row?.value ?? 0);
}

async function countEvents(where: SQL): Promise<number> {
  const [row] = await db.select({ value: count() }).from(securityEvents).where(where);
  return Number(row?.value ?? 0);
}

const inTwoFactorPurposes = () => inArray(authChallenges.purpose, [...TWO_FACTOR_PURPOSES]);

// ─── Monitoring: the estate at a glance ──────────────────────────────

export interface TwoFactorOverview {
  generatedAt: Date;
  windowHours: number;
  /**
   * Whether SMTP is configured. Load-bearing rather than decorative: the second factor IS an
   * emailed code, so with no working mail nobody can enable 2FA (the customer endpoint refuses
   * with 503) and nobody who has it enabled can complete a sign-in. It belongs at the top of an
   * operator's dashboard.
   */
  mailerConfigured: boolean;
  accounts: {
    total: number;
    twoFactorEnabled: number;
    twoFactorDisabled: number;
    emailVerified: number;
    emailUnverified: number;
    /** Verified address, 2FA still off — the population that COULD turn it on today. */
    eligibleNotEnrolled: number;
    /** Unverified address — cannot enable 2FA at all until the address is confirmed. */
    ineligible: number;
  };
  admins: {
    total: number;
    withTwoFactor: number;
    /** Operators holding platform privileges behind a password alone. The single most useful
     * number on this endpoint, which is why it is reported rather than left to be derived. */
    withoutTwoFactor: number;
  };
  challenges: {
    /** Issued in the window. */
    issued: number;
    /** Of those, ones a send actually succeeded for. */
    delivered: number;
    /** Of those, ones where a send was attempted and failed — the operator's work queue. */
    undelivered: number;
    /** Live right now, window-independent: issued, unspent, unexpired. */
    openNow: number;
    /** Died with their attempt budget spent — either a mistyping customer or a guessing run. */
    attemptsExhausted: number;
  };
  events: Record<TwoFactorEventType, number>;
}

export async function getTwoFactorOverview(): Promise<TwoFactorOverview> {
  const now = new Date();
  const since = new Date(now.getTime() - OVERVIEW_WINDOW_HOURS * 60 * 60 * 1000);

  const issuedInWindow = and(inTwoFactorPurposes(), gte(authChallenges.createdAt, since)) as SQL;

  const [
    total,
    twoFactorEnabled,
    emailVerified,
    eligibleNotEnrolled,
    adminTotal,
    adminWithTwoFactor,
    issued,
    delivered,
    undelivered,
    openNow,
    attemptsExhausted,
    eventCounts,
  ] = await Promise.all([
    countUsers(),
    countUsers(isNotNull(users.twoFactorEnabledAt)),
    countUsers(isNotNull(users.emailVerifiedAt)),
    countUsers(and(isNotNull(users.emailVerifiedAt), isNull(users.twoFactorEnabledAt))),
    countUsers(eq(users.isPlatformAdmin, true)),
    countUsers(and(eq(users.isPlatformAdmin, true), isNotNull(users.twoFactorEnabledAt))),
    countChallenges(issuedInWindow),
    countChallenges(and(issuedInWindow, isNotNull(authChallenges.sentAt)) as SQL),
    countChallenges(
      and(issuedInWindow, isNull(authChallenges.sentAt), gt(authChallenges.deliveryAttempts, 0)) as SQL,
    ),
    countChallenges(
      and(inTwoFactorPurposes(), isNull(authChallenges.consumedAt), gt(authChallenges.expiresAt, now)) as SQL,
    ),
    countChallenges(
      and(issuedInWindow, gte(authChallenges.attempts, authChallenges.maxAttempts)) as SQL,
    ),
    Promise.all(
      TWO_FACTOR_EVENT_TYPES.map(async (type) => [
        type,
        await countEvents(and(eq(securityEvents.type, type), gte(securityEvents.createdAt, since)) as SQL),
      ] as const),
    ),
  ]);

  return {
    generatedAt: now,
    windowHours: OVERVIEW_WINDOW_HOURS,
    mailerConfigured: mailerConfigured(),
    accounts: {
      total,
      twoFactorEnabled,
      twoFactorDisabled: total - twoFactorEnabled,
      emailVerified,
      emailUnverified: total - emailVerified,
      eligibleNotEnrolled,
      ineligible: total - emailVerified,
    },
    admins: {
      total: adminTotal,
      withTwoFactor: adminWithTwoFactor,
      withoutTwoFactor: adminTotal - adminWithTwoFactor,
    },
    challenges: { issued, delivered, undelivered, openNow, attemptsExhausted },
    events: Object.fromEntries(eventCounts) as Record<TwoFactorEventType, number>,
  };
}

// ─── Monitoring: the 2FA roster ──────────────────────────────────────

export interface AdminTwoFactorUserRow {
  id: number;
  fullName: string;
  email: string;
  isPlatformAdmin: boolean;
  createdAt: Date;
  emailVerifiedAt: Date | null;
  /** Non-null == 2FA on. The column IS the state; there is no secret behind it. */
  twoFactorEnabledAt: Date | null;
  /** Derived, not stored: 2FA cannot be enabled on an unverified address. */
  eligibleForTwoFactor: boolean;
  /** Live, unexpired sessions. Real count from `user_sessions`, 0 when there are none. */
  activeSessionCount: number;
  /** A 2FA code or ticket is open right now — this account is mid-sign-in. */
  signInInProgress: boolean;
}

export interface ListUsersFilters extends Pagination {
  enabled?: boolean;
  emailVerified?: boolean;
  adminsOnly?: boolean;
  search?: string;
}

export async function listTwoFactorUsers(filters: ListUsersFilters): Promise<Page<AdminTwoFactorUserRow>> {
  const { limit, offset } = resolvePage(filters);
  const now = new Date();

  const conditions: SQL[] = [];
  if (filters.enabled === true) conditions.push(isNotNull(users.twoFactorEnabledAt));
  if (filters.enabled === false) conditions.push(isNull(users.twoFactorEnabledAt));
  if (filters.emailVerified === true) conditions.push(isNotNull(users.emailVerifiedAt));
  if (filters.emailVerified === false) conditions.push(isNull(users.emailVerifiedAt));
  if (filters.adminsOnly === true) conditions.push(eq(users.isPlatformAdmin, true));
  if (filters.search) {
    const term = `%${escapeLike(filters.search)}%`;
    conditions.push(or(like(users.fullName, term), like(users.email, term)) as SQL);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, total] = await Promise.all([
    db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        isPlatformAdmin: users.isPlatformAdmin,
        createdAt: users.createdAt,
        emailVerifiedAt: users.emailVerifiedAt,
        twoFactorEnabledAt: users.twoFactorEnabledAt,
      })
      .from(users)
      // Newest account first, and by id so the order is total — two rows created in the same
      // second must not swap places between pages.
      .orderBy(desc(users.createdAt), desc(users.id))
      .where(where)
      .limit(limit)
      .offset(offset),
    countUsers(where),
  ]);

  const ids = rows.map((row) => row.id);
  // Two grouped aggregates over the PAGE's ids, rather than a per-row query each. An empty page
  // skips them entirely — inArray on an empty list is not a query worth sending.
  const [sessionCounts, openChallenges] = ids.length
    ? await Promise.all([
        db
          .select({ userId: userSessions.userId, value: count() })
          .from(userSessions)
          .where(
            and(
              inArray(userSessions.userId, ids),
              isNull(userSessions.revokedAt),
              gt(userSessions.expiresAt, now),
            ),
          )
          .groupBy(userSessions.userId),
        db
          .select({ userId: authChallenges.userId, value: count() })
          .from(authChallenges)
          .where(
            and(
              inArray(authChallenges.userId, ids),
              inTwoFactorPurposes(),
              isNull(authChallenges.consumedAt),
              gt(authChallenges.expiresAt, now),
            ),
          )
          .groupBy(authChallenges.userId),
      ])
    : [[], []];

  const sessionsByUser = new Map(sessionCounts.map((row) => [row.userId, Number(row.value)]));
  const openByUser = new Map(openChallenges.map((row) => [row.userId, Number(row.value)]));

  return {
    rows: rows.map((row) => ({
      ...row,
      eligibleForTwoFactor: row.emailVerifiedAt !== null,
      activeSessionCount: sessionsByUser.get(row.id) ?? 0,
      signInInProgress: (openByUser.get(row.id) ?? 0) > 0,
    })),
    total,
    limit,
    offset,
  };
}

// ─── Monitoring: one account ─────────────────────────────────────────

/**
 * A challenge as an operator may see it: its whole lifecycle, and none of its secret.
 *
 * `code_hash` is not selected — not redacted downstream, not selected. A bcrypt hash of a
 * six-digit code is a million-candidate offline search, so it is a credential, and it has no
 * business in an API response even to an admin.
 */
export interface AdminChallengeRow {
  id: number;
  userId: number;
  purpose: string;
  createdAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
  attempts: number;
  maxAttempts: number;
  /** Non-null == a send genuinely succeeded. Null with deliveryAttempts > 0 == it failed. */
  sentAt: Date | null;
  deliveryAttempts: number;
  /** The transport's own message, already truncated at write time. Never an address, never a code. */
  lastDeliveryError: string | null;
  /** Derived at read time so a stale row is never presented as live. */
  status: 'open' | 'consumed' | 'expired';
}

const challengeColumns = {
  id: authChallenges.id,
  userId: authChallenges.userId,
  purpose: authChallenges.purpose,
  createdAt: authChallenges.createdAt,
  expiresAt: authChallenges.expiresAt,
  consumedAt: authChallenges.consumedAt,
  attempts: authChallenges.attempts,
  maxAttempts: authChallenges.maxAttempts,
  sentAt: authChallenges.sentAt,
  deliveryAttempts: authChallenges.deliveryAttempts,
  lastDeliveryError: authChallenges.lastDeliveryError,
};

type ChallengeSelection = { [K in keyof typeof challengeColumns]: AdminChallengeRow[K] };

/** Pure, so the status rule can be asserted directly rather than only through the database. */
export function toAdminChallengeRow(row: ChallengeSelection, now: Date = new Date()): AdminChallengeRow {
  return {
    ...row,
    status:
      row.consumedAt !== null
        ? 'consumed'
        : row.expiresAt.getTime() <= now.getTime()
          ? 'expired'
          : 'open',
  };
}

export interface AdminSecurityEventRow {
  id: number;
  userId: number;
  type: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  context: Record<string, unknown> | null;
}

export interface AdminTwoFactorUserDetail {
  user: AdminTwoFactorUserRow;
  twoFactor: {
    enabled: boolean;
    enabledAt: Date | null;
    /** Why it cannot be enabled, when it cannot. Null when the account is eligible. */
    blockedReason: 'EMAIL_NOT_VERIFIED' | null;
  };
  /** Newest first, capped. Lifecycle only. */
  challenges: AdminChallengeRow[];
  /** Newest first, capped. 2FA changes plus sign-in outcomes — see DETAIL_EVENT_TYPES. */
  recentEvents: AdminSecurityEventRow[];
  /** Privileged actions taken against this account, newest first, with the operator's reason. */
  adminActions: AdminActionRow[];
}

const DETAIL_CAP = 20;

export async function getTwoFactorUserDetail(userId: number): Promise<AdminTwoFactorUserDetail> {
  const now = new Date();

  const [user] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      isPlatformAdmin: users.isPlatformAdmin,
      createdAt: users.createdAt,
      emailVerifiedAt: users.emailVerifiedAt,
      twoFactorEnabledAt: users.twoFactorEnabledAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');

  const [activeSessions, challengeRows, eventRows, actionRows] = await Promise.all([
    db
      .select({ value: count() })
      .from(userSessions)
      .where(
        and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt), gt(userSessions.expiresAt, now)),
      ),
    db
      .select(challengeColumns)
      .from(authChallenges)
      .where(and(eq(authChallenges.userId, userId), inTwoFactorPurposes()))
      .orderBy(desc(authChallenges.id))
      .limit(DETAIL_CAP),
    db
      .select({
        id: securityEvents.id,
        userId: securityEvents.userId,
        type: securityEvents.type,
        ipAddress: securityEvents.ipAddress,
        userAgent: securityEvents.userAgent,
        createdAt: securityEvents.createdAt,
        metadata: securityEvents.metadata,
      })
      .from(securityEvents)
      .where(and(eq(securityEvents.userId, userId), inArray(securityEvents.type, [...DETAIL_EVENT_TYPES])))
      .orderBy(desc(securityEvents.createdAt), desc(securityEvents.id))
      .limit(DETAIL_CAP),
    listAdminActions({ targetUserId: userId, limit: DETAIL_CAP }),
  ]);

  const challenges = challengeRows.map((row) => toAdminChallengeRow(row, now));

  return {
    user: {
      ...user,
      eligibleForTwoFactor: user.emailVerifiedAt !== null,
      activeSessionCount: Number(activeSessions[0]?.value ?? 0),
      signInInProgress: challenges.some((row) => row.status === 'open'),
    },
    twoFactor: {
      enabled: user.twoFactorEnabledAt !== null,
      enabledAt: user.twoFactorEnabledAt,
      blockedReason: user.emailVerifiedAt === null ? 'EMAIL_NOT_VERIFIED' : null,
    },
    challenges,
    recentEvents: eventRows.map((row) => ({
      id: row.id,
      userId: row.userId,
      type: row.type,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      createdAt: row.createdAt,
      context: (row.metadata as Record<string, unknown> | null) ?? null,
    })),
    adminActions: actionRows.rows,
  };
}

// ─── Monitoring: cross-account feeds ─────────────────────────────────

export interface ListEventsFilters extends Pagination {
  userId?: number;
  type?: TwoFactorEventType;
}

/**
 * The 2FA event feed across every account.
 *
 * DELIBERATELY NARROW: the predicate always pins `type` to the 2FA vocabulary, whether or not the
 * caller passed one. This is not a general read of `security_events` — password changes, resets and
 * session revocations belong to their owners' own history, and widening this endpoint into "every
 * security event for everyone" is a bigger privilege than managing 2FA needs.
 */
export async function listTwoFactorEvents(filters: ListEventsFilters): Promise<Page<AdminSecurityEventRow>> {
  const { limit, offset } = resolvePage(filters);

  const conditions: SQL[] = [
    filters.type
      ? eq(securityEvents.type, filters.type)
      : (inArray(securityEvents.type, [...TWO_FACTOR_EVENT_TYPES]) as SQL),
  ];
  if (filters.userId !== undefined) conditions.push(eq(securityEvents.userId, filters.userId));
  const where = and(...conditions) as SQL;

  const [rows, total] = await Promise.all([
    db
      .select({
        id: securityEvents.id,
        userId: securityEvents.userId,
        type: securityEvents.type,
        ipAddress: securityEvents.ipAddress,
        userAgent: securityEvents.userAgent,
        createdAt: securityEvents.createdAt,
        metadata: securityEvents.metadata,
      })
      .from(securityEvents)
      .where(where)
      .orderBy(desc(securityEvents.createdAt), desc(securityEvents.id))
      .limit(limit)
      .offset(offset),
    countEvents(where),
  ]);

  return {
    rows: rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      type: row.type,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      createdAt: row.createdAt,
      context: (row.metadata as Record<string, unknown> | null) ?? null,
    })),
    total,
    limit,
    offset,
  };
}

export interface ListChallengesFilters extends Pagination {
  userId?: number;
  status?: 'all' | 'open' | 'undelivered';
}

/**
 * 2FA challenge health across every account — the endpoint that answers "whose codes are not
 * arriving?" from the delivery columns rather than from a customer's report.
 */
export async function listTwoFactorChallenges(
  filters: ListChallengesFilters,
): Promise<Page<AdminChallengeRow>> {
  const { limit, offset } = resolvePage(filters);
  const now = new Date();

  const conditions: SQL[] = [inTwoFactorPurposes() as SQL];
  if (filters.userId !== undefined) conditions.push(eq(authChallenges.userId, filters.userId));
  if (filters.status === 'open') {
    conditions.push(isNull(authChallenges.consumedAt), gt(authChallenges.expiresAt, now));
  }
  if (filters.status === 'undelivered') {
    // A send was attempted and none succeeded. `sentAt` is stamped only on success, which is what
    // makes this expressible at all — see recordDelivery() in auth-challenge.service.ts.
    conditions.push(isNull(authChallenges.sentAt), gt(authChallenges.deliveryAttempts, 0));
  }
  const where = and(...conditions) as SQL;

  const [rows, total] = await Promise.all([
    db
      .select(challengeColumns)
      .from(authChallenges)
      .where(where)
      .orderBy(desc(authChallenges.id))
      .limit(limit)
      .offset(offset),
    countChallenges(where),
  ]);

  return { rows: rows.map((row) => toAdminChallengeRow(row, now)), total, limit, offset };
}

// ─── The operator trail ──────────────────────────────────────────────

export type AdminActionName = 'two_factor_disabled' | 'two_factor_challenges_revoked';

export interface AdminActionRow {
  id: number;
  actorUserId: number;
  actorEmail: string | null;
  targetUserId: number;
  action: string;
  reason: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface ListActionsFilters extends Pagination {
  targetUserId?: number;
  actorUserId?: number;
}

export async function listAdminActions(filters: ListActionsFilters): Promise<Page<AdminActionRow>> {
  const { limit, offset } = resolvePage(filters);

  const conditions: SQL[] = [];
  if (filters.targetUserId !== undefined) {
    conditions.push(eq(adminSecurityActions.targetUserId, filters.targetUserId));
  }
  if (filters.actorUserId !== undefined) {
    conditions.push(eq(adminSecurityActions.actorUserId, filters.actorUserId));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: adminSecurityActions.id,
        actorUserId: adminSecurityActions.actorUserId,
        // Joined so the trail names the operator rather than an id a reader has to look up. The
        // join is on the users table's primary key; nothing but the address is taken from it.
        actorEmail: users.email,
        targetUserId: adminSecurityActions.targetUserId,
        action: adminSecurityActions.action,
        reason: adminSecurityActions.reason,
        ipAddress: adminSecurityActions.ipAddress,
        userAgent: adminSecurityActions.userAgent,
        createdAt: adminSecurityActions.createdAt,
      })
      .from(adminSecurityActions)
      .leftJoin(users, eq(users.id, adminSecurityActions.actorUserId))
      .where(where)
      .orderBy(desc(adminSecurityActions.createdAt), desc(adminSecurityActions.id))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(adminSecurityActions).where(where),
  ]);

  return { rows, total: Number(totalRow[0]?.value ?? 0), limit, offset };
}

// ─── The two privileged actions ──────────────────────────────────────

/** Loads the target, refusing an id that does not exist. Selects no credential column. */
async function loadTarget(targetUserId: number) {
  const [target] = await db
    .select({
      id: users.id,
      email: users.email,
      twoFactorEnabledAt: users.twoFactorEnabledAt,
    })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (!target) throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  return target;
}

export interface AdminDisableResult {
  twoFactorEnabled: false;
  /** False when 2FA was already off — the call is idempotent and writes no audit row for a non-event. */
  changed: boolean;
  /** In-flight 2FA codes/tickets closed as part of the same change. */
  challengesRevoked: number;
}

/**
 * Switches 2FA OFF for another account.
 *
 * WHY THIS EXISTS. The second factor is control of the verified inbox, and this system has no
 * recovery codes. A customer who loses that inbox is locked out permanently with no self-service
 * route back, so the only alternative to an operator lever is telling them their account is gone.
 *
 * WHAT IT CANNOT DO. It does not sign anyone in, does not touch the password, does not read a code
 * and does not create a session. After it runs, the account is back to password-only — the same
 * state every account starts in — and the owner still has to know their password to get in.
 *
 * FOUR GUARDS:
 *
 *   1. NOT ON YOURSELF. An admin's own 2FA comes off through the password-gated customer endpoint.
 *      Allowing self-service here would turn a reason string into a way around that password gate,
 *      which is the one thing standing between a stolen admin access token and a lowered defence.
 *
 *   2. A REASON, validated at the route and stored. An unexplained privileged action is not
 *      auditable, and this is the row a later investigation actually reads.
 *
 *   3. IDEMPOTENT. Already off means nothing is written — neither the column nor the trail. An
 *      audit entry for a change that did not happen is history of a non-event.
 *
 *   4. IN-FLIGHT CHALLENGES DIE WITH IT. completeTwoFactorChallenge() redeems a ticket without
 *      re-reading `two_factor_enabled_at`, so a sign-in already at the code step would otherwise
 *      sail past a disable that had just landed. Closing the open pair is what makes the change
 *      take effect immediately rather than at the end of the ten-minute window.
 *
 * THE COLUMN CHANGE AND THE TRAIL ARE ONE TRANSACTION, and that is the opposite trade from
 * recordSecurityEvent()'s never-throw: a customer's password change must not fail because a log
 * insert lost a race, but a privileged action against someone else's account must not happen if it
 * cannot be recorded. The customer-facing event is written after, best-effort, as everywhere else.
 */
export async function adminDisableTwoFactor(
  actor: AdminIdentity,
  targetUserId: number,
  reason: string,
  metadata: RequestMetadata,
): Promise<AdminDisableResult> {
  if (actor.id === targetUserId) {
    throw new ApiError(
      400,
      'Use Settings → Security to turn off your own two-factor authentication — that route requires your password.',
      'ADMIN_SELF_ACTION_FORBIDDEN',
    );
  }

  const target = await loadTarget(targetUserId);

  if (target.twoFactorEnabledAt === null) {
    return { twoFactorEnabled: false, changed: false, challengesRevoked: 0 };
  }

  const challengesRevoked = await db.transaction(async (tx) => {
    await tx.update(users).set({ twoFactorEnabledAt: null }).where(eq(users.id, targetUserId));
    const revoked = await consumeOpenChallenges(targetUserId, TWO_FACTOR_PURPOSES, tx);
    await tx.insert(adminSecurityActions).values({
      actorUserId: actor.id,
      targetUserId,
      action: 'two_factor_disabled',
      reason,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
    return revoked;
  });

  // Into the OWNER's own history, so the person whose protection was removed can see that it was,
  // and that an operator did it. Context carries ids and counts only — never the reason text,
  // which is operator prose and belongs in the trail above.
  await recordSecurityEvent({
    userId: targetUserId,
    type: 'two_factor_admin_disabled',
    metadata,
    context: { actorUserId: actor.id, challengesRevoked },
  });

  console.log(
    `[scorelo-admin] 2FA disabled for user ${targetUserId} by admin ${actor.id}; ${challengesRevoked} open challenge(s) closed`,
  );

  return { twoFactorEnabled: false, changed: true, challengesRevoked };
}

export interface AdminRevokeChallengesResult {
  revoked: number;
  changed: boolean;
}

/**
 * Closes the 2FA codes and tickets currently open on an account, ending any sign-in mid-flight.
 *
 * THE LEVER FOR AN ATTACK IN PROGRESS: the monitoring endpoints show a run of attempts against one
 * account, and this cuts the in-flight credentials without touching the account's protection. It
 * is the opposite of the disable above — it makes the account harder to get into, not easier —
 * which is why it is a separate call rather than a flag on that one.
 *
 * NOTHING IS DELETED. A `consumed_at` stamp is exactly how this service already represents "spent"
 * (see auth-challenge.service.ts), so the delivery history of a closed challenge stays readable.
 *
 * Only the two 2FA purposes are touched. A password reset or an email verification the same person
 * legitimately has in flight is left alone.
 *
 * SELF IS ALLOWED HERE, unlike the disable: closing your own in-flight codes removes no protection
 * and grants no access, so there is no password gate to be routed around.
 */
export async function adminRevokeTwoFactorChallenges(
  actor: AdminIdentity,
  targetUserId: number,
  reason: string,
  metadata: RequestMetadata,
): Promise<AdminRevokeChallengesResult> {
  await loadTarget(targetUserId);

  const revoked = await db.transaction(async (tx) => {
    const closed = await consumeOpenChallenges(targetUserId, TWO_FACTOR_PURPOSES, tx);
    if (closed === 0) return 0;

    await tx.insert(adminSecurityActions).values({
      actorUserId: actor.id,
      targetUserId,
      action: 'two_factor_challenges_revoked',
      reason,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
    return closed;
  });

  if (revoked === 0) return { revoked: 0, changed: false };

  await recordSecurityEvent({
    userId: targetUserId,
    type: 'two_factor_challenges_revoked',
    metadata,
    context: { actorUserId: actor.id, revoked },
  });

  console.log(
    `[scorelo-admin] ${revoked} open 2FA challenge(s) closed for user ${targetUserId} by admin ${actor.id}`,
  );

  return { revoked, changed: true };
}
