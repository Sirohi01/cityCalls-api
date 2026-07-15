import { Response, NextFunction } from 'express';
import * as notificationsService from './notifications.service';
import { sendSuccess, paramAsString } from '../../lib/apiResponse';
import { ScopedRequest } from '../../middleware/permission.middleware';
import { UnauthorizedError } from '../../lib/errors';

export async function listMyNotificationsHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const { items, meta } = await notificationsService.listMyNotifications(req.user.sub, req.query as never);
    sendSuccess(res, items, 'Notifications fetched successfully', meta);
  } catch (err) {
    next(err);
  }
}

export async function markReadHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const notification = await notificationsService.markRead(paramAsString(req.params.id), req.user.sub);
    sendSuccess(res, notification, 'Notification marked as read');
  } catch (err) {
    next(err);
  }
}

export async function unreadCountHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const count = await notificationsService.getUnreadCount(req.user.sub);
    sendSuccess(res, { count }, 'Unread count fetched successfully');
  } catch (err) {
    next(err);
  }
}

export async function listTemplatesHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const templates = await notificationsService.listTemplates(req.query.triggerKey as string | undefined);
    sendSuccess(res, templates, 'Notification templates fetched successfully');
  } catch (err) {
    next(err);
  }
}

export async function updateTemplateHandler(req: ScopedRequest, res: Response, next: NextFunction) {
  try {
    const template = await notificationsService.updateTemplate(paramAsString(req.params.id), req.body);
    sendSuccess(res, template, 'Notification template updated successfully');
  } catch (err) {
    next(err);
  }
}
