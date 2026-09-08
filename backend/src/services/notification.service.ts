import { and, count, desc, eq, gt, isNull, lt } from 'drizzle-orm';
import { db } from '../db/client.js';
import { insertReturning, updateReturning } from '../db/returning.js';
import { auditScores, audits, notifications, stores, users } from '../db/schema.js';
import { ApiError } from '../middleware/error.js';
import { pillarLabel } from '../lib/report-labels.js';
import { getCurrentStoreId } from './store.service.js';

/**
 * ─── Writing notifications ───────────────────────────────────────────
 *
 * The bell exists for things that happened WHILE THE MERCHANT WAS NOT LOOKING. That is the whole
 * test for whether an event belongs here.
 *
 * So a successful store connection does NOT create one: the merchant is standing in front of the
 * screen when it happens, the Integrations page shows a banner at that moment, and the connection
 * state is permanently visible on that page afterwards. A notification would repeat what is
 * already on screen.
 *
 * An uninstall, an expired token, a failed background sync and a finished audit DO create one:
 * every one of them happens without the merchant present, and none of them is visible until
 * somebody thinks to go looking.
 */

/**
 * Which user preference gates which notification type.
 *
 * These columns already existed on `users` and were already editable in Settings — and were read
 * by nothing at all, so every toggle was decorative. They gate real writes now, which is what
 * makes them settings rather than switches.
 */
const PREFERENCE_BY_TYPE = {
  analysis_complete: 'notifyAnalysisComplete',
  critical_issue: 'notifyCriticalIssues',
  score_change: 'notifyScoreChanges',
  weekly_summary: 'notifyWeeklySummary',
  integration_alert: 'notifyIntegrationAlerts',
  product_update: 'notifyProductUpdates',
} as const;

export type NotificationType = keyof typeof PREFERENCE_BY_TYPE;
export type NotificationTone = 'neutral' | 'success' | 'warning' | 'critical' | 'info';

export interface CreateNotificationInput {
  storeId: number;
  type: NotificationType;
  title: string;
  message: string;
  tone?: NotificationTone;
  /**
   * Suppresses a duplicate of the same type for this store within the given minutes.
   *
   * A revoked token is discovered by every audit, every sync and every page load that touches
   * Shopify — without this, one expired token would bury the bell under identical rows saying the
   * same thing. The merchant needs to be told once.
   */
  dedupeMinutes?: number;
}

/**
 * Records one notification, or returns null when it was suppressed.
 *
 * NEVER THROWS. This is called from webhook handlers and from the audit worker, where the event
 * being recorded is not the caller's actual job: a notification that could not be written must not
 * fail an uninstall webhook or roll back a completed audit. Failures are logged and swallowed.
 */
export async function createNotification(input: CreateNotificationInput): Promise<typeof notifications.$inferSelect | null> {
  try {
    const [owner] = await db
      .select({
        notifyAnalysisComplete: users.notifyAnalysisComplete,
        notifyCriticalIssues: users.notifyCriticalIssues,
        notifyScoreChanges: users.notifyScoreChanges,
        notifyWeeklySummary: users.notifyWeeklySummary,
        notifyIntegrationAlerts: users.notifyIntegrationAlerts,
        notifyProductUpdates: users.notifyProductUpdates,
      })
      .from(stores)
      .innerJoin(users, eq(stores.ownerId, users.id))
      .where(eq(stores.id, input.storeId))
      .limit(1);

    // No owner means no one to notify. Not an error — a store row can outlive its user during a
    // deletion cascade, and the webhook that triggered this still has to return 200.
    if (!owner) return null;
    if (!owner[PREFERENCE_BY_TYPE[input.type]]) return null;

    if (input.dedupeMinutes && input.dedupeMinutes > 0) {
      const since = new Date(Date.now() - input.dedupeMinutes * 60_000);
      const [recent] = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(and(
          eq(notifications.storeId, input.storeId),
          eq(notifications.type, input.type),
          gt(notifications.createdAt, since),
        ))
        .limit(1);
      if (recent) return null;
    }

    return await insertReturning(notifications, {
      storeId: input.storeId,
      type: input.type,
      title: input.title,
      message: input.message,
      tone: input.tone ?? 'info',
    });
  } catch (error) {
    console.warn(`[scorelo-api] notification not recorded (${input.type}): ${error instanceof Error ? error.message : 'unknown error'}`);
    return null;
  }
}

/**
 * The movement a pillar has to make before it is worth interrupting someone about.
 *
 * 5 points is not an arbitrary threshold: Settings promises "when any pillar score moves by more
 * than 5 points between audits", so the rule and the sentence describing it are the same number.
 */
