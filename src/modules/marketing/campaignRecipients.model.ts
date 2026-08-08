import { Document, Schema, Types, model } from 'mongoose';
import { CampaignRecipientType } from './campaigns.model';

export const CAMPAIGN_RECIPIENT_STATUSES = ['QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SKIPPED'] as const;
export type CampaignRecipientStatus = (typeof CAMPAIGN_RECIPIENT_STATUSES)[number];

export interface ICampaignRecipient extends Document {
  campaignId: Types.ObjectId;
  recipientType: CampaignRecipientType;
  recipientId: string;
  name: string;
  destination: string;
  status: CampaignRecipientStatus;
  attemptCount: number;
  providerResponse?: unknown;
  failureReason?: string;
  queuedAt: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const campaignRecipientSchema = new Schema<ICampaignRecipient>(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true },
    recipientType: { type: String, required: true },
    recipientId: { type: String, required: true },
    name: { type: String, required: true },
    destination: { type: String, required: true },
    status: { type: String, enum: CAMPAIGN_RECIPIENT_STATUSES, default: 'QUEUED' },
    attemptCount: { type: Number, default: 0 },
    providerResponse: { type: Schema.Types.Mixed },
    failureReason: { type: String },
    queuedAt: { type: Date, default: Date.now },
    sentAt: { type: Date },
    deliveredAt: { type: Date },
    readAt: { type: Date },
  },
  { timestamps: true }
);

campaignRecipientSchema.index({ campaignId: 1, destination: 1 }, { unique: true });
campaignRecipientSchema.index({ status: 1, queuedAt: 1 });

export const CampaignRecipientModel = model<ICampaignRecipient>('CampaignRecipient', campaignRecipientSchema);
