import { Router } from 'express';
import { getNotifications, markAllNotificationsAsRead, markNotificationAsRead } from '../controllers/notification.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { notificationIdSchema } from '../schemas/notification.schema.js';
import { storeIdQuerySchema } from '../schemas/common.schema.js';

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);
notificationsRouter.get('/', validateRequest({ query: storeIdQuerySchema }), asyncHandler(getNotifications));
notificationsRouter.patch('/read-all', validateRequest({ query: storeIdQuerySchema }), asyncHandler(markAllNotificationsAsRead));
notificationsRouter.patch('/:id/read', validateRequest({ params: notificationIdSchema, query: storeIdQuerySchema }), asyncHandler(markNotificationAsRead));