const SCORE_CHANGE_THRESHOLD = 5;

/**
 * Compares the audit just written against the one before it and reports the largest pillar move.
 *
 * This is the write that made `notifyScoreChanges` a real preference. The column existed, Settings
 * offered the toggle and described exactly this behaviour — and nothing anywhere created a
 * `score_change` notification, so the switch had no effect in either position.
 *
 * A pillar that was not measured in either audit is skipped rather than treated as a move from
 * zero: "not measured" becoming "62" is not an improvement of 62 points.
 *
 * Never throws — it runs at the end of a completed audit and must not fail one.
 */
export async function notifyScoreMovement(storeId: number, auditId: number): Promise<void> {
  try {
    const [previous] = await db
      .select({ id: audits.id })
      .from(audits)
      .where(and(eq(audits.storeId, storeId), lt(audits.id, auditId)))
      .orderBy(desc(audits.id))
      .limit(1);
    // A store's first audit has nothing to compare against. Silence is the correct output.
    if (!previous) return;

    const [current, before] = await Promise.all([
      db.select().from(auditScores).where(and(eq(auditScores.auditId, auditId), isNull(auditScores.subPillar))),
      db.select().from(auditScores).where(and(eq(auditScores.auditId, previous.id), isNull(auditScores.subPillar))),
    ]);

    const measured = (row: typeof auditScores.$inferSelect | undefined) =>
      Boolean(row) && (row!.details as { status?: string } | null)?.status !== 'unavailable';

    let biggest: { pillar: string; from: number; to: number; delta: number } | null = null;
    for (const row of current) {
      const match = before.find((other) => other.pillar === row.pillar);
      if (!measured(row) || !measured(match)) continue;
      const delta = row.score - match!.score;
      if (Math.abs(delta) <= SCORE_CHANGE_THRESHOLD) continue;
      if (!biggest || Math.abs(delta) > Math.abs(biggest.delta)) {
        biggest = { pillar: row.pillar, from: match!.score, to: row.score, delta };
      }
    }

    if (!biggest) return;

    const label = pillarLabel(biggest.pillar);
    const improved = biggest.delta > 0;
    await createNotification({
      storeId,
      type: 'score_change',
      title: `${label} ${improved ? 'improved' : 'dropped'} by ${Math.abs(biggest.delta)} points`,
      // Both numbers, not just the delta: "dropped 8 points" reads very differently at 91→83
      // than at 30→22, and the merchant should not have to open the app to find out which.
      message: `${label} moved from ${biggest.from} to ${biggest.to} since the previous audit. Open the pillar to see which checks changed.`,
      tone: improved ? 'success' : 'warning',
    });
  } catch (error) {
    console.warn(`[scorelo-api] score-change notification not evaluated: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

export interface NotificationList {
  items: Array<typeof notifications.$inferSelect>;
  /** Unread across the WHOLE store, not just the page returned — this drives the bell badge. */
  unreadCount: number;
  total: number;
}

/**
 * The recent notifications plus the store's real unread and total counts.
 *
 * The counts are separate queries on purpose. This used to return every row the store had ever
 * received and let the browser count the unread ones, which meant the list grew without limit and
 * — the moment a limit was added — the badge would have counted only what fitted on the page.
 */
export async function listNotifications(
  userId: number,
  query: { limit: number },
  storeId?: number,
): Promise<NotificationList> {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);
  const forStore = eq(notifications.storeId, resolvedStoreId);

  const [items, [unread], [all]] = await Promise.all([
    db.select().from(notifications).where(forStore).orderBy(desc(notifications.createdAt)).limit(query.limit),
    db.select({ value: count() }).from(notifications).where(and(forStore, eq(notifications.isRead, false))),
    db.select({ value: count() }).from(notifications).where(forStore),
  ]);

  return { items, unreadCount: unread?.value ?? 0, total: all?.value ?? 0 };
}

export async function markNotificationRead(userId: number, id: number, storeId?: number) {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);

  const [notification] = await updateReturning(
    notifications,
    { isRead: true },
    and(eq(notifications.id, id), eq(notifications.storeId, resolvedStoreId)),
  );

  if (!notification) {
    throw new ApiError(404, 'Notification not found', 'NOTIFICATION_NOT_FOUND');
  }

  return notification;
}

export async function markAllNotificationsRead(userId: number, storeId?: number) {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);

  // updateReturning captures the matching ids before writing — essential here, where the
  // update flips the very column the predicate tests.
  return updateReturning(
    notifications,
    { isRead: true },
    and(eq(notifications.storeId, resolvedStoreId), eq(notifications.isRead, false)),
  );
}
