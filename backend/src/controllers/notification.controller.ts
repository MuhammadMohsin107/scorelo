import type { Request, Response } from 'express';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../services/notification.service.js';
import { optionalStoreId, requireUserId } from '../lib/requestContext.js';

export async function getNotifications(req: Request, res: Response) {
  res.json({ data: await listNotifications(requireUserId(req), optionalStoreId(req)) });
}

export async function markNotificationAsRead(req: Request, res: Response) {
  res.json({ data: await markNotificationRead(requireUserId(req), Number(req.params.id), optionalStoreId(req)) });
}

export async function markAllNotificationsAsRead(req: Request, res: Response) {
  res.json({ data: await markAllNotificationsRead(requireUserId(req), optionalStoreId(req)) });
}
