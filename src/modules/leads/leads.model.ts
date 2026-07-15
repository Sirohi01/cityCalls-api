import { Schema, model, Document, Types } from 'mongoose';

// docs/coordination/06-naming-conventions.md §4.
export const LEAD_STAGES = [
  'NEW',
  'CONTACT_ATTEMPTED',
  'CONNECTED',
  'REQUIREMENT_COLLECTED',
  'QUALIFIED',
  'ESTIMATE_REQUIRED',
  'ESTIMATE_SHARED',
  'NEGOTIATION',
  'FOLLOW_UP',
  'CONVERTED',
  'LOST',
  'NOT_INTERESTED',
  'INVALID',
  'DUPLICATE',
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

interface INote {
  text: string;
  authorId: Types.ObjectId;
  createdAt: Date;
}

// docs/09-database-architecture.md §2 "leads".
export interface ILead extends Document {
  number: string;
  stage: LeadStage;
  source: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  score?: number;
  ownerId: Types.ObjectId;
  customerId?: Types.ObjectId;
  contactName?: string;
  contactMobile?: string;
  productInterest?: string;
  requirement?: string;
  followUpDate?: Date;
  notes: INote[];
  attachments: string[];
  lostReason?: string;
  duplicateOfLeadId?: Types.ObjectId;
  convertedToCustomerId?: Types.ObjectId;
  convertedToServiceRequestId?: Types.ObjectId;
  campaignId?: Types.ObjectId;
  branchId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const leadSchema = new Schema<ILead>(
  {
    number: { type: String, required: true, unique: true },
    stage: { type: String, enum: LEAD_STAGES, default: 'NEW' },
    source: { type: String, required: true },
    priority: { type: String, enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'], default: 'NORMAL' },
    score: { type: Number },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
    contactName: { type: String },
    contactMobile: { type: String },
    productInterest: { type: String },
    requirement: { type: String },
    followUpDate: { type: Date },
    notes: [
      {
        text: String,
        authorId: { type: Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    attachments: { type: [String], default: [] },
    lostReason: { type: String },
    duplicateOfLeadId: { type: Schema.Types.ObjectId, ref: 'Lead' },
    convertedToCustomerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
    convertedToServiceRequestId: { type: Schema.Types.ObjectId },
    campaignId: { type: Schema.Types.ObjectId },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  },
  { timestamps: true }
);

leadSchema.index({ stage: 1, ownerId: 1 });
leadSchema.index({ followUpDate: 1 });
leadSchema.index({ contactMobile: 1 });
leadSchema.index({ branchId: 1 });

export const LeadModel = model<ILead>('Lead', leadSchema);
