import { z } from 'zod';
import { NOTIFICATION_CHANNELS, NOTIFICATION_STATUSES } from './notificationTemplates.model';

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  channel: z.enum(NOTIFICATION_CHANNELS).optional(),
  status: z.enum(NOTIFICATION_STATUSES).optional(),
  unreadOnly: z.coerce.boolean().optional(),
});
