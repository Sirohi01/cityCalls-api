import { Schema, model, Document, Types } from 'mongoose';

export const HAPPY_CALL_STATUSES = ['PENDING', 'COMPLETED', 'UNREACHABLE', 'RESCHEDULED'] as const;
export type HappyCallStatus = (typeof HAPPY_CALL_STATUSES)[number];

// docs/09-database-architecture.md §2 "happy_calls" — a distinct entity from
// the generic Call log because of its structured outcome fields (satisfaction,
// reopen/escalation flags), per docs/06-complete-workflow-document.md Stage 10.
export interface IHappyCall extends Document {
  serviceRequestId: Types.ObjectId;
  assignedTo: Types.ObjectId;
  performedBy?: Types.ObjectId;
  callDate?: Date;
  callTime?: string;
  status: HappyCallStatus;
  outcome?: string;
  customerSatisfaction?: number; // 1-5
  remarks?: string;
  reopenRequested: boolean;
  escalationRequired: boolean;
  nextFollowUpDate?: Date;
  recordingUrl?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const happyCallSchema = new Schema<IHappyCall>(
  {
    serviceRequestId: { type: Schema.Types.ObjectId, ref: 'ServiceRequest', required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    callDate: { type: Date },
    callTime: { type: String },
    status: { type: String, enum: HAPPY_CALL_STATUSES, default: 'PENDING' },
    outcome: { type: String },
    customerSatisfaction: { type: Number, min: 1, max: 5 },
    remarks: { type: String },
    reopenRequested: { type: Boolean, default: false },
    escalationRequired: { type: Boolean, default: false },
    nextFollowUpDate: { type: Date },
    recordingUrl: { type: String },
    retryCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

happyCallSchema.index({ serviceRequestId: 1 }, { unique: true });
happyCallSchema.index({ assignedTo: 1, status: 1 });

export const HappyCallModel = model<IHappyCall>('HappyCall', happyCallSchema);
