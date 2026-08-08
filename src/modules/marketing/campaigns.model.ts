import { Schema, model, Document, Types } from 'mongoose';

export const CAMPAIGN_STATUSES = ['DRAFT', 'SCHEDULED', 'SENDING', 'COMPLETED', 'CANCELLED'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
export const CAMPAIGN_RECIPIENT_TYPES = ['CUSTOMER', 'USER', 'EMPLOYEE', 'VENDOR', 'VENDOR_TECHNICIAN', 'MANUAL'] as const;
export type CampaignRecipientType = (typeof CAMPAIGN_RECIPIENT_TYPES)[number];
export interface ICampaign extends Document {
  name: string;
  channel: 'WHATSAPP' | 'EMAIL';
  templateId: Types.ObjectId;
  providerCampaignName?: string;
  templateParams: string[];
  media?: { fileId?: Types.ObjectId; url: string; filename: string };
  audienceFilter: {
    recipientTypes: CampaignRecipientType[];
    tags?: string[];
    segments?: string[];
    customerType?: string;
    roles?: string[];
    branchIds?: Types.ObjectId[];
    vendorIds?: Types.ObjectId[];
    excludeMobiles?: string[];
    manualMobiles?: string[];
  };
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
    providerCampaignName: { type: String, trim: true },
    templateParams: { type: [String], default: [] },
    media: {
      fileId: { type: Schema.Types.ObjectId, ref: 'File' },
      url: { type: String },
      filename: { type: String },
    },
    audienceFilter: {
      recipientTypes: { type: [String], enum: CAMPAIGN_RECIPIENT_TYPES, default: ['CUSTOMER'] },
      tags: { type: [String], default: [] },
      segments: { type: [String], default: [] },
      customerType: { type: String },
      roles: { type: [String], default: [] },
      branchIds: [{ type: Schema.Types.ObjectId, ref: 'Branch' }],
      vendorIds: [{ type: Schema.Types.ObjectId, ref: 'Vendor' }],
      excludeMobiles: { type: [String], default: [] },
      manualMobiles: { type: [String], default: [] },
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
