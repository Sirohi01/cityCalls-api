import { Schema, model, Document, Types } from 'mongoose';

export const CAMPAIGN_STATUSES = ['DRAFT', 'SCHEDULED', 'SENDING', 'COMPLETED', 'CANCELLED'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

// docs/09-database-architecture.md §2 "campaigns" — WhatsApp/email marketing,
// distinct from the transactional notification engine (lib/notifications.ts):
// a campaign targets an *audience* (filtered customer segment) rather than a
// single event-triggered recipient, and is gated by marketing consent
// specifically, not the narrower transactional-consent assumption.
export interface ICampaign extends Document {
  name: string;
  channel: 'WHATSAPP' | 'EMAIL';
  templateId: Types.ObjectId;
  audienceFilter: { tags?: string[]; segments?: string[]; customerType?: 'INDIVIDUAL' | 'BUSINESS' };
  scheduledAt?: Date;
  status: CampaignStatus;
  stats: { sent: number; delivered: number; read: number; failed: number };
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const campaignSchema = new Schema<ICampaign>(
  {
    name: { type: String, required: true, trim: true },
    channel: { type: String, enum: ['WHATSAPP', 'EMAIL'], required: true },
    templateId: { type: Schema.Types.ObjectId, ref: 'NotificationTemplate', required: true },
    audienceFilter: {
      tags: { type: [String], default: [] },
      segments: { type: [String], default: [] },
      customerType: { type: String, enum: ['INDIVIDUAL', 'BUSINESS'] },
    },
    scheduledAt: { type: Date },
    status: { type: String, enum: CAMPAIGN_STATUSES, default: 'DRAFT' },
    stats: {
      sent: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      read: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

campaignSchema.index({ status: 1 });

export const CampaignModel = model<ICampaign>('Campaign', campaignSchema);
