import { Schema, model, Document, Types } from 'mongoose';

export const NOTIFICATION_CHANNELS = ['IN_APP', 'PUSH', 'EMAIL', 'WHATSAPP', 'SMS'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

// docs/09-database-architecture.md §2 "notification_templates" — one row per
// {triggerKey, channel}. Registering a new trigger is adding rows here, never
// hardcoding a switch statement per docs/13-notification-and-template-system.md §1.
export interface INotificationTemplate extends Document {
  triggerKey: string;
  channel: NotificationChannel;
  subjectTemplate?: string; // EMAIL only
  bodyTemplate: string;
  variables: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationTemplateSchema = new Schema<INotificationTemplate>(
  {
    triggerKey: { type: String, required: true },
    channel: { type: String, enum: NOTIFICATION_CHANNELS, required: true },
    subjectTemplate: { type: String },
    bodyTemplate: { type: String, required: true },
    variables: { type: [String], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

notificationTemplateSchema.index({ triggerKey: 1, channel: 1 }, { unique: true });

export const NotificationTemplateModel = model<INotificationTemplate>('NotificationTemplate', notificationTemplateSchema);

// docs/09-database-architecture.md §2 "notifications" — one document per
// {recipient, channel} delivery attempt.
export const NOTIFICATION_STATUSES = ['PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SKIPPED_INTEGRATION_DISABLED'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export interface INotification extends Document {
  templateId: Types.ObjectId;
  triggerKey: string;
  channel: NotificationChannel;
  recipientUserId?: Types.ObjectId;
  recipientMobile?: string;
  recipientEmail?: string;
  subject?: string;
  body: string; // fully-rendered content at send time, per docs/13 §7 — never a live template reference
  status: NotificationStatus;
  retryCount: number;
  sentAt?: Date;
  readAt?: Date;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    templateId: { type: Schema.Types.ObjectId, ref: 'NotificationTemplate', required: true },
    triggerKey: { type: String, required: true },
    channel: { type: String, enum: NOTIFICATION_CHANNELS, required: true },
    recipientUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    recipientMobile: { type: String },
    recipientEmail: { type: String },
    subject: { type: String },
    body: { type: String, required: true },
    status: { type: String, enum: NOTIFICATION_STATUSES, default: 'PENDING' },
    retryCount: { type: Number, default: 0 },
    sentAt: { type: Date },
    readAt: { type: Date },
    failureReason: { type: String },
  },
  { timestamps: true }
);

notificationSchema.index({ recipientUserId: 1, status: 1, createdAt: -1 });
notificationSchema.index({ status: 1, retryCount: 1 });

export const NotificationModel = model<INotification>('Notification', notificationSchema);
