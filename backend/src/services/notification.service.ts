import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { updateReturning } from '../db/returning.js';
import { notifications } from '../db/schema.js';
import { ApiError } from '../middleware/error.js';
import { getCurrentStoreId } from './store.service.js';

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
