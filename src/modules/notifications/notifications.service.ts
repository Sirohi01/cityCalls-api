import { NotificationModel, NotificationTemplateModel } from './notificationTemplates.model';
import { NotFoundError, ForbiddenError } from '../../lib/errors';
import { buildPaginationMeta } from '../../lib/apiResponse';

interface ListParams {
  page: number;
  limit: number;
  channel?: string;
  status?: string;
  unreadOnly?: boolean;
}

export async function listMyNotifications(userId: string, params: ListParams) {
  const filter: Record<string, unknown> = { recipientUserId: userId };
  if (params.channel) filter.channel = params.channel;
  if (params.status) filter.status = params.status;
  if (params.unreadOnly) filter.readAt = { $exists: false };

  const skip = (params.page - 1) * params.limit;
  const [items, total] = await Promise.all([
    NotificationModel.find(filter).skip(skip).limit(params.limit).sort({ createdAt: -1 }),
    NotificationModel.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(params.page, params.limit, total) };
}

export async function markRead(id: string, userId: string) {
  const notification = await NotificationModel.findById(id);
  if (!notification) throw new NotFoundError('Notification not found');
  if (notification.recipientUserId?.toString() !== userId) {
    throw new ForbiddenError('You can only mark your own notifications as read');
  }

  notification.status = 'READ';
  notification.readAt = new Date();
  await notification.save();
  return notification;
}

export async function getUnreadCount(userId: string) {
  return NotificationModel.countDocuments({ recipientUserId: userId, readAt: { $exists: false } });
}

// Admin template management — docs/11-complete-api-contracts.md §2 "Notifications" row.
export async function listTemplates(triggerKey?: string) {
  const filter: Record<string, unknown> = {};
  if (triggerKey) filter.triggerKey = triggerKey;
  return NotificationTemplateModel.find(filter).sort({ triggerKey: 1, channel: 1 });
}

export async function updateTemplate(id: string, data: { bodyTemplate?: string; subjectTemplate?: string; active?: boolean }) {
  const template = await NotificationTemplateModel.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (!template) throw new NotFoundError('Notification template not found');
  return template;
}
