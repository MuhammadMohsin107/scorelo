import { and, desc, eq, gt } from 'drizzle-orm';
import { db } from '../db/client.js';
import { insertReturning, updateReturning } from '../db/returning.js';
import { notifications, stores, users } from '../db/schema.js';
import { ApiError } from '../middleware/error.js';
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

export async function listNotifications(userId: number, storeId?: number) {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);

  return db
    .select()
    .from(notifications)
    .where(eq(notifications.storeId, resolvedStoreId))
    .orderBy(desc(notifications.createdAt));
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
