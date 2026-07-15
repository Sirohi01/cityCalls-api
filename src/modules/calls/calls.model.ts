import { Schema, model, Document, Types } from 'mongoose';

// docs/coordination/06-naming-conventions.md §4.
export const CALL_TYPES = [
  'INITIAL',
  'REQUIREMENT',
  'PRE_SERVICE',
  'VISIT_UPDATE',
  'POST_SERVICE_FOLLOWUP',
  'HAPPY_CALL',
] as const;
export type CallType = (typeof CALL_TYPES)[number];

export const CALL_DIRECTIONS = ['INCOMING', 'OUTGOING'] as const;
export type CallDirection = (typeof CALL_DIRECTIONS)[number];

// docs/09-database-architecture.md §2 "calls": one collection, `details` sub-document
// keyed by callType rather than one flat schema with every possible field.
export interface ICall extends Document {
  number: string;
  callType: CallType;
  direction: CallDirection;
  customerId?: Types.ObjectId;
  customerProductId?: Types.ObjectId;
  relatedLeadId?: Types.ObjectId;
  relatedServiceRequestId?: Types.ObjectId;
  callerNumber: string;
  alternateNumber?: string;
  customerName?: string;
  callDate: Date;
  callTime: string;
  source?: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  notes?: string;
  attachments: string[];
  recordingUrl?: string;
  outcome?: string;
  branchId?: Types.ObjectId;
  createdBy: Types.ObjectId;
  assignedTo?: Types.ObjectId;
  // Call-type-specific fields, validated per-type in calls.validation.ts.
  details: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const callSchema = new Schema<ICall>(
  {
    number: { type: String, required: true, unique: true },
    callType: { type: String, enum: CALL_TYPES, required: true },
    direction: { type: String, enum: CALL_DIRECTIONS, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
    customerProductId: { type: Schema.Types.ObjectId, ref: 'CustomerProduct' },
    relatedLeadId: { type: Schema.Types.ObjectId, ref: 'Lead' },
    relatedServiceRequestId: { type: Schema.Types.ObjectId },
    callerNumber: { type: String, required: true },
    alternateNumber: { type: String },
    customerName: { type: String },
    callDate: { type: Date, required: true },
    callTime: { type: String, required: true },
    source: { type: String },
    priority: { type: String, enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'], default: 'NORMAL' },
    notes: { type: String },
    attachments: { type: [String], default: [] },
    recordingUrl: { type: String },
    outcome: { type: String },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    details: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

callSchema.index({ customerId: 1, callDate: -1 });
callSchema.index({ relatedServiceRequestId: 1 });
callSchema.index({ callType: 1, callDate: -1 });
callSchema.index({ branchId: 1 });

export const CallModel = model<ICall>('Call', callSchema);
